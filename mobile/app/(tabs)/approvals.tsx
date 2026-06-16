import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { usePolling } from '../../src/hooks/usePolling';
import { Badge } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { EmptyState } from '../../src/components/ui/Feedback';
import api from '../../src/services/api';
import type { Aprovacao } from '../../src/types';

const STATUS_COLORS: Record<string, string> = {
  pendente: '#f59e0b',
  aprovada: '#22c55e',
  rejeitada: '#ef4444',
};

export default function ApprovalsTabScreen() {
  const { colors } = useTheme();
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('pendente');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/aprovacoes', { params: { status: filter, limit: 50 } });
      setAprovacoes(data.items || data || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  usePolling(load, 30000);

  const handleDecide = async (id: string, decisao: 'aprovada' | 'rejeitada') => {
    Alert.alert(
      decisao === 'aprovada' ? 'Aprovar' : 'Rejeitar',
      `Deseja ${decisao === 'aprovada' ? 'aprovar' : 'rejeitar'} esta solicitacao?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await api.post(`/aprovacoes/${id}/decidir`, { decisao });
              load();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error || 'Erro ao processar');
            }
          },
        },
      ]
    );
  };

  const renderItem = useCallback(({ item }: { item: Aprovacao }) => (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Badge text={item.tipo} color="#8b5cf6" size="sm" />
        <Badge text={item.status} color={STATUS_COLORS[item.status] || '#64748b'} size="sm" />
      </View>

      <Text style={[styles.motivo, { color: colors.text }]}>{item.motivo}</Text>

      {item.observacao && (
        <Text style={[styles.obs, { color: colors.textSecondary }]}>{item.observacao}</Text>
      )}

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Avatar name={item.solicitadoPor?.name || '?'} size={20} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {item.solicitadoPor?.name}
          </Text>
        </View>
        <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
          {new Date(item.dataSolicitacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {item.ticket && (
        <Pressable onPress={() => router.push(`/(modals)/ticket/${item.ticket.id}`)}>
          <Text style={[styles.ticketLink, { color: colors.primary }]}>
            🎫 {item.ticket.protocolo || item.ticket.id.slice(0, 8)} — {item.ticket.assunto || 'Ver ticket'}
          </Text>
        </Pressable>
      )}

      {item.status === 'pendente' && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => handleDecide(item.id, 'aprovada')}
            style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.actionText}>Aprovar</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDecide(item.id, 'rejeitada')}
            style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
          >
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.actionText}>Rejeitar</Text>
          </Pressable>
        </View>
      )}
    </View>
  ), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.chips}>
        {['pendente', 'aprovada', 'rejeitada'].map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, {
              backgroundColor: filter === f ? (STATUS_COLORS[f] || colors.primary) : colors.bgCard,
              borderColor: filter === f ? (STATUS_COLORS[f] || colors.primary) : colors.border,
            }]}
          >
            <Text style={[styles.chipText, { color: filter === f ? '#fff' : colors.text }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={aprovacoes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? (
          <EmptyState icon="✅" title="Nenhuma aprovacao" description={`Nenhuma aprovacao ${filter}`} />
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chips: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  motivo: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  obs: { fontSize: 13, marginBottom: 8, fontStyle: 'italic' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
  metaDate: { fontSize: 11 },
  ticketLink: { fontSize: 13, fontWeight: '500', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 4,
  },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
