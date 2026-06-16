import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/services/theme';
import { useCrmStore } from '../../../src/stores/crmStore';
import { Avatar } from '../../../src/components/ui/Avatar';
import { Badge } from '../../../src/components/ui/Card';
import { LoadingScreen, EmptyState } from '../../../src/components/ui/Feedback';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { selectedClient, loadClient } = useCrmStore();

  useEffect(() => {
    if (id) loadClient(id);
  }, [id]);

  if (!selectedClient) return <LoadingScreen />;

  const c = selectedClient;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Avatar name={c.razaoSocial || '?'} size={56} />
        <Text style={[styles.name, { color: colors.text }]}>{c.razaoSocial}</Text>
        {c.nomeFantasia && <Text style={[styles.sub, { color: colors.textSecondary }]}>{c.nomeFantasia}</Text>}
        {c.status && <Badge text={c.status} color={c.status === 'ativo' ? '#22c55e' : '#ef4444'} />}
      </View>

      <InfoRow icon="📄" label="CNPJ/CPF" value={c.cnpjCpf} colors={colors} />
      <InfoRow icon="📧" label="Email" value={c.email} colors={colors} onPress={c.email ? () => Linking.openURL(`mailto:${c.email}`) : undefined} />
      <InfoRow icon="📞" label="Telefone" value={c.telefone} colors={colors} onPress={c.telefone ? () => Linking.openURL(`tel:${c.telefone}`) : undefined} />
      <InfoRow icon="📱" label="Celular" value={c.celular} colors={colors} />
      <InfoRow icon="🏢" label="Segmento" value={c.segmento} colors={colors} />
      <InfoRow icon="📍" label="Cidade/UF" value={c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado} colors={colors} />
      <InfoRow icon="💰" label="Mensalidade" value={c.valorMensalidade ? `R$ ${c.valorMensalidade.toFixed(2)}` : undefined} colors={colors} />
      <InfoRow icon="📅" label="Vencimento" value={c.diaVencimento ? `Dia ${c.diaVencimento}` : undefined} colors={colors} />
      <InfoRow icon="📝" label="Contrato" value={c.tipoContrato} colors={colors} />

      {c._count && (
        <View style={[styles.statsRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <StatItem label="Tickets" value={c._count.tickets} color={colors} />
          <StatItem label="Oportunidades" value={c._count.opportunities} color={colors} />
          <StatItem label="Contatos" value={c._count.contacts} color={colors} />
          <StatItem label="OS" value={c._count.serviceOrders} color={colors} />
        </View>
      )}

      {c.colaboradores && c.colaboradores.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Colaboradores</Text>
          {c.colaboradores.map((col) => (
            <View key={col.id} style={[styles.collaboratorRow, { borderBottomColor: colors.border }]}>
              <Avatar name={col.nome} size={32} />
              <View style={styles.collabInfo}>
                <Text style={[styles.collabName, { color: colors.text }]}>{col.nome}</Text>
                {col.cargo && <Text style={[styles.collabRole, { color: colors.textSecondary }]}>{col.cargo}</Text>}
              </View>
              {col.principal && <Badge text="Principal" color="#f59e0b" size="sm" />}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, colors, onPress }: { icon: string; label: string; value?: string; colors: any; onPress?: () => void }) {
  if (!value) return null;
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={[styles.infoRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={16} color={colors.primary} />}
    </Comp>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; colors: any; color: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: color.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: color.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
  header: { alignItems: 'center', borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 12 },
  backBtn: { position: 'absolute', top: 12, left: 12 },
  name: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  sub: { fontSize: 13, marginTop: 2, textAlign: 'center' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  infoIcon: { fontSize: 20 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', marginTop: 1 },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  collaboratorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  collabInfo: { flex: 1 },
  collabName: { fontSize: 14, fontWeight: '600' },
  collabRole: { fontSize: 12 },
});
