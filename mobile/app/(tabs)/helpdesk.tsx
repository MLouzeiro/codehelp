import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  StyleSheet, Dimensions, Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useHelpdeskStore } from '../../src/stores/helpdeskStore';
import { usePolling } from '../../src/hooks/usePolling';
import { Badge } from '../../src/components/ui/Card';
import { LoadingScreen, EmptyState } from '../../src/components/ui/Feedback';
import type { HelpdeskTicket, EtapaSlug } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ETAPA_COLORS: Record<string, string> = {
  fila: '#64748b',
  triagem: '#f59e0b',
  em_atendimento: '#3b82f6',
  aguardando_cliente: '#f97316',
  aguardando_os: '#8b5cf6',
  concluido: '#22c55e',
};

const ETAPA_LABELS: Record<string, string> = {
  fila: 'Fila',
  triagem: 'Triagem',
  em_atendimento: 'Atendimento',
  aguardando_cliente: 'Aguard. Cliente',
  aguardando_os: 'Aguard. OS',
  concluido: 'Concluido',
};

export default function HelpdeskScreen() {
  const { colors } = useTheme();
  const { kanbanData, loading, loadKanban, orderBy, setOrderBy } = useHelpdeskStore();
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadKanban(); }, []);
  usePolling(loadKanban, 10000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadKanban().finally(() => setRefreshing(false));
  }, [loadKanban]);

  const filteredTickets = useCallback(() => {
    if (!kanbanData) return [];
    let tickets: HelpdeskTicket[] = [];
    Object.entries(kanbanData.board).forEach(([slug, col]) => {
      if (selectedStage === 'all' || selectedStage === slug) {
        tickets = [...tickets, ...col.items.map((t) => ({ ...t, etapa: slug as EtapaSlug }))];
      }
    });
    if (search.trim()) {
      const s = search.toLowerCase();
      tickets = tickets.filter((t) =>
        t.protocolo?.toLowerCase().includes(s) ||
        t.contactName?.toLowerCase().includes(s) ||
        t.assunto?.toLowerCase().includes(s) ||
        t.client?.razaoSocial?.toLowerCase().includes(s)
      );
    }
    return tickets;
  }, [kanbanData, selectedStage, search]);

  const getStageCount = (slug: string) => {
    return kanbanData?.board[slug as EtapaSlug]?.items.length || 0;
  };

  const totalCount = kanbanData
    ? Object.values(kanbanData.board).reduce((acc, col) => acc + col.items.length, 0)
    : 0;

  if (loading && !kanbanData) return <LoadingScreen />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar por protocolo, nome, assunto..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Stage filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
        <Pressable
          onPress={() => setSelectedStage('all')}
          style={[styles.chip, {
            backgroundColor: selectedStage === 'all' ? colors.primary : colors.bgCard,
            borderColor: selectedStage === 'all' ? colors.primary : colors.border,
          }]}
        >
          <Text style={[styles.chipText, {
            color: selectedStage === 'all' ? '#fff' : colors.text,
          }]}>
            Todos ({totalCount})
          </Text>
        </Pressable>
        {kanbanData?.etapas?.filter((e) => e.ativo !== false).map((etapa) => (
          <Pressable
            key={etapa.slug}
            onPress={() => setSelectedStage(etapa.slug)}
            style={[styles.chip, {
              backgroundColor: selectedStage === etapa.slug
                ? (ETAPA_COLORS[etapa.slug] || colors.primary)
                : colors.bgCard,
              borderColor: selectedStage === etapa.slug
                ? (ETAPA_COLORS[etapa.slug] || colors.primary)
                : colors.border,
            }]}
          >
            <Text style={[styles.chipText, {
              color: selectedStage === etapa.slug ? '#fff' : colors.text,
            }]}>
              {ETAPA_LABELS[etapa.slug] || etapa.nome} ({getStageCount(etapa.slug)})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Ticket list */}
      <ScrollView
        style={styles.ticketList}
        contentContainerStyle={styles.ticketListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filteredTickets().length === 0 ? (
          <EmptyState icon="🎫" title="Nenhum chamado encontrado" description="Não há chamados nesta fila" />
        ) : (
          filteredTickets().map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              colors={colors}
              onPress={() => router.push(`/(modals)/ticket/${ticket.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function TicketCard({ ticket, colors, onPress }: { ticket: HelpdeskTicket; colors: any; onPress: () => void }) {
  const stageColor = ETAPA_COLORS[ticket.etapa] || '#64748b';
  const priorityColor =
    ticket.prioridade === 'urgente' ? '#ef4444' :
    ticket.prioridade === 'alta' ? '#f59e0b' :
    ticket.prioridade === 'media' ? '#3b82f6' : '#64748b';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ticketCard, {
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
        borderLeftColor: stageColor,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={styles.ticketHeader}>
        <Text style={[styles.ticketProtocol, { color: stageColor }]}>
          {ticket.protocolo || ticket.id.slice(0, 8)}
        </Text>
        <Badge text={ticket.prioridade} color={priorityColor} size="sm" />
      </View>

      <Text style={[styles.ticketSubject, { color: colors.text }]} numberOfLines={1}>
        {ticket.assunto || ticket.contactName || 'Sem assunto'}
      </Text>

      {ticket.client?.razaoSocial && (
        <Text style={[styles.ticketClient, { color: colors.textSecondary }]} numberOfLines={1}>
          🏢 {ticket.client.razaoSocial}
        </Text>
      )}

      <View style={styles.ticketFooter}>
        <View style={styles.ticketMeta}>
          {ticket.contactName && (
            <Text style={[styles.ticketMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
              👤 {ticket.contactName}
            </Text>
          )}
        </View>
        {ticket.assignee && (
          <Text style={[styles.ticketAgent, { color: colors.textSecondary }]} numberOfLines={1}>
            → {ticket.assignee.name}
          </Text>
        )}
      </View>

      <View style={styles.ticketBottom}>
        <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
          {ticket.tempoDecorridoMin != null
            ? ticket.tempoDecorridoMin < 60
              ? `${ticket.tempoDecorridoMin}min`
              : `${Math.floor(ticket.tempoDecorridoMin / 60)}h${ticket.tempoDecorridoMin % 60 > 0 ? `${ticket.tempoDecorridoMin % 60}m` : ''}`
            : ''}
        </Text>
        {ticket._count && (
          <Text style={[styles.ticketCount, { color: colors.textSecondary }]}>
            💬 {ticket._count.messages} 📋 {ticket._count.orders}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8 },
  chipsScroll: { maxHeight: 48 },
  chipsContainer: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  ticketList: { flex: 1 },
  ticketListContent: { padding: 12, paddingTop: 4 },
  ticketCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketProtocol: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  ticketSubject: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  ticketClient: { fontSize: 13, marginBottom: 4 },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  ticketMeta: { flex: 1 },
  ticketMetaText: { fontSize: 12 },
  ticketAgent: { fontSize: 12, marginLeft: 8 },
  ticketBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  ticketTime: { fontSize: 11 },
  ticketCount: { fontSize: 11 },
});
