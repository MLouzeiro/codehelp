import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/services/theme';
import { useHelpdeskStore } from '../../../src/stores/helpdeskStore';
import { usePolling } from '../../../src/hooks/usePolling';
import { Badge } from '../../../src/components/ui/Card';
import { Avatar } from '../../../src/components/ui/Avatar';
import { LoadingScreen, EmptyState } from '../../../src/components/ui/Feedback';
import api from '../../../src/services/api';
import type { TicketMessage, TicketHistory, EtapaSlug } from '../../../src/types';

type Tab = 'chat' | 'info' | 'historico';

const ETAPAS = [
  { slug: 'fila', label: 'Fila', color: '#64748b' },
  { slug: 'triagem', label: 'Triagem', color: '#f59e0b' },
  { slug: 'em_atendimento', label: 'Em Atendimento', color: '#3b82f6' },
  { slug: 'aguardando_cliente', label: 'Aguard. Cliente', color: '#f97316' },
  { slug: 'aguardando_os', label: 'Aguard. OS', color: '#8b5cf6' },
  { slug: 'concluido', label: 'Concluido', color: '#22c55e' },
];

const CATEGORIAS = [
  'suporte_tecnico', 'duvida_faturamento', 'solicitacao_mudanca',
  'treinamento', 'reclamacao', 'orcamento', 'agendamento', 'outro',
];
const TIPOS = ['bug', 'duvida', 'solicitacao', 'reclamacao'];
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];

