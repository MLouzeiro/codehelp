import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../services/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  title, onPress, variant = 'primary', size = 'md',
  loading, disabled, icon, style, fullWidth,
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles: Record<ButtonVariant, { bg: string; text: string }> = {
    primary: { bg: colors.primary, text: colors.primaryText },
    secondary: { bg: colors.bgInput, text: colors.text },
    danger: { bg: '#ef4444', text: '#ffffff' },
    ghost: { bg: 'transparent', text: colors.primary },
  };

  const sizeStyles: Record<ButtonSize, { py: number; px: number; fontSize: number }> = {
    sm: { py: 8, px: 12, fontSize: 13 },
    md: { py: 12, px: 16, fontSize: 15 },
    lg: { py: 16, px: 20, fontSize: 17 },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? '#94a3b8' : v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          opacity: pressed ? 0.8 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: disabled ? '#cbd5e1' : v.text, fontSize: s.fontSize, marginLeft: icon ? 8 : 0 }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 44,
  },
  text: {
    fontWeight: '600',
  },
});
