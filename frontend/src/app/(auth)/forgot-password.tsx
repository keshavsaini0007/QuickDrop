import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useState } from 'react';
import type { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/api';
import { forgotPasswordSchema } from '@/lib/validation';
import { useAppTheme } from '@/theme';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { BrandRow } from '@/components/brand';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | undefined>();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    try {
      const result = await forgotPassword(values.email);
      setResetToken(result.resetToken);
      setSent(true);
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Screen scroll edges={['top', 'bottom']} contentStyle={{ paddingTop: 20 }}>
      <BrandRow compact />
      <View style={{ marginTop: 40, marginBottom: 24 }}>
        <AppText variant="display">Reset access.</AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: 8 }}>
          Enter the email tied to your vault. If an account exists, we’ll send a
          time-limited reset link.
        </AppText>
      </View>

      {sent ? (
        <View
          style={{
            backgroundColor: theme.colors.successSoft,
            borderRadius: theme.radii.lg,
            padding: 18,
            gap: 10,
          }}
        >
          <AppText variant="subheading" color="success">
            Check your inbox
          </AppText>
          <AppText variant="small" color="textSecondary">
            The response is intentionally the same whether or not an account exists.
            Reset links expire after a short time.
          </AppText>
          {resetToken ? (
            <Button
              label="Continue with development token"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/(auth)/reset-password',
                  params: { token: resetToken },
                })
              }
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>
      ) : (
        <>
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
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => void submit()}
              />
            )}
          />
          <Button label="Send reset link" onPress={() => void submit()} loading={isSubmitting} />
        </>
      )}

      <Button
        label="Back to sign in"
        variant="ghost"
        onPress={() => router.replace('/(auth)/sign-in')}
        style={{ marginTop: 18 }}
      />
    </Screen>
  );
}
