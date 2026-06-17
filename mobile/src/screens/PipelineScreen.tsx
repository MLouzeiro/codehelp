import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Dimensions, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  runOnJS, useAnimatedGestureHandler,
} from 'react-native-reanimated';
import { useTheme } from '../../src/services/theme';
import { useCrmStore } from '../../src/stores/crmStore';
import { usePolling } from '../../src/hooks/usePolling';
import { Badge } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { LoadingScreen, EmptyState } from '../../src/components/ui/Feedback';
import type { Opportunity, PipelineStage } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH * 0.78;
const COLUMN_GAP = 12;

const STAGE_COLORS: Record<string, string> = {
  novo: '#3b82f6',
  em_andamento: '#f59e0b',
  negociacao: '#8b5cf6',
  fechado: '#22c55e',
  perdido: '#ef4444',
};

export default function PipelineScreen() {
  const { colors } = useTheme();
  const { pipeline, pipelineLoading, loadPipeline, updateOpportunity } = useCrmStore();
  const [selectedStage, setSelectedStage] = useState(0);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Opportunity | null>(null);

  useEffect(() => { loadPipeline(); }, []);
  usePolling(loadPipeline, 30000);

  const filteredStages = pipeline.map((stage) => ({
    ...stage,
    items: stage.items.filter((item) =>
      !search || item.titulo.toLowerCase().includes(search.toLowerCase()) ||
      item.client?.razaoSocial?.toLowerCase().includes(search.toLowerCase())
    ),
  }));

  const handleMoveOpportunity = async (oppId: string, toStage: string) => {
    try {
      await updateOpportunity(oppId, { etapa: toStage });
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    }
  };

  const handleDragEnd = (opp: Opportunity, toStage: string) => {
    if (opp.etapa !== toStage) {
      handleMoveOpportunity(opp.id, toStage);
    }
    setDraggedItem(null);
  };

  if (pipelineLoading && pipeline.length === 0) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pipeline</Text>
        <View style={styles.headerActions}>
          <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Buscar..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Kanban columns */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsContainer}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (COLUMN_WIDTH + COLUMN_GAP));
          setSelectedStage(idx);
        }}
      >
        {filteredStages.map((stage, colIdx) => (
          <View key={stage.slug || colIdx} style={[styles.column, { width: COLUMN_WIDTH }]}>
            <View style={[styles.columnHeader, { borderBottomColor: STAGE_COLORS[stage.slug] || colors.border }]}>
              <View style={[styles.columnDot, { backgroundColor: STAGE_COLORS[stage.slug] || colors.primary }]} />
              <Text style={[styles.columnTitle, { color: colors.text }]}>{stage.title}</Text>
              <Badge text={String(stage.items.length)} color={STAGE_COLORS[stage.slug] || '#64748b'} size="sm" />
            </View>
            <ScrollView style={styles.columnCards} showsVerticalScrollIndicator={false}>
              {stage.items.length === 0 ? (
                <View style={styles.emptyColumn}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum item</Text>
                </View>
              ) : (
                stage.items.map((opp) => (
                  <DraggableCard
                    key={opp.id}
                    opportunity={opp}
                    stageSlug={stage.slug}
                    stages={filteredStages}
                    colors={colors}
                    onDragEnd={handleDragEnd}
                    onLongPress={() => setDraggedItem(opp)}
                  />
                ))
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Stage indicators */}
      <View style={[styles.indicators, { backgroundColor: colors.bgCard }]}>
        {filteredStages.map((stage, idx) => (
          <View
            key={idx}
            style={[
              styles.indicator,
              {
                backgroundColor: idx === selectedStage
                  ? (STAGE_COLORS[stage.slug] || colors.primary)
                  : colors.border,
                width: idx === selectedStage ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Create modal */}
      <CreateOpportunityModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        colors={colors}
        stages={pipeline}
      />
    </GestureHandlerRootView>
  );
}

function DraggableCard({
  opportunity, stageSlug, stages, colors, onDragEnd, onLongPress,
}: {
  opportunity: Opportunity;
  stageSlug: string;
  stages: PipelineStage[];
  colors: any;
  onDragEnd: (opp: Opportunity, toStage: string) => void;
  onLongPress: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const [isDragging, setIsDragging] = useState(false);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      scale.value = withSpring(1.05);
      runOnJS(setIsDragging)(true);
      runOnJS(onLongPress)();
    },
    onActive: (event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: (event) => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(setIsDragging)(false);

      // Determine which column the card was dropped on
      const dropX = event.absoluteX;
      const colIdx = Math.floor(dropX / (COLUMN_WIDTH + COLUMN_GAP));
      if (colIdx >= 0 && colIdx < stages.length) {
        const targetStage = stages[colIdx];
        if (targetStage.slug !== stageSlug) {
          runOnJS(onDragEnd)(opportunity, targetStage.slug);
        }
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: isDragging ? 100 : 1,
  }));

  const priorityColor =
    opportunity.probability && opportunity.probability >= 70 ? '#22c55e' :
    opportunity.probability && opportunity.probability >= 40 ? '#f59e0b' : '#64748b';

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[animatedStyle]}>
        <Pressable
          style={({ pressed }) => [styles.card, {
            backgroundColor: colors.bgCard,
            borderColor: isDragging ? colors.primary : colors.border,
            opacity: pressed ? 0.85 : 1,
            shadowColor: isDragging ? colors.primary : '#000',
            shadowOffset: { width: 0, height: isDragging ? 8 : 2 },
            shadowOpacity: isDragging ? 0.3 : 0.1,
            shadowRadius: isDragging ? 12 : 4,
            elevation: isDragging ? 12 : 2,
          }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {opportunity.titulo}
          </Text>

          {opportunity.client && (
            <View style={styles.cardClient}>
              <Avatar name={opportunity.client.razaoSocial || '?'} size={18} />
              <Text style={[styles.cardClientName, { color: colors.textSecondary }]} numberOfLines={1}>
                {opportunity.client.razaoSocial}
              </Text>
            </View>
          )}

          {opportunity.valor != null && opportunity.valor > 0 && (
            <Text style={[styles.cardValue, { color: colors.primary }]}>
              R$ {opportunity.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          )}

          <View style={styles.cardFooter}>
            {opportunity.probability != null && (
              <View style={styles.cardProb}>
                <View style={[styles.probBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.probFill, { width: `${opportunity.probability}%`, backgroundColor: priorityColor }]} />
                </View>
                <Text style={[styles.probText, { color: colors.textSecondary }]}>{opportunity.probability}%</Text>
              </View>
            )}
            {opportunity.expectedCloseDate && (
              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                {new Date(opportunity.expectedCloseDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

function CreateOpportunityModal({
  visible, onClose, colors, stages,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  stages: PipelineStage[];
}) {
  const { createOpportunity } = useCrmStore();
  const [form, setForm] = useState({
    titulo: '', valor: '', etapa: 'novo', probability: '50', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.titulo.trim()) {
      Alert.alert('Erro', 'Preencha o titulo');
      return;
    }
    setSaving(true);
    try {
      await createOpportunity({
        titulo: form.titulo.trim(),
        valor: form.valor ? parseFloat(form.valor) : undefined,
        etapa: form.etapa,
        probability: form.probability ? parseInt(form.probability) : undefined,
        notes: form.notes.trim() || undefined,
      });
      onClose();
      setForm({ titulo: '', valor: '', etapa: 'novo', probability: '50', notes: '' });
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nova Oportunidade</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView>
            <Text style={[styles.label, { color: colors.text }]}>Titulo *</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="Ex: Venda de licencas"
              placeholderTextColor={colors.textSecondary}
              value={form.titulo}
              onChangeText={(t) => setForm({ ...form, titulo: t })}
            />

            <Text style={[styles.label, { color: colors.text }]}>Valor (R$)</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={form.valor}
              onChangeText={(t) => setForm({ ...form, valor: t })}
            />

            <Text style={[styles.label, { color: colors.text }]}>Etapa</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stageSelector}>
              {stages.map((s) => (
                <Pressable
                  key={s.slug}
                  onPress={() => setForm({ ...form, etapa: s.slug })}
                  style={[styles.stageChip, {
                    backgroundColor: form.etapa === s.slug
                      ? (STAGE_COLORS[s.slug] || colors.primary)
                      : colors.bgInput,
                    borderColor: form.etapa === s.slug
                      ? (STAGE_COLORS[s.slug] || colors.primary)
                      : colors.border,
                  }]}
                >
                  <Text style={[styles.stageChipText, {
                    color: form.etapa === s.slug ? '#fff' : colors.text,
                  }]}>{s.title}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: colors.text }]}>Probabilidade (%)</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="50"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={form.probability}
              onChangeText={(t) => setForm({ ...form, probability: t })}
            />

            <Text style={[styles.label, { color: colors.text }]}>Observacoes</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="Detalhes da oportunidade..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={form.notes}
              onChangeText={(t) => setForm({ ...form, notes: t })}
            />

            <Pressable
              onPress={handleCreate}
              disabled={saving}
              style={[styles.createBtn, { backgroundColor: saving ? '#94a3b8' : colors.primary }]}
            >
              <Text style={styles.createBtnText}>{saving ? 'Criando...' : 'Criar Oportunidade'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, height: 38, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 13 },
  addBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  columnsContainer: { paddingHorizontal: 12, paddingVertical: 12, gap: COLUMN_GAP },
  column: {},
  columnHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 8, marginBottom: 8, borderBottomWidth: 2,
  },
  columnDot: { width: 10, height: 10, borderRadius: 5 },
  columnTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  columnCards: { maxHeight: 500 },
  emptyColumn: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 13 },
  card: {
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  cardClient: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cardClientName: { fontSize: 12, flex: 1 },
  cardValue: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardProb: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  probBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  probFill: { height: '100%', borderRadius: 2 },
  probText: { fontSize: 11, fontWeight: '600', width: 32 },
  cardDate: { fontSize: 11 },
  indicators: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  indicator: { height: 6, borderRadius: 3 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  modalInput: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14,
  },
  modalTextarea: { minHeight: 80, textAlignVertical: 'top' },
  stageSelector: { marginBottom: 4 },
  stageChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, marginRight: 8,
  },
  stageChipText: { fontSize: 13, fontWeight: '600' },
  createBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    marginTop: 20, marginBottom: 20,
  },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