const PRIORIDADE_COLORS: Record<string, string> = {
  urgente: '#ef4444', alta: '#f59e0b', media: '#3b82f6', baixa: '#64748b',
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const {
    selectedTicket, detailLoading, loadTicketDetail,
    sendMessage, assumeTicket, resolveTicket, moveTicket, triageTicket,
  } = useHelpdeskStore();

  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triageForm, setTriageForm] = useState({
    assunto: '', categoria: '', tipo: '', prioridade: 'media',
  });
  const [savingTriage, setSavingTriage] = useState(false);
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) {
      loadTicketDetail(id);
      const t = selectedTicket?.ticket;
      if (t) {
        setTriageForm((f) => ({ ...f, assunto: t.assunto || '', prioridade: t.prioridade || 'media' }));
      }
    }
  }, [id]);

  usePolling(() => { if (id && activeTab === 'chat') loadTicketDetail(id); }, 5000);

  const handleSend = async () => {
    if (!messageText.trim() || !id) return;
    setSending(true);
    try {
      await sendMessage(id, messageText.trim());
      setMessageText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAssume = () => {
    if (!id) return;
    Alert.alert('Assumir chamado', 'Deseja assumir este chamado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Assumir', onPress: async () => {
          try { await assumeTicket(id); }
          catch (err: any) { Alert.alert('Erro', err.message); }
        },
      },
    ]);
  };

  const handleResolve = () => {
    if (!id) return;
    Alert.alert('Resolver chamado', 'Deseja marcar este chamado como resolvido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resolver', style: 'destructive', onPress: async () => {
          try { await resolveTicket(id); router.back(); }
          catch (err: any) { Alert.alert('Erro', err.message); }
        },
      },
    ]);
  };

  const handleMove = async (toStage: EtapaSlug) => {
    if (!id || ticket?.etapa === toStage) return;
    setMovingTo(toStage);
    try {
      await moveTicket(id, toStage);
      setShowMoveModal(false);
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setMovingTo(null);
    }
  };

  const handleTriage = async () => {
    if (!id || !triageForm.assunto.trim()) {
      Alert.alert('Erro', 'Preencha o assunto do chamado');
      return;
    }
    setSavingTriage(true);
    try {
      await triageTicket(id, {
        assunto: triageForm.assunto.trim(),
        categoria: triageForm.categoria || undefined,
        tipo: triageForm.tipo || undefined,
        prioridade: triageForm.prioridade || undefined,
      });
      setShowTriageModal(false);
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSavingTriage(false);
    }
  };

  const handleEscalar = () => {
    if (!id) return;
    Alert.alert('Escalar chamado', 'Deseja escalar para um nivel superior?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Escalar', onPress: async () => {
          try {
            await api.post(`/helpdesk/tickets/${id}/escalar`);
            await loadTicketDetail(id);
            Alert.alert('Sucesso', 'Chamado escalado com sucesso');
          } catch (err: any) {
            Alert.alert('Erro', err.response?.data?.error || 'Erro ao escalar');
          }
        },
      },
    ]);
  };

  if (detailLoading && !selectedTicket) return <LoadingScreen />;

  const ticket = selectedTicket?.ticket;
  const messages = ticket?.messages || [];
  const history = selectedTicket?.history || [];
  const orders = ticket?.orders || [];

  if (!ticket) return <EmptyState icon="🎫" title="Chamado nao encontrado" />;

  const etapaInfo = ETAPAS.find((e) => e.slug === ticket.etapa);
  const etapaColor = etapaInfo?.color || '#64748b';
  const etapaLabel = etapaInfo?.label || ticket.etapa;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {ticket.protocolo || ticket.id.slice(0, 8)}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {ticket.assunto || ticket.contactName || 'Sem assunto'}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowMoveModal(true)}
          style={[styles.stageBadge, { backgroundColor: etapaColor + '20', borderColor: etapaColor }]}
        >
          <Text style={[styles.stageText, { color: etapaColor }]}>{etapaLabel}</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        {(['chat', 'info', 'historico'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && [styles.tabActive, { borderBottomColor: colors.primary }]]}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab === 'chat' ? '💬 Chat' : tab === 'info' ? 'ℹ️ Info' : '📋 Historico'}
            </Text>
            {tab === 'chat' && messages.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.tabBadgeText}>{messages.length > 99 ? '99+' : messages.length}</Text>
              </View>
            )}
            {tab === 'historico' && history.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#64748b' }]}>
                <Text style={styles.tabBadgeText}>{history.length > 99 ? '99+' : history.length}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── CHAT TAB ── */}
      {activeTab === 'chat' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 135 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <EmptyState icon="💬" title="Nenhuma mensagem" description="Envie uma mensagem para iniciar a conversa" />
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} colors={colors} />)
            )}
          </ScrollView>

          <View style={[styles.inputBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bgInput }]}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={colors.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
              style={[styles.sendBtn, { backgroundColor: messageText.trim() ? colors.primary : colors.bgInput }]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color={messageText.trim() ? '#fff' : colors.textSecondary} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── INFO TAB ── */}
      {activeTab === 'info' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.infoContent}>
          {/* Status chips */}
          <View style={styles.chipRow}>
            {ticket.prioridade && (
              <Badge text={ticket.prioridade} color={PRIORIDADE_COLORS[ticket.prioridade] || '#64748b'} />
            )}
            {ticket.categoria && <Badge text={ticket.categoria.replace(/_/g, ' ')} color="#8b5cf6" />}
            {ticket.status && <Badge text={ticket.status} color="#64748b" />}
          </View>

          {/* Quick actions */}
          <View style={styles.actionsRow}>
            {!ticket.assignee && (
              <Pressable onPress={handleAssume} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="person-add" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Assumir</Text>
              </Pressable>
            )}
            {ticket.etapa === 'triagem' && (
              <Pressable onPress={() => setShowTriageModal(true)} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}>
                <Ionicons name="git-merge-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Triar</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setShowMoveModal(true)} style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}>
              <Ionicons name="arrow-forward-circle-outline" size={15} color="#fff" />
              <Text style={styles.actionBtnText}>Mover</Text>
            </Pressable>
            <Pressable onPress={handleEscalar} style={[styles.actionBtn, { backgroundColor: '#f97316' }]}>
              <Ionicons name="trending-up-outline" size={15} color="#fff" />
              <Text style={styles.actionBtnText}>Escalar</Text>
            </Pressable>
            <Pressable onPress={handleResolve} style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
              <Text style={styles.actionBtnText}>Resolver</Text>
            </Pressable>
          </View>

          {/* Ticket data */}
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Dados do Chamado</Text>
            <DataRow label="Protocolo" value={ticket.protocolo} colors={colors} />
            <DataRow label="Assunto" value={ticket.assunto} colors={colors} />
            <DataRow label="Contato" value={ticket.contactName} colors={colors} />
            <DataRow label="Telefone" value={ticket.contactPhone} colors={colors} />
            <DataRow label="Tipo" value={ticket.tipo} colors={colors} />
            <DataRow label="Observacoes" value={ticket.observacoes} colors={colors} />
            <DataRow
              label="Abertura"
              value={new Date(ticket.dataAbertura).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
              colors={colors}
            />
            {ticket.dataInicioAtendimento && (
              <DataRow
                label="Inicio atend."
                value={new Date(ticket.dataInicioAtendimento).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
                colors={colors}
              />
            )}
            {ticket.departamento && (
              <DataRow label="Departamento" value={ticket.departamento.nome} colors={colors} />
            )}
            {ticket.nivel && (
              <DataRow label="Nivel" value={ticket.nivel.nome} colors={colors} />
            )}
          </View>

          {/* Client */}
          {ticket.client && (
            <Pressable
              onPress={() => router.push(`/(modals)/client/${ticket.client!.id}`)}
              style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Cliente</Text>
              <View style={styles.personRow}>
                <Avatar name={ticket.client.razaoSocial || '?'} size={40} />
                <View style={styles.personInfo}>
                  <Text style={[styles.personName, { color: colors.text }]}>{ticket.client.razaoSocial}</Text>
                  {ticket.client.telefone && (
                    <Text style={[styles.personSub, { color: colors.textSecondary }]}>{ticket.client.telefone}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </Pressable>
          )}

          {/* Assignee */}
          {ticket.assignee && (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Responsavel</Text>
              <View style={styles.personRow}>
                <Avatar name={ticket.assignee.name} size={40} />
                <View style={styles.personInfo}>
                  <Text style={[styles.personName, { color: colors.text }]}>{ticket.assignee.name}</Text>
                  <Text style={[styles.personSub, { color: colors.textSecondary }]}>{ticket.assignee.email}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Linked orders */}
          {orders.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Ordens de Servico ({orders.length})</Text>
              {orders.map((order, idx) => (
                <Pressable
                  key={order.id}
                  onPress={() => router.push(`/(modals)/order/${order.id}`)}
                  style={[styles.orderRow, {
                    borderBottomColor: colors.border,
                    borderBottomWidth: idx < orders.length - 1 ? StyleSheet.hairlineWidth : 0,
                  }]}
                >
                  <View style={styles.orderInfo}>
                    <Text style={[styles.orderNum, { color: colors.primary }]}>
                      OS #{order.numero || order.id.slice(0, 8)}
                    </Text>
                    <Text style={[styles.orderTitle, { color: colors.text }]} numberOfLines={1}>
                      {order.titulo}
                    </Text>
                  </View>
                  <Badge text={order.status} color="#64748b" size="sm" />
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── HISTORICO TAB ── */}
      {activeTab === 'historico' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.historyList}>
          {history.length === 0 ? (
            <EmptyState icon="📋" title="Sem historico" description="Nenhuma acao registrada ainda" />
          ) : (
            history.map((item, idx) => (
              <HistoryItem key={item.id} item={item} colors={colors} isLast={idx === history.length - 1} />
            ))
          )}
        </ScrollView>
      )}

      {/* ── MODAL: MOVER ETAPA ── */}
      <Modal visible={showMoveModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoveModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Mover para etapa</Text>
            <View style={styles.moveGrid}>
              {ETAPAS.map((etapa) => {
                const isAtual = ticket.etapa === etapa.slug;
                const isMoving = movingTo === etapa.slug;
                return (
                  <Pressable
                    key={etapa.slug}
                    onPress={() => handleMove(etapa.slug as EtapaSlug)}
                    disabled={isAtual || !!movingTo}
                    style={[styles.moveBtn, {
                      backgroundColor: isAtual ? etapa.color + '25' : etapa.color + '12',
                      borderColor: etapa.color,
                      opacity: isAtual ? 0.6 : 1,
                    }]}
                  >
                    {isMoving ? (
                      <ActivityIndicator color={etapa.color} size="small" />
                    ) : (
                      <>
                        <Text style={[styles.moveBtnLabel, { color: etapa.color }]}>{etapa.label}</Text>
                        {isAtual && (
                          <Text style={[styles.moveBtnCurrent, { color: etapa.color }]}>✓ atual</Text>
                        )}
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── MODAL: TRIAGEM ── */}
      <Modal visible={showTriageModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Triagem do Chamado</Text>
              <Pressable onPress={() => setShowTriageModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.formLabel, { color: colors.text }]}>Assunto *</Text>
              <TextInput
                style={[styles.formInput, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
                placeholder="Descreva o assunto..."
                placeholderTextColor={colors.textSecondary}
                value={triageForm.assunto}
                onChangeText={(t) => setTriageForm((f) => ({ ...f, assunto: t }))}
              />

              <Text style={[styles.formLabel, { color: colors.text }]}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {CATEGORIAS.map((cat) => {
                  const selected = triageForm.categoria === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setTriageForm((f) => ({ ...f, categoria: selected ? '' : cat }))}
                      style={[styles.formChip, {
                        backgroundColor: selected ? colors.primary : colors.bgInput,
                        borderColor: selected ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[styles.formChipText, { color: selected ? '#fff' : colors.text }]}>
                        {cat.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.formLabel, { color: colors.text }]}>Tipo</Text>
              <View style={styles.chipsInline}>
                {TIPOS.map((tipo) => {
                  const selected = triageForm.tipo === tipo;
                  return (
                    <Pressable
                      key={tipo}
                      onPress={() => setTriageForm((f) => ({ ...f, tipo: selected ? '' : tipo }))}
                      style={[styles.formChip, {
                        backgroundColor: selected ? '#8b5cf6' : colors.bgInput,
                        borderColor: selected ? '#8b5cf6' : colors.border,
                      }]}
                    >
                      <Text style={[styles.formChipText, { color: selected ? '#fff' : colors.text }]}>{tipo}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.formLabel, { color: colors.text }]}>Prioridade</Text>
              <View style={styles.chipsInline}>
                {PRIORIDADES.map((p) => {
                  const selected = triageForm.prioridade === p;
                  const pColor = PRIORIDADE_COLORS[p] || '#64748b';
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setTriageForm((f) => ({ ...f, prioridade: p }))}
                      style={[styles.formChip, {
                        backgroundColor: selected ? pColor : colors.bgInput,
                        borderColor: selected ? pColor : colors.border,
                      }]}
                    >
                      <Text style={[styles.formChipText, { color: selected ? '#fff' : colors.text }]}>{p}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={handleTriage}
                disabled={savingTriage}
                style={[styles.submitBtn, { backgroundColor: savingTriage ? '#94a3b8' : colors.primary }]}
              >
                {savingTriage ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirmar Triagem</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MessageBubble({ message, colors }: { message: TicketMessage; colors: any }) {
  const isMe = message.fromMe;
  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, {
      backgroundColor: isMe ? colors.primary + '15' : colors.bgCard,
      borderColor: isMe ? colors.primary + '30' : colors.border,
    }]}>
      {!isMe && message.senderName && (
        <Text style={[styles.senderName, { color: colors.primary }]}>{message.senderName}</Text>
      )}
      <Text style={[styles.bubbleText, { color: colors.text }]}>{message.content}</Text>
      <Text style={[styles.bubbleTime, { color: colors.textSecondary }]}>
        {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function HistoryItem({ item, colors, isLast }: { item: TicketHistory; colors: any; isLast: boolean }) {
  return (
    <View style={styles.historyItem}>
      <View style={styles.historyTimeline}>
        <View style={[styles.historyDot, { backgroundColor: colors.primary }]} />
        {!isLast && <View style={[styles.historyLine, { backgroundColor: colors.border }]} />}
      </View>
      <View style={[styles.historyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.historyAction, { color: colors.text }]}>{item.action}</Text>
        {(item.from || item.to) && (
          <Text style={[styles.historyChange, { color: colors.textSecondary }]}>
            {[item.from && `De: ${item.from}`, item.to && `Para: ${item.to}`].filter(Boolean).join('  →  ')}
          </Text>
        )}
        <View style={styles.historyMeta}>
          {item.usuario && (
            <Text style={[styles.historyUser, { color: colors.primary }]}>👤 {item.usuario.name}</Text>
          )}
          <Text style={[styles.historyTime, { color: colors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DataRow({ label, value, colors }: { label: string; value?: string | null; colors: any }) {
  if (!value) return null;
  return (
    <View style={[styles.dataRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  stageBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, marginLeft: 8,
  },
  stageText: { fontSize: 11, fontWeight: '700' },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 11, gap: 4,
  },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontWeight: '600' },
  tabBadge: {
    minWidth: 17, height: 17, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Chat
  messagesContent: { padding: 12, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 8 },
  bubbleMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, paddingBottom: 30, borderTopWidth: 1, gap: 8,
  },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 14, maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // Info tab
  infoContent: { padding: 12, paddingBottom: 32 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, gap: 4,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  dataRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dataLabel: { fontSize: 13, flex: 0 },
  dataValue: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 16 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personInfo: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '600' },
  personSub: { fontSize: 12, marginTop: 2 },
  orderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 8,
  },
  orderInfo: { flex: 1 },
  orderNum: { fontSize: 12, fontWeight: '700' },
  orderTitle: { fontSize: 13 },

  // History tab
  historyList: { padding: 16, paddingBottom: 32 },
  historyItem: { flexDirection: 'row', marginBottom: 4 },
  historyTimeline: { width: 24, alignItems: 'center', paddingTop: 14 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyLine: { flex: 1, width: 2, marginTop: 4 },
  historyCard: {
    flex: 1, marginLeft: 12, borderRadius: 12, borderWidth: 1,
    padding: 10, marginBottom: 10,
  },
  historyAction: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  historyChange: { fontSize: 12, marginBottom: 6 },
  historyMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyUser: { fontSize: 11, fontWeight: '600' },
  historyTime: { fontSize: 11 },

  // Move modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 40, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moveBtn: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    minWidth: '44%', flex: 1, alignItems: 'center',
  },
  moveBtnLabel: { fontSize: 13, fontWeight: '700' },
  moveBtnCurrent: { fontSize: 10, marginTop: 2 },

  // Triage modal form
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  formInput: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  chipsScroll: { maxHeight: 48, marginBottom: 4 },
  chipsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, marginRight: 6, marginBottom: 4,
  },
  formChipText: { fontSize: 12, fontWeight: '500' },
  submitBtn: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20, marginBottom: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
