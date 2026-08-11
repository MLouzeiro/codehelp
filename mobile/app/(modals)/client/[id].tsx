import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/services/theme';
import { useCrmStore } from '../../../src/stores/crmStore';
import { Avatar } from '../../../src/components/ui/Avatar';
import { Badge } from '../../../src/components/ui/Card';
import { LoadingScreen, EmptyState } from '../../../src/components/ui/Feedback';

const ETAPA_COLORS: Record<string, string> = {
  fila: '#64748b', triagem: '#f59e0b', em_atendimento: '#3b82f6',
  aguardando_cliente: '#f97316', aguardando_os: '#8b5cf6', concluido: '#22c55e',
};

const PRIORIDADE_COLORS: Record<string, string> = {
  urgente: '#ef4444', alta: '#f59e0b', media: '#3b82f6', baixa: '#64748b',
};

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
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Avatar name={c.razaoSocial || '?'} size={60} />
        <Text style={[styles.name, { color: colors.text }]}>{c.razaoSocial}</Text>
        {c.nomeFantasia && (
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{c.nomeFantasia}</Text>
        )}
        {c.status && (
          <Badge
            text={c.status}
            color={c.status === 'ativo' ? '#22c55e' : c.status === 'inativo' ? '#ef4444' : '#64748b'}
          />
        )}
      </View>

      {/* Stats row */}
      {c._count && (
        <View style={[styles.statsRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <StatItem label="Tickets" value={c._count.tickets} icon="🎫" colors={colors} />
          <StatItem label="Oportunidades" value={c._count.opportunities} icon="💼" colors={colors} />
          <StatItem label="Contatos" value={c._count.contacts} icon="👤" colors={colors} />
          <StatItem label="OS" value={c._count.serviceOrders} icon="📋" colors={colors} />
        </View>
      )}

      {/* Contact info */}
      <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Informacoes</Text>
        <InfoRow icon="📄" label="CNPJ/CPF" value={c.cnpjCpf} colors={colors} />
        <InfoRow
          icon="📧" label="Email" value={c.email} colors={colors}
          onPress={c.email ? () => Linking.openURL(`mailto:${c.email}`) : undefined}
        />
        <InfoRow
          icon="📞" label="Telefone" value={c.telefone} colors={colors}
          onPress={c.telefone ? () => Linking.openURL(`tel:${c.telefone}`) : undefined}
        />
        <InfoRow
          icon="📱" label="Celular" value={c.celular} colors={colors}
          onPress={c.celular ? () => Linking.openURL(`tel:${c.celular}`) : undefined}
        />
        <InfoRow icon="🏢" label="Segmento" value={c.segmento} colors={colors} />
        <InfoRow
          icon="📍" label="Cidade/UF"
          value={c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado}
          colors={colors}
        />
        <InfoRow icon="📝" label="Contrato" value={c.tipoContrato} colors={colors} />
        <InfoRow
          icon="💰" label="Mensalidade"
          value={c.valorMensalidade ? `R$ ${c.valorMensalidade.toFixed(2)}` : undefined}
          colors={colors}
        />
        <InfoRow
          icon="📅" label="Vencimento"
          value={c.diaVencimento ? `Dia ${c.diaVencimento}` : undefined}
          colors={colors}
        />
        {c.responsavelTecnico && (
          <InfoRow icon="🔧" label="Resp. Tecnico" value={c.responsavelTecnico} colors={colors} />
        )}
      </View>

      {/* Tickets recentes */}
      {c.tickets && c.tickets.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Chamados ({c.tickets.length})</Text>
          {c.tickets.slice(0, 10).map((t, idx) => {
            const etapaColor = ETAPA_COLORS[t.etapa] || '#64748b';
            const prioColor = PRIORIDADE_COLORS[t.prioridade] || '#64748b';
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/(modals)/ticket/${t.id}`)}
                style={[styles.ticketRow, {
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < (c.tickets!.length > 10 ? 9 : c.tickets!.length - 1) ? StyleSheet.hairlineWidth : 0,
                }]}
              >
                <View style={[styles.ticketEtapaDot, { backgroundColor: etapaColor }]} />
                <View style={styles.ticketInfo}>
                  <Text style={[styles.ticketProtocol, { color: etapaColor }]}>
                    {t.protocolo || t.id.slice(0, 8)}
                  </Text>
                  <Text style={[styles.ticketSubject, { color: colors.text }]} numberOfLines={1}>
                    {t.assunto || t.contactName || 'Sem assunto'}
                  </Text>
                </View>
                <Badge text={t.prioridade} color={prioColor} size="sm" />
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </Pressable>
            );
          })}
          {c.tickets.length > 10 && (
            <Text style={[styles.seeMore, { color: colors.primary }]}>
              + {c.tickets.length - 10} chamados anteriores
            </Text>
          )}
        </View>
      )}

      {/* Contatos */}
      {c.contacts && c.contacts.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contatos ({c.contacts.length})</Text>
          {c.contacts.map((contact, idx) => (
            <View
              key={contact.id}
              style={[styles.contactRow, {
                borderBottomColor: colors.border,
                borderBottomWidth: idx < c.contacts!.length - 1 ? StyleSheet.hairlineWidth : 0,
              }]}
            >
              <Avatar name={contact.nome} size={36} />
              <View style={styles.contactInfo}>
                <View style={styles.contactNameRow}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{contact.nome}</Text>
                  {contact.principal && <Badge text="Principal" color="#f59e0b" size="sm" />}
                </View>
                {contact.cargo && (
                  <Text style={[styles.contactSub, { color: colors.textSecondary }]}>{contact.cargo}</Text>
                )}
                {contact.telefone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${contact.telefone}`)}>
                    <Text style={[styles.contactPhone, { color: colors.primary }]}>
                      📞 {contact.telefone}
                    </Text>
                  </Pressable>
                )}
                {contact.email && (
                  <Pressable onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
                    <Text style={[styles.contactPhone, { color: colors.primary }]}>
                      ✉️ {contact.email}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Colaboradores */}
      {c.colaboradores && c.colaboradores.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Colaboradores ({c.colaboradores.length})</Text>
          {c.colaboradores.map((col, idx) => (
            <View
              key={col.id}
              style={[styles.contactRow, {
                borderBottomColor: colors.border,
                borderBottomWidth: idx < c.colaboradores!.length - 1 ? StyleSheet.hairlineWidth : 0,
              }]}
            >
              <Avatar name={col.nome} size={36} />
              <View style={styles.contactInfo}>
                <View style={styles.contactNameRow}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{col.nome}</Text>
                  {col.principal && <Badge text="Principal" color="#f59e0b" size="sm" />}
                </View>
                {col.cargo && (
                  <Text style={[styles.contactSub, { color: colors.textSecondary }]}>{col.cargo}</Text>
                )}
                {col.telefone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${col.telefone}`)}>
                    <Text style={[styles.contactPhone, { color: colors.primary }]}>📞 {col.telefone}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Oportunidades recentes */}
      {c.opportunities && c.opportunities.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Oportunidades ({c.opportunities.length})</Text>
          {c.opportunities.slice(0, 5).map((opp, idx) => (
            <View
              key={opp.id}
              style={[styles.oppRow, {
                borderBottomColor: colors.border,
                borderBottomWidth: idx < Math.min(c.opportunities!.length, 5) - 1 ? StyleSheet.hairlineWidth : 0,
              }]}
            >
              <View style={styles.oppInfo}>
                <Text style={[styles.oppTitle, { color: colors.text }]} numberOfLines={1}>{opp.titulo}</Text>
                {opp.valor != null && opp.valor > 0 && (
                  <Text style={[styles.oppValue, { color: colors.primary }]}>
                    R$ {opp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                )}
              </View>
              <Badge text={opp.etapa} color="#8b5cf6" size="sm" />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({
  icon, label, value, colors, onPress,
}: { icon: string; label: string; value?: string; colors: any; onPress?: () => void }) {
  if (!value) return null;
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={[styles.infoRow, { borderBottomColor: colors.border }]}
    >
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: onPress ? colors.primary : colors.text }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={15} color={colors.primary} />}
    </Comp>
  );
}

function StatItem({ label, value, icon, colors }: { label: string; value: number; icon: string; colors: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },

  profileCard: {
    alignItems: 'center', borderRadius: 16, padding: 20,
    borderWidth: 1, marginBottom: 10,
  },
  backBtn: { position: 'absolute', top: 12, left: 12 },
  name: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  sub: { fontSize: 13, marginTop: 2, textAlign: 'center', marginBottom: 6 },

  statsRow: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 10, justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', minWidth: 60 },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  section: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', marginTop: 1 },

  ticketRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 8,
  },
  ticketEtapaDot: { width: 8, height: 8, borderRadius: 4 },
  ticketInfo: { flex: 1 },
  ticketProtocol: { fontSize: 11, fontWeight: '700' },
  ticketSubject: { fontSize: 13, marginTop: 1 },
  seeMore: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingTop: 10 },

  contactRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10 },
  contactInfo: { flex: 1 },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  contactName: { fontSize: 14, fontWeight: '600' },
  contactSub: { fontSize: 12, marginTop: 2 },
  contactPhone: { fontSize: 12, marginTop: 4 },

  oppRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  oppInfo: { flex: 1 },
  oppTitle: { fontSize: 14, fontWeight: '500' },
  oppValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
