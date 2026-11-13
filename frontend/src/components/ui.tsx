import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, layout, type ThemeColors } from '@/theme';
import { useNetworkStatus } from '@/hooks/use-network';
import { initials } from '@/lib/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function AppText({
  variant = 'body',
  color,
  style,
  ...props
}: TextProps & {
  variant?: keyof ReturnType<typeof useAppTheme>['typography'];
  color?: keyof ThemeColors;
}) {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[
        theme.typography[variant],
        { color: color ? theme.colors[color] : theme.colors.text },
        style,
      ]}
    />
  );
}

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  padded = true,
  contentStyle,
  refreshControl,
  bottomInset = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  bottomInset?: boolean;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View
      style={[
        styles.content,
        { maxWidth: layout.maxContentWidth },
        padded && { paddingHorizontal: theme.spacing.lg },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      {scroll ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.fill}
        >
          <ScrollView
            contentContainerStyle={{
              paddingBottom: (bottomInset ? insets.bottom : 0) + theme.spacing.xxl,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function AppHeader({
  title,
  subtitle,
  right,
  showBack = false,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <View style={styles.header}>
      {showBack ? (
        <IconButton
          icon="chevron-back"
          label="Go back"
          onPress={onBack ?? (() => router.back())}
          style={{ marginLeft: -theme.spacing.sm }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const palette = {
    primary: {
      background: theme.colors.primary,
      border: theme.colors.primary,
      text: theme.colors.onPrimary,
    },
    secondary: {
      background: theme.colors.surface,
      border: theme.colors.border,
      text: theme.colors.text,
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      text: theme.colors.primary,
    },
    danger: {
      background: theme.colors.danger,
      border: theme.colors.danger,
      text: '#FFFFFF',
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{
        color:
          palette.text === '#FFFFFF'
            ? 'rgba(255,255,255,0.18)'
            : theme.colors.primarySoft,
      }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={palette.text} /> : null}
          <Text style={[theme.typography.button, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  right,
  containerStyle,
  secureTextEntry,
  style,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text style={[theme.typography.smallStrong, { color: theme.colors.text, marginBottom: 7 }]}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.input,
            borderColor: error ? theme.colors.danger : theme.colors.border,
          },
        ]}
      >
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          secureTextEntry={isPassword ? hidden : false}
          placeholderTextColor={theme.colors.textTertiary}
          style={[
            theme.typography.body,
            { color: theme.colors.text, flex: 1, paddingVertical: 0 },
            style,
          ]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            onPress={() => setHidden((value) => !value)}
            style={styles.fieldAdornment}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={21}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ) : (
          right
        )}
      </View>
      {error ? (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginTop: 6 }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 6 }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
        theme.shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
    >
      {content}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 22,
  color,
  style,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: keyof ThemeColors;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      android_ripple={{ color: theme.colors.surfaceMuted, borderless: true, radius: 24 }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 },
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={size}
        color={color ? theme.colors[color] : theme.colors.text}
      />
    </Pressable>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={`${name} avatar`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
        borderWidth: 1,
        borderColor: theme.colors.primary,
      }}
    >
      <Text
        style={{
          color: theme.colors.primary,
          fontWeight: '800',
          fontSize: size * 0.34,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const theme = useAppTheme();
  const palette = {
    neutral: { background: theme.colors.surfaceMuted, text: theme.colors.textSecondary },
    success: { background: theme.colors.successSoft, text: theme.colors.success },
    warning: { background: theme.colors.warningSoft, text: theme.colors.warning },
    danger: { background: theme.colors.dangerSoft, text: theme.colors.danger },
    info: { background: theme.colors.primarySoft, text: theme.colors.primary },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.background,
        borderRadius: theme.radii.pill,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Text style={[theme.typography.caption, { color: palette.text, fontWeight: '700' }]}>
        {label}
      </Text>
    </View>
  );
}

export function StorageBar({
  percent,
  height = 8,
  trackColor,
  fillColor,
}: {
  percent: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
}) {
  const theme = useAppTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor ?? theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor:
            clamped >= 90 ? theme.colors.danger : (fillColor ?? theme.colors.primary),
        }}
      />
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <AppText variant="subheading">{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={[theme.typography.smallStrong, { color: theme.colors.primary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }, style]} />;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.empty}>
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 22,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.lg,
        }}
      >
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <AppText variant="subheading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText
        variant="small"
        color="textSecondary"
        style={{ textAlign: 'center', marginTop: 6, maxWidth: 320 }}
      >
        {message}
      </AppText>
      {action ? <View style={{ marginTop: theme.spacing.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <AppText variant="small" color="textSecondary" style={{ marginTop: 10 }}>
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.empty}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          backgroundColor: theme.colors.dangerSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.lg,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={30} color={theme.colors.danger} />
      </View>
      <AppText variant="subheading" style={{ textAlign: 'center' }}>
        Something went wrong
      </AppText>
      <AppText
        variant="small"
        color="textSecondary"
        style={{ textAlign: 'center', marginTop: 6, maxWidth: 320 }}
      >
        {message}
      </AppText>
      {onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          onPress={onRetry}
          fullWidth={false}
          style={{ marginTop: theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}

export function OfflineBanner() {
  const theme = useAppTheme();
  const network = useNetworkStatus();
  if (network.isOnline) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.colors.warningSoft,
        borderColor: theme.colors.warning,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: theme.radii.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: theme.spacing.md,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.warning} />
      <Text style={[theme.typography.small, { color: theme.colors.warning, flex: 1 }]}>
        You’re offline. Saved offline files remain available; new requests will wait for a connection.
      </Text>
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: theme.colors.overlay }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            maxHeight: '92%',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.xs,
            }}
          >
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.borderStrong,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{title}</AppText>
              {subtitle ? (
                <AppText variant="small" color="textSecondary" style={{ marginTop: 3 }}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
              }}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: theme.spacing.lg }}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function RefreshControlView({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const theme = useAppTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surface}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', flex: 1 },
  header: {
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fieldWrap: { marginBottom: 14 },
  field: {
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldAdornment: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  card: { borderWidth: 1, padding: 16 },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
  },
});
