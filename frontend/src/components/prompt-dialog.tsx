import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '@/theme';
import { AppText, Button } from './ui';

export function PromptDialog({
  visible,
  title,
  message,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  loading = false,
  error,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const theme = useAppTheme();
  const [value, setValue] = useState(initialValue);

  const trimmed = value.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        />
        <View style={styles.center} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.lg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppText variant="heading">{title}</AppText>
            {message ? (
              <AppText variant="small" color="textSecondary" style={{ marginTop: 6 }}>
                {message}
              </AppText>
            ) : null}
            <AppText
              variant="smallStrong"
              style={{ marginTop: 18, marginBottom: 7 }}
            >
              {label}
            </AppText>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.textTertiary}
              autoFocus
              selectTextOnFocus
              maxLength={255}
              accessibilityLabel={label}
              style={[
                theme.typography.body,
                {
                  minHeight: 52,
                  borderWidth: 1,
                  borderColor: error ? theme.colors.danger : theme.colors.border,
                  backgroundColor: theme.colors.input,
                  color: theme.colors.text,
                  borderRadius: theme.radii.md,
                  paddingHorizontal: 14,
                },
              ]}
            />
            {error ? (
              <AppText variant="caption" color="danger" style={{ marginTop: 6 }}>
                {error}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={onCancel}
                fullWidth={false}
                style={{ flex: 1 }}
              />
              <Button
                label={confirmLabel}
                onPress={() => onSubmit(trimmed)}
                disabled={!trimmed}
                loading={loading}
                fullWidth={false}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    padding: 20,
  },
});
