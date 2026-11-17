import { Button, type ButtonProps } from '@/components/ui/button';

export function GoogleButton(props: Omit<ButtonProps, 'label' | 'variant'>) {
  return <Button {...props} label="Continue with Google" variant="secondary" />;
}
