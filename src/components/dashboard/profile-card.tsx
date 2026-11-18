import { useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AuthMessage } from '@/components/auth/auth-message';
import { ProfileAvatar } from '@/components/dashboard/dashboard-ui';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing } from '@/constants/theme';
import { useAuthAction } from '@/hooks/use-auth-action';
import { useTheme } from '@/hooks/use-theme';

export function ProfileCard() {
  const { user } = useUser();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <ThemedText type="smallBold" accessibilityRole="header" themeColor="textSecondary">Profile</ThemedText>
      {editing && user ? <ProfileEditor key={user.id} onClose={(didSave) => {
        setEditing(false); setSaved(didSave);
      }} /> : <>
        <View style={styles.profile}>
          <ProfileAvatar imageUrl={user?.hasImage ? user.imageUrl : undefined} name={user?.fullName} />
          <View style={styles.identity}>
            <ThemedText type="smallBold">{user?.fullName || 'Keesha account'}</ThemedText>
            {user?.primaryEmailAddress && <ThemedText type="small" themeColor="textSecondary">
              {user.primaryEmailAddress.emailAddress}
            </ThemedText>}
          </View>
        </View>
        <AuthMessage error={false} message={saved ? 'Profile updated.' : undefined} />
        <Button label="Edit profile" variant="secondary" disabled={!user}
          onPress={() => { setSaved(false); setEditing(true); }} />
      </>}
    </View>
  );
}

function ProfileEditor({ onClose }: { onClose: (saved: boolean) => void }) {
  const { user } = useUser();
  const action = useAuthAction();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [message, setMessage] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [partialSave, setPartialSave] = useState(false);
  const dirty = firstName.trim() !== (user?.firstName ?? '') || lastName.trim() !== (user?.lastName ?? '') || !!photo;

  function choosePhoto() {
    setMessage(undefined);
    setPartialSave(false);
    void action.run(async () => {
      // The system picker grants access to the selected photo without broad library access.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
        base64: Platform.OS !== 'web',
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected || (!selected.file && !selected.base64)) {
        setMessage('Couldn’t read this photo. Please choose another image.');
        return;
      }
      const bytes = selected.file?.size ?? (selected.base64 ? Math.ceil(selected.base64.length * 3 / 4) : selected.fileSize);
      if (bytes && bytes > 5 * 1024 * 1024) {
        setMessage('Choose a profile picture smaller than 5 MB.');
        return;
      }
      setPhoto(selected);
    });
  }

  function save() {
    if (!user || !dirty) return;
    const nameChanged = firstName.trim() !== (user.firstName ?? '') || lastName.trim() !== (user.lastName ?? '');
    if (nameChanged && !firstName.trim() && !lastName.trim()) {
      setNameError('Enter your first or last name.');
      return;
    }
    setNameError(undefined);
    setMessage(undefined);
    void action.run(async () => {
      if (nameChanged) {
        setPartialSave(false);
        await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
        setPartialSave(true);
      }
      if (photo) {
        await user.setProfileImage({ file: photo.file ?? `data:image/jpeg;base64,${photo.base64}` });
      }
      onClose(true);
    });
  }

  return (
    <View style={styles.editor}>
      <View style={styles.profile}>
        <ProfileAvatar imageUrl={photo?.uri ?? (user?.hasImage ? user.imageUrl : undefined)}
          name={[firstName, lastName].join(' ')} />
        <View style={styles.identity}>
          <ThemedText type="smallBold">Profile picture</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Choose an image up to 5 MB.</ThemedText>
        </View>
      </View>
      <Button label={photo ? 'Choose another photo' : 'Change photo'} variant="secondary"
        disabled={action.pending} onPress={choosePhoto} />
      <TextField label="First name" value={firstName} autoCapitalize="words" autoComplete="given-name"
        textContentType="givenName" maxLength={256} editable={!action.pending} error={nameError}
        onChangeText={(value) => { setFirstName(value); setNameError(undefined); }} />
      <TextField label="Last name" value={lastName} autoCapitalize="words" autoComplete="family-name"
        textContentType="familyName" maxLength={256} editable={!action.pending}
        onChangeText={(value) => { setLastName(value); setNameError(undefined); }} onSubmitEditing={save} />
      <AuthMessage message={message ?? (action.issue && partialSave
        ? 'Your name was saved, but the photo could not be uploaded. Try saving again or choose another photo.'
        : action.issue?.message)} />
      <Button label="Save changes" loading={action.pending} disabled={!dirty} onPress={save} />
      <Button label="Cancel" variant="secondary" disabled={action.pending} onPress={() => onClose(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderWidth: 1, borderRadius: Radii.medium, gap: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, minWidth: 0 },
  editor: { gap: Spacing.three },
});
