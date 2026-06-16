import React, { useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useNotificationStore } from '../../src/stores/notificationStore';
import { usePolling } from '../../src/hooks/usePolling';
import { EmptyState } from '../../src/components/ui/Feedback';
import { getNotificationIcon } from '../../src/services/notifications';
import type { Notificacao } from '../../src/types';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { items, naoLidas, loading, loadNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => { loadNotifications({ page: 1, limit: 50 }); }, []);
  usePolling(() => loadNotifications({ page: 1, limit: 50 }), 15000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications({ page: 1, limit: 50 }).finally(() => setRefreshing(false));
  }, [loadNotifications]);

  const handlePress = useCallback(async (notif: Notificacao) => {
    if (!notif.lida) {
      await markAsRead(notif.id);
    }
    if (notif.ticketId) {
      router.push(`/(modals)/ticket/${notif.ticketId}`);
    }
  }, [markAsRead]);

  const renderItem = useCallback(({ item }: { item: Notificacao }) => (
    <Pressable
      onPress={() => handlePress(item)}
      style={[styles.card, {
        backgroundColor: item.lida ? colors.bgCard : colors.primary + '08',
        borderColor: item.lida ? colors.border : colors.primary + '30',
      }]}
    >
      <Text style={styles.icon}>{getNotificationIcon(item.tipo)}</Text>
      <View style={styles.info}>
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {item.mensagem}
        </Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {new Date(item.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {!item.lida && (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      )}
    </Pressable>
  ), [colors, handlePress]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {naoLidas > 0 && (
        <Pressable onPress={markAllAsRead} style={[styles.markAll, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="checkmark-done" size={18} color={colors.primary} />
          <Text style={[styles.markAllText, { color: colors.primary }]}>Marcar todas como lidas ({naoLidas})</Text>
        </Pressable>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? (
          <EmptyState icon="🔔" title="Nenhuma notificacao" description="Tudo em dia!" />
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  markAllText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  icon: { fontSize: 24, marginRight: 12 },
  info: { flex: 1 },
  message: { fontSize: 14, fontWeight: '500' },
  time: { fontSize: 11, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});
