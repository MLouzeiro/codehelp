import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../services/theme';

export function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>Carregando...</Text>
    </View>
  );
}

export function EmptyState({ icon, title, description }: { icon?: string; title: string; description?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      {icon && <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {description && <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{description}</Text>}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{message}</Text>
      {onRetry && (
        <Text style={[styles.retry, { color: colors.primary }]} onPress={onRetry}>
          Tentar novamente
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 12, fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  retry: { fontSize: 14, fontWeight: '600', marginTop: 12 },
});
