import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authIssue, createActionGate, finishSignIn, login, oauthOutcome, register,
  requestPasswordReset, resendSeconds, sessionAccess, signInStep, signUpStep,
  validateCode, validateCredentials, verifyRegistration, verifySignIn, verifyPasswordReset, updatePassword,
} from '../src/lib/auth.ts';

const ok = () => Promise.resolve({ error: null });

function signInResource(status = null) {
  const events = [];
  const resource = {
    status, supportedSecondFactors: [],
    password: async (params) => { events.push(['password', params]); resource.status = 'complete'; return { error: null }; },
    mfa: {
      sendEmailCode: async () => { events.push('send'); return { error: null }; },
      verifyEmailCode: async () => { events.push('verify'); resource.status = 'complete'; return { error: null }; },
    },
    finalize: async () => { events.push('finalize'); return { error: null }; },
  };
  return { resource, events };
}

function signUpResource() {
  const events = [];
  const resource = {
    status: null, missingFields: [], unverifiedFields: [],
    password: async () => {
      resource.status = 'missing_requirements'; resource.unverifiedFields = ['email_address'];
      events.push('create'); return { error: null };
    },
    verifications: {
      emailAddress: { status: 'unverified' },
      sendEmailCode: async () => { events.push('send'); return { error: null }; },
      verifyEmailCode: async () => {
        resource.status = 'complete'; resource.unverifiedFields = [];
        resource.verifications.emailAddress.status = 'verified';
        events.push('verify'); return { error: null };
      },
    },
    finalize: async () => { events.push('finalize'); return { error: null }; },
  };
  return { resource, events };
}

test('credentials and confirmation are validated without inventing a password policy', () => {
  assert.deepEqual(validateCredentials(' person@example.com ', 'any-password', 'any-password'), {});
  assert.ok(validateCredentials('bad-email', '').email);
  assert.ok(validateCredentials('a@example.com', 'one', 'two').confirmation);
  assert.equal(validateCode('123456'), undefined);
  assert.ok(validateCode('12345'));
});

test('registration does not activate a session until email verification completes', async () => {
  const { resource, events } = signUpResource();
  assert.equal(await register(resource, 'a@example.com', 'password'), 'verify');
  assert.deepEqual(events, ['create', 'send']);
  await verifyRegistration(resource, '123456');
  assert.deepEqual(events, ['create', 'send', 'verify', 'finalize']);
});

test('incorrect and expired codes never finalize registration', async () => {
  for (const code of ['form_code_incorrect', 'verification_expired']) {
    const { resource, events } = signUpResource();
    await register(resource, 'a@example.com', 'password');
    resource.verifications.verifyEmailCode = async () => ({ error: { code } });
    await assert.rejects(verifyRegistration(resource, '999999'));
    assert.ok(!events.includes('finalize'));
    assert.equal(authIssue({ code }).field, 'code');
  }
});

test('unverified or incomplete sign-up cannot be finalized', async () => {
  const { resource, events } = signUpResource();
  resource.status = 'complete';
  assert.equal(signUpStep(resource), 'unsupported');
  resource.verifications.verifyEmailCode = ok;
  await assert.rejects(verifyRegistration(resource, '123456'));
  assert.ok(!events.includes('finalize'));
});

test('email verification send failures remain retryable without recreating the account', async () => {
  const { resource, events } = signUpResource();
  resource.verifications.sendEmailCode = async () => ({ error: { code: 'network_error' } });
  await assert.rejects(register(resource, 'a@example.com', 'password'));
  assert.equal(signUpStep(resource), 'verify');
  assert.deepEqual(events, ['create']);
});

test('login preserves password contents and trims only the email', async () => {
  const { resource, events } = signInResource();
  await login(resource, ' a@example.com ', '  password  ');
  assert.deepEqual(events[0], ['password', { emailAddress: 'a@example.com', password: '  password  ' }]);
  assert.equal(events[1], 'finalize');
});

test('device verification is sent before session activation', async () => {
  const { resource, events } = signInResource();
  resource.password = async () => {
    resource.status = 'needs_client_trust';
    resource.supportedSecondFactors = [{ strategy: 'email_code' }];
    return { error: null };
  };
  assert.equal(await login(resource, 'a@example.com', 'password'), 'verify');
  assert.deepEqual(events, ['send']);
  await verifySignIn(resource, '123456');
  assert.deepEqual(events, ['send', 'verify', 'finalize']);
});

test('unsupported second factors and incomplete sign-ins cannot activate sessions', async () => {
  const { resource, events } = signInResource('needs_second_factor');
  resource.supportedSecondFactors = [{ strategy: 'totp' }];
  assert.equal(signInStep(resource), 'unsupported');
  await assert.rejects(finishSignIn(resource));
  assert.ok(!events.includes('finalize'));
});

