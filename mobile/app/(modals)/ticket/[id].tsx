import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/services/theme';
import { useHelpdeskStore } from '../../../src/stores/helpdeskStore';
import { usePolling } from '../../../src/hooks/usePolling';
import { Badge } from '../../../src/components/ui/Card';
import { Avatar } from '../../../src/components/ui/Avatar';
import { LoadingScreen, EmptyState } from '../../../src/components/ui/Feedback';
import type { TicketMessage } from '../../../src/types';

const ETAPA_COLORS: Record<string, string> = {
  fila: '#64748b', triagem: '#f59e0b', em_atendimento: '#3b82f6',
  aguardando_cliente: '#f97316', aguardando_os: '#8b5cf6', concluido: '#22c55e',
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { selectedTicket, detailLoading, loadTicketDetail, sendMessage, assumeTicket, resolveTicket, moveTicket } = useHelpdeskStore();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) loadTicketDetail(id);
  }, [id]);

  usePolling(() => { if (id) loadTicketDetail(id); }, 5000);

  const handleSend = async () => {
    if (!messageText.trim() || !id) return;
    setSending(true);
    try {
      await sendMessage(id, messageText.trim());
      setMessageText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAssume = async () => {
    if (!id) return;
    try { await assumeTicket(id); } catch (err: any) { alert(err.message); }
  };

  const handleResolve = async () => {
    if (!id) return;
    try { await resolveTicket(id); } catch (err: any) { alert(err.message); }
  };

  if (detailLoading && !selectedTicket) return <LoadingScreen />;

  const ticket = selectedTicket?.ticket;
  const messages = ticket?.messages || [];

  if (!ticket) return <EmptyState icon="🎫" title="Ticket nao encontrado" />;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {ticket.protocolo || ticket.id.slice(0, 8)}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {ticket.assunto || ticket.contactName || 'Sem assunto'}
          </Text>
        </View>
        <View style={[styles.stageDot, { backgroundColor: ETAPA_COLORS[ticket.etapa] || '#64748b' }]} />
      </View>

      {/* Ticket info bar */}
      <View style={[styles.infoBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        {ticket.prioridade && <Badge text={ticket.prioridade} color={
          ticket.prioridade === 'urgente' ? '#ef4444' : ticket.prioridade === 'alta' ? '#f59e0b' : '#3b82f6'
        } size="sm" />}
        {ticket.categoria && <Badge text={ticket.categoria} color="#8b5cf6" size="sm" />}
        {ticket.client?.razaoSocial && (
          <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
            🏢 {ticket.client.razaoSocial}
          </Text>
        )}
        {ticket.assignee && (
          <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
            👤 {ticket.assignee.name}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      {!ticket.assignee && (
        <View style={[styles.actions, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleAssume} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.actionText}>Assumir</Text>
          </Pressable>
          <Pressable onPress={handleResolve} style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionText}>Resolver</Text>
          </Pressable>
        </View>
      )}

      {ticket.assignee && (
        <View style={[styles.actions, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleResolve} style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionText}>Resolver</Text>
          </Pressable>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <EmptyState icon="💬" title="Nenhuma mensagem" />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} colors={colors} />)
        )}
      </ScrollView>

      {/* Input */}
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
          style={[styles.sendBtn, {
            backgroundColor: messageText.trim() ? colors.primary : colors.bgInput,
          }]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color={messageText.trim() ? '#fff' : colors.textSecondary} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  stageDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  infoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  infoText: { fontSize: 12 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  messages: { flex: 1 },
  messagesContent: { padding: 12, paddingBottom: 8 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  bubbleMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
