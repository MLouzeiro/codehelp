import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { usePolling } from '../../src/hooks/usePolling';
import { StatCard } from '../../src/components/ui/Card';
import { LoadingScreen, ErrorState } from '../../src/components/ui/Feedback';
import api from '../../src/services/api';
import type { DashboardMetrics } from '../../src/types';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [metricsRes, kpisRes] = await Promise.all([
        api.get('/analytics/kpis').catch(() => ({ data: null })),
        api.get('/analytics/dashboard').catch(() => ({ data: null })),
      ]);
      setMetrics(metricsRes.data);
      setKpis(kpisRes.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  usePolling(loadData, 30000);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.statsGrid}>
        <StatCard
          title="Chamados Abertos"
          value={kpis?.ticketsAbertos ?? kpis?.backlog?.total ?? 0}
          icon={<Ionicons name="ticket-outline" size={20} color="#3b82f6" />}
          color="#3b82f6"
        />
        <StatCard
          title="Em Atendimento"
          value={kpis?.ticketsEmAtendimento ?? 0}
          icon={<Ionicons name="headset-outline" size={20} color="#f59e0b" />}
          color="#f59e0b"
        />
        <StatCard
          title="Resolvidos"
          value={kpis?.ticketsResolvidos ?? 0}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />}
          color="#22c55e"
        />
        <StatCard
          title="SLA Vencidos"
          value={kpis?.slaVencidos ?? kpis?.sla?.violados ?? 0}
          icon={<Ionicons name="warning-outline" size={20} color="#ef4444" />}
          color="#ef4444"
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title="CSAT Medio"
          value={kpis?.csatMedio?.toFixed(1) ?? kpis?.csat?.mediaNotas?.toFixed(1) ?? '-'}
          icon={<Ionicons name="star-outline" size={20} color="#8b5cf6" />}
          color="#8b5cf6"
        />
        <StatCard
          title="Tempo Medio"
          value={kpis?.tempoMedioResposta ? `${Math.round(kpis.tempoMedioResposta)}min` : metrics?.mttr?.mediaMinutos ? `${Math.round(metrics.mttr.mediaMinutos)}min` : '-'}
          icon={<Ionicons name="time-outline" size={20} color="#14b8a6" />}
          color="#14b8a6"
        />
      </View>

      {metrics?.porAgente && metrics.porAgente.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance por Agente</Text>
          {metrics.porAgente.slice(0, 5).map((agente) => (
            <View key={agente.usuarioId} style={[styles.agentRow, { borderBottomColor: colors.border }]}>
              <View style={styles.agentInfo}>
                <Text style={[styles.agentName, { color: colors.text }]}>{agente.nome}</Text>
                <Text style={[styles.agentStat, { color: colors.textSecondary }]}>
                  {agente.ticketsAtendidos} tickets • MTTR {Math.round(agente.mttrMedioMin)}min
                </Text>
              </View>
              <Text style={[styles.agentScore, { color: agente.csatMedio && agente.csatMedio >= 4 ? '#22c55e' : colors.textSecondary }]}>
                {agente.csatMedio ? `⭐ ${agente.csatMedio.toFixed(1)}` : '-'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {metrics?.porCategoria && metrics.porCategoria.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Por Categoria</Text>
          {metrics.porCategoria.slice(0, 5).map((cat) => (
            <View key={cat.categoria} style={styles.catRow}>
              <Text style={[styles.catName, { color: colors.text }]}>{cat.categoria || 'Sem categoria'}</Text>
              <View style={styles.catBar}>
                <View style={[styles.catBarFill, { width: `${cat.percentual}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.catPercent, { color: colors.textSecondary }]}>{cat.percentual.toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  section: { borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  agentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  agentInfo: { flex: 1 },
  agentName: { fontSize: 14, fontWeight: '600' },
  agentStat: { fontSize: 12, marginTop: 2 },
  agentScore: { fontSize: 14, fontWeight: '600' },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  catName: { fontSize: 13, width: 100 },
  catBar: { flex: 1, height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 4 },
  catPercent: { fontSize: 12, width: 40, textAlign: 'right' },
});
