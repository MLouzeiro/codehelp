import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useOrdersStore } from '../../src/stores/ordersStore';
import { usePolling } from '../../src/hooks/usePolling';
import { Badge } from '../../src/components/ui/Card';
import { LoadingScreen, EmptyState } from '../../src/components/ui/Feedback';
import type { ServiceOrder } from '../../src/types';

const STATUS_COLORS: Record<string, string> = {
  aberta: '#3b82f6',
  em_atendimento: '#f59e0b',
  concluida: '#22c55e',
  cancelada: '#ef4444',
  aguardando_peca: '#8b5cf6',
};

export default function OrdersScreen() {
  const { colors } = useTheme();
  const { orders, total, loading, loadOrders } = useOrdersStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadOrders({ page: 1, limit: 30 }); }, []);
  usePolling(() => loadOrders({ page: 1, limit: 30 }), 30000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders({ page: 1, limit: 30 }).finally(() => setRefreshing(false));
  }, [loadOrders]);

  const renderItem = useCallback(({ item }: { item: ServiceOrder }) => (
    <Pressable
      onPress={() => router.push(`/(modals)/order/${item.id}`)}
      style={({ pressed }) => [styles.card, {
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardNumber, { color: colors.primary }]}>
          #{item.numero || item.id.slice(0, 8)}
        </Text>
        <Badge text={item.status} color={STATUS_COLORS[item.status] || '#64748b'} size="sm" />
      </View>
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {item.titulo}
      </Text>
      {item.client && (
        <Text style={[styles.cardClient, { color: colors.textSecondary }]} numberOfLines={1}>
          🏢 {item.client.razaoSocial || item.client.nomeFantasia}
        </Text>
      )}
      <View style={styles.cardFooter}>
        {item.assignee && (
          <Text style={[styles.cardAgent, { color: colors.textSecondary }]}>
            👤 {item.assignee.name}
          </Text>
        )}
        <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
          {new Date(item.dataAbertura).toLocaleDateString('pt-BR')}
        </Text>
      </View>
      {item.valorTotal != null && item.valorTotal > 0 && (
        <Text style={[styles.cardValue, { color: colors.primary }]}>
          R$ {item.valorTotal.toFixed(2)}
        </Text>
      )}
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? (
          <EmptyState icon="📋" title="Nenhuma OS encontrada" />
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardNumber: { fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardClient: { fontSize: 13, marginBottom: 4 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  cardAgent: { fontSize: 12 },
  cardDate: { fontSize: 12 },
  cardValue: { fontSize: 14, fontWeight: '700', marginTop: 6 },
});
