import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { usePolling } from '../../src/hooks/usePolling';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Card';
import { LoadingScreen, EmptyState } from '../../src/components/ui/Feedback';
import api from '../../src/services/api';

interface WhatsAppTicket {
  id: string;
  contactName?: string;
  contactPhone?: string;
  client?: { razaoSocial?: string } | null;
  assignee?: { name: string } | null;
  status: string;
  lastMessage?: { content?: string; fromMe?: boolean; createdAt?: string } | null;
  updatedAt?: string;
  _count?: { messages: number };
}

interface WhatsAppMessage {
  id: string;
  content: string;
  fromMe: boolean;
  senderName?: string;
  createdAt: string;
  from?: string;
}

export default function WhatsAppScreen() {
  const { colors } = useTheme();
  const [tickets, setTickets] = useState<WhatsAppTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<WhatsAppTicket | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<any>(null);
  const msgPollRef = useRef<any>(null);

  const loadTickets = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp/tickets', { params: { limit: 50, orderBy: 'updatedAt_desc' } });
      setTickets(Array.isArray(data) ? data : data?.items || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    setMessagesLoading(true);
    try {
      const { data } = await api.get(`/whatsapp/tickets/${ticketId}`);
      setMessages(data.messages || data?.ticket?.messages || []);
    } catch { }
    finally { setMessagesLoading(false); }
  }, []);

  useEffect(() => { loadTickets(); }, []);
  usePolling(loadTickets, 10000);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
      msgPollRef.current = setInterval(() => loadMessages(selectedTicket.id), 5000);
    }
    return () => { if (msgPollRef.current) clearInterval(msgPollRef.current); };
  }, [selectedTicket?.id]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await api.post('/whatsapp/send', {
        ticketId: selectedTicket.id,
        message: messageText.trim(),
      });
      setMessageText('');
      await loadMessages(selectedTicket.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    setSelectedTicket(null);
    setMessages([]);
  };

  // Conversation list view
  if (!selectedTicket) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.listHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={[styles.listHeaderTitle, { color: colors.text }]}>WhatsApp</Text>
        </View>

        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedTicket(item)}
              style={({ pressed }) => [styles.ticketRow, {
                backgroundColor: colors.bgCard,
                borderBottomColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <Avatar name={item.contactName || item.client?.razaoSocial || '?'} size={48} color="#25D366" />
              <View style={styles.ticketInfo}>
                <View style={styles.ticketHeader}>
                  <Text style={[styles.ticketName, { color: colors.text }]} numberOfLines={1}>
                    {item.contactName || item.client?.razaoSocial || 'Desconhecido'}
                  </Text>
                  {item.updatedAt && (
                    <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                      {new Date(item.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                {item.contactPhone && (
                  <Text style={[styles.ticketPhone, { color: colors.textSecondary }]}>
                    📱 {item.contactPhone}
                  </Text>
                )}
                {item.lastMessage && (
                  <Text style={[styles.ticketLastMsg, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.lastMessage.fromMe ? '✓ ' : ''}{item.lastMessage.content || 'Anexo'}
                  </Text>
                )}
                <View style={styles.ticketMeta}>
                  <Badge
                    text={item.status}
                    color={item.status === 'aberto' ? '#25D366' : item.status === 'fechado' ? '#64748b' : '#f59e0b'}
                    size="sm"
                  />
                  {item._count && item._count.messages > 0 && (
                    <Text style={[styles.msgCount, { color: colors.textSecondary }]}>
                      {item._count.messages} msgs
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTickets(); }} tintColor="#25D366" />}
          ListEmptyComponent={!loading ? (
            <EmptyState icon="💬" title="Nenhuma conversa" description="Nenhum ticket WhatsApp encontrado" />
          ) : null}
        />
      </View>
    );
  }

  // Chat view
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Chat header */}
      <View style={[styles.chatHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Avatar name={selectedTicket.contactName || '?'} size={36} color="#25D366" />
        <View style={styles.chatHeaderInfo}>
          <Text style={[styles.chatHeaderName, { color: colors.text }]} numberOfLines={1}>
            {selectedTicket.contactName || selectedTicket.client?.razaoSocial || 'Desconhecido'}
          </Text>
          <Text style={[styles.chatHeaderPhone, { color: colors.textSecondary }]}>
            {selectedTicket.contactPhone || ''}
          </Text>
        </View>
        <Badge
          text={selectedTicket.status}
          color={selectedTicket.status === 'aberto' ? '#25D366' : '#64748b'}
          size="sm"
        />
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.msgBubble, item.fromMe ? styles.msgMe : styles.msgThem, {
            backgroundColor: item.fromMe ? '#DCF8C6' : colors.bgCard,
            borderColor: item.fromMe ? '#c5e1a5' : colors.border,
          }]}>
            {!item.fromMe && item.senderName && (
              <Text style={[styles.msgSender, { color: '#25D366' }]}>{item.senderName}</Text>
            )}
            <Text style={[styles.msgText, { color: colors.text }]}>{item.content}</Text>
            <Text style={[styles.msgTime, { color: '#999' }]}>
              {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.chatMessages}
        onContentSizeChange={() => messagesEndRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={!messagesLoading ? (
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
              Nenhuma mensagem ainda
            </Text>
          </View>
        ) : null}
      />

      {/* Input */}
      <View style={[styles.chatInput, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.chatTextInput, { color: colors.text, backgroundColor: colors.bgInput }]}
          placeholder="Digite sua mensagem..."
          placeholderTextColor={colors.textSecondary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
          style={[styles.sendBtn, {
            backgroundColor: messageText.trim() ? '#25D366' : colors.bgInput,
          }]}
        >
          <Ionicons name="send" size={18} color={messageText.trim() ? '#fff' : colors.textSecondary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  listHeaderTitle: { fontSize: 20, fontWeight: '700' },
  list: { paddingBottom: 20 },
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  ticketInfo: { flex: 1 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketName: { fontSize: 15, fontWeight: '600', flex: 1 },
  ticketTime: { fontSize: 11, marginLeft: 8 },
  ticketPhone: { fontSize: 12, marginTop: 2 },
  ticketLastMsg: { fontSize: 13, marginTop: 4 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  msgCount: { fontSize: 11 },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 15, fontWeight: '600' },
  chatHeaderPhone: { fontSize: 12 },
  chatMessages: { padding: 12, paddingBottom: 8 },
  msgBubble: {
    maxWidth: '80%', borderRadius: 14, borderWidth: 1,
    padding: 10, marginBottom: 6,
  },
  msgMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgThem: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: 14 },
  chatInput: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    paddingBottom: 30, borderTopWidth: 1, gap: 8,
  },
  chatTextInput: {
    flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
