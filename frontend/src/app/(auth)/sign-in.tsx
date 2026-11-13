import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/api';
import { signInSchema } from '@/lib/validation';
import { useAppTheme } from '@/theme';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { BrandRow } from '@/components/brand';

type FormValues = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Screen scroll edges={['top', 'bottom']} contentStyle={{ paddingTop: 26 }}>
      <BrandRow />
      <View style={{ marginTop: 44, marginBottom: 28 }}>
        <AppText variant="display">Welcome back.</AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: 8 }}>
          Sign in to reach your files, folders, and private share links.
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
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />

      <View style={{ alignItems: 'flex-end', marginTop: -2, marginBottom: 20 }}>
        <Button
          label="Forgot password?"
          variant="ghost"
          fullWidth={false}
          onPress={() => router.push('/(auth)/forgot-password')}
        />
      </View>

      <Button
        label="Sign in"
        onPress={() => void submit()}
        loading={isSubmitting}
        accessibilityHint="Signs in with your email and password"
      />

      <View style={{ marginTop: 34, alignItems: 'center' }}>
        <AppText variant="small" color="textSecondary">
          New to QuickDrop?
        </AppText>
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-up')}
          style={{ marginTop: 12 }}
        />
      </View>
    </Screen>
  );
}
