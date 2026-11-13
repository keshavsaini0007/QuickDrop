import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import type { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/validation';
import { useAppTheme } from '@/theme';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { BrandRow } from '@/components/brand';

type FormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const tokenFromLink = typeof params.token === 'string' ? params.token : '';
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenFromLink,
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    try {
      await resetPassword(values.token, values.password);
      Alert.alert('Password reset', 'Sign in with your new password.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Screen scroll edges={['top', 'bottom']} contentStyle={{ paddingTop: 20 }}>
      <BrandRow compact />
      <View style={{ marginTop: 40, marginBottom: 24 }}>
        <AppText variant="display">Choose a new password.</AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: 8 }}>
          Resetting the password signs out every other session.
        </AppText>
      </View>

      {errors.root?.message ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.colors.dangerSoft,
            borderRadius: theme.radii.md,
            padding: 13,
            marginBottom: 16,
          }}
        >
          <AppText variant="small" color="danger">
            {errors.root.message}
          </AppText>
        </View>
      ) : null}

      {!tokenFromLink ? (
        <Controller
          control={control}
          name="token"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Reset token"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.token?.message}
              placeholder="Paste the token from your email"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        />
      ) : null}
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="New password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            hint="At least 8 characters with a letter and a number."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Confirm new password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.confirmPassword?.message}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button label="Reset password" onPress={() => void submit()} loading={isSubmitting} />
      <Button
        label="Back to sign in"
        variant="ghost"
        onPress={() => router.replace('/(auth)/sign-in')}
        style={{ marginTop: 14 }}
      />
    </Screen>
  );
}
