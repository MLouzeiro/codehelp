import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  StyleSheet, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useCrmStore } from '../../src/stores/crmStore';
import { usePolling } from '../../src/hooks/usePolling';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Card';
import { LoadingScreen, EmptyState } from '../../src/components/ui/Feedback';
import type { CrmClient } from '../../src/types';

export default function CrmScreen() {
  const { colors } = useTheme();
  const { clients, clientsTotal, clientsLoading, loadClients } = useCrmStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { loadClients({ page: 1, limit: 20 }); }, []);
  usePolling(() => loadClients({ page, search }), 30000);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClients({ page: 1, search }).finally(() => setRefreshing(false));
  }, [loadClients, search]);

  const onSearch = useCallback(() => {
    setPage(1);
    loadClients({ page: 1, search });
  }, [loadClients, search]);

  const renderItem = useCallback(({ item }: { item: CrmClient }) => (
    <Pressable
      onPress={() => router.push(`/(modals)/client/${item.id}`)}
      style={({ pressed }) => [styles.card, {
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <Avatar name={item.razaoSocial || '?'} size={44} />
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
          {item.razaoSocial}
        </Text>
        {item.nomeFantasia && (
          <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.nomeFantasia}
          </Text>
        )}
        <View style={styles.cardMeta}>
          {item.telefone && (
            <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>
              📞 {item.telefone}
            </Text>
          )}
          {item.cidade && (
            <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>
              📍 {item.cidade}/{item.estado}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardRight}>
        {item.status && (
          <Badge
            text={item.status}
            color={item.status === 'ativo' ? '#22c55e' : item.status === 'inativo' ? '#ef4444' : '#64748b'}
            size="sm"
          />
        )}
        {item._count && (
          <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
            {item._count.tickets || 0} tickets
          </Text>
        )}
      </View>
    </Pressable>
  ), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar cliente..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => { setSearch(''); loadClients({ page: 1 }); }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={() => {
          if (clients.length < clientsTotal) {
            setPage((p) => {
              const next = p + 1;
              loadClients({ page: next, search });
              return next;
            });
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={!clientsLoading ? (
          <EmptyState icon="👥" title="Nenhum cliente encontrado" />
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8 },
  list: { padding: 12, paddingTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 1 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cardMetaText: { fontSize: 12 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardCount: { fontSize: 11, marginTop: 4 },
});
