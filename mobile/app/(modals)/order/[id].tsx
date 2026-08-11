import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/services/theme';
import { useOrdersStore } from '../../../src/stores/ordersStore';
import { Avatar } from '../../../src/components/ui/Avatar';
import { Badge } from '../../../src/components/ui/Card';
import { LoadingScreen } from '../../../src/components/ui/Feedback';

const STATUS_COLORS: Record<string, string> = {
  aberta: '#3b82f6', em_atendimento: '#f59e0b', concluida: '#22c55e',
  cancelada: '#ef4444', aguardando_peca: '#8b5cf6',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { selectedOrder, loadOrder, updateStatus } = useOrdersStore();

  useEffect(() => {
    if (id) loadOrder(id);
  }, [id]);

  if (!selectedOrder) return <LoadingScreen />;

  const o = selectedOrder;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.number, { color: colors.primary }]}>
          OS #{o.numero || o.id.slice(0, 8)}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{o.titulo}</Text>
        <Badge text={o.status} color={STATUS_COLORS[o.status] || '#64748b'} />
      </View>

      <InfoRow label="Status" value={o.status} colors={colors} />
      <InfoRow label="Prioridade" value={o.prioridade} colors={colors} />
      <InfoRow label="Data Abertura" value={new Date(o.dataAbertura).toLocaleString('pt-BR')} colors={colors} />
      {o.dataConclusao && (
        <InfoRow label="Data Conclusao" value={new Date(o.dataConclusao).toLocaleString('pt-BR')} colors={colors} />
      )}
      {o.valorTotal != null && (
        <InfoRow label="Valor Total" value={`R$ ${o.valorTotal.toFixed(2)}`} colors={colors} />
      )}

      {o.client && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cliente</Text>
          <View style={styles.clientRow}>
            <Avatar name={o.client.razaoSocial || '?'} size={36} />
            <Text style={[styles.clientName, { color: colors.text }]}>{o.client.razaoSocial}</Text>
          </View>
        </View>
      )}

      {o.assignee && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tecnico</Text>
          <View style={styles.clientRow}>
            <Avatar name={o.assignee.name} size={36} />
            <Text style={[styles.clientName, { color: colors.text }]}>{o.assignee.name}</Text>
          </View>
        </View>
      )}

      {o.descricao && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Descricao</Text>
          <Text style={[styles.desc, { color: colors.text }]}>{o.descricao}</Text>
        </View>
      )}

      {o.observacoes && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Observacoes</Text>
          <Text style={[styles.desc, { color: colors.text }]}>{o.observacoes}</Text>
        </View>
      )}

      {o.status !== 'concluida' && o.status !== 'cancelada' && (
        <View style={styles.actions}>
          {o.status === 'aberta' && (
            <Pressable
              onPress={() => updateStatus(o.id, 'em_atendimento')}
              style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
            >
              <Text style={styles.actionText}>Iniciar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => updateStatus(o.id, 'concluida')}
            style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
          >
            <Text style={styles.actionText}>Concluir</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, colors }: { label: string; value?: string; colors: any }) {
  if (!value) return null;
  return (
    <View style={[styles.infoRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
  header: { alignItems: 'center', borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 12 },
  backBtn: { position: 'absolute', top: 12, left: 12 },
  number: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clientName: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