test('wrong credentials have the same safe message for unknown and existing accounts', async () => {
  assert.deepEqual(authIssue({ errors: [{ code: 'form_identifier_not_found' }] }),
    authIssue({ errors: [{ code: 'form_password_incorrect' }] }));
  const { resource, events } = signInResource();
  resource.password = async () => ({ error: { code: 'form_password_incorrect' } });
  await assert.rejects(login(resource, 'a@example.com', 'wrong'));
  assert.ok(!events.includes('finalize'));
});

test('password reset sends through the current email-code API and masks unknown accounts', async () => {
  let sends = 0;
  const resource = { create: ok, resetPasswordEmailCode: { sendCode: async () => { sends++; return { error: null }; } } };
  await requestPasswordReset(resource, 'a@example.com');
  assert.equal(sends, 1);
  resource.create = async () => ({ error: { code: 'form_identifier_not_found' } });
  await requestPasswordReset(resource, 'unknown@example.com');
  assert.equal(sends, 1);
});

test('pending sessions, session tasks, and unverified emails are excluded from dashboard access', () => {
  assert.equal(sessionAccess(false, false), 'loading');
  assert.equal(sessionAccess(true, false), 'signed-out');
  assert.equal(sessionAccess(true, true, 'pending', true, true), 'blocked');
  assert.equal(sessionAccess(true, true, 'active', true, true), 'blocked');
  assert.equal(sessionAccess(true, true, 'active', false, false), 'blocked');
  assert.equal(sessionAccess(true, true, 'active', false, true), 'active');
  assert.equal(sessionAccess(true, false, 'active', false, true), 'signed-out');
});

test('a second submission is rejected synchronously, and the gate releases after failure', async () => {
  const gate = createActionGate();
  let finish;
  let calls = 0;
  const first = gate.run(async () => { calls++; await new Promise(resolve => { finish = resolve; }); });
  assert.equal(await gate.run(async () => { calls++; }), false);
  finish();
  assert.equal(await first, true);
  assert.equal(calls, 1);
  await assert.rejects(gate.run(async () => { throw new Error('failure'); }));
  assert.equal(await gate.run(async () => {}), true);
});

test('OAuth cancellation is a normal outcome; missing requirements are not treated as success', () => {
  assert.equal(oauthOutcome({ createdSessionId: null, authSessionResult: { type: 'cancel' } }), 'cancelled');
  assert.equal(oauthOutcome({ createdSessionId: null, authSessionResult: { type: 'dismiss' } }), 'cancelled');
  assert.equal(oauthOutcome({ createdSessionId: 'session', authSessionResult: { type: 'success' } }), 'complete');
  assert.equal(oauthOutcome({ createdSessionId: null, existingSession: true, authSessionResult: null }), 'complete');
  assert.equal(oauthOutcome({ createdSessionId: null, authSessionResult: { type: 'success' } }), 'continue');
});

test('resend cooldown expires after thirty seconds', () => {
  assert.equal(resendSeconds(1000, 1000), 30);
  assert.equal(resendSeconds(1000, 30_000), 1);
  assert.equal(resendSeconds(1000, 31_000), 0);
  assert.equal(resendSeconds(1000, 100_000), 0);
});

test('provider payloads and raw errors are never exposed by the error mapper', () => {
  const issue = authIssue({ message: 'SQL password=secret', stack: 'private stack', errors: [{ code: 'unknown', longMessage: 'token' }] });
  assert.equal(issue.message, 'We could not complete that request. Please try again.');
  assert.ok(!JSON.stringify(issue).includes('secret'));
});


test('password recovery verifies the code before accepting a new password, then waits for explicit session completion', async () => {
  const { resource, events } = signInResource('needs_first_factor');
  resource.resetPasswordEmailCode = {
    verifyCode: async () => { resource.status = 'needs_new_password'; events.push('reset-code'); return { error: null }; },
    submitPassword: async params => {
      assert.equal(params.signOutOfOtherSessions, true);
      resource.status = 'complete'; events.push('new-password'); return { error: null };
    },
  };
  await assert.rejects(updatePassword(resource, 'new-password'));
  await verifyPasswordReset(resource, '123456');
  assert.equal(await updatePassword(resource, 'new-password'), 'complete');
  assert.deepEqual(events, ['reset-code', 'new-password']);
  await finishSignIn(resource);
  assert.equal(events.at(-1), 'finalize');
});

test('a rejected reset code cannot advance the password recovery flow', async () => {
  const { resource, events } = signInResource('needs_first_factor');
  resource.resetPasswordEmailCode = {
    verifyCode: async () => ({ error: { code: 'form_code_incorrect' } }),
    submitPassword: async () => { events.push('new-password'); return { error: null }; },
  };
  await assert.rejects(verifyPasswordReset(resource, '999999'));
  await assert.rejects(updatePassword(resource, 'new-password'));
  assert.deepEqual(events, []);
});
