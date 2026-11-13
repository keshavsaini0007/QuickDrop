import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/api';
import { signUpSchema } from '@/lib/validation';
import { useAppTheme } from '@/theme';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { BrandRow } from '@/components/brand';

type FormValues = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    try {
      await register(values);
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Screen scroll edges={['top', 'bottom']} contentStyle={{ paddingTop: 26 }}>
      <BrandRow />
      <View style={{ marginTop: 36, marginBottom: 24 }}>
        <AppText variant="display">Create your vault.</AppText>
        <AppText variant="body" color="textSecondary" style={{ marginTop: 8 }}>
          Start with 5 GB of private storage. No ads, no public profile.
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
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.name?.message}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
        )}
      />
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
            hint="At least 8 characters with a letter and a number."
            placeholder="Create a password"
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

      <Button
        label="Create account"
        onPress={() => void submit()}
        loading={isSubmitting}
        style={{ marginTop: 8 }}
      />
      <View style={{ marginTop: 28, alignItems: 'center' }}>
        <AppText variant="small" color="textSecondary">
          Already have an account?
        </AppText>
        <Button
          label="Sign in"
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
          style={{ marginTop: 6 }}
        />
      </View>
    </Screen>
  );
}
