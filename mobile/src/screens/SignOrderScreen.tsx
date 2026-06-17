import React, { useState, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useOrdersStore } from '../../src/stores/ordersStore';
import { Button } from '../../src/components/ui/Button';
import { SignatureCanvas } from '../../src/components/ui/SignatureCanvas';
import api from '../../src/services/api';

export default function SignOrderScreen() {
  const { id, token } = useLocalSearchParams<{ id?: string; token?: string }>();
  const { colors } = useTheme();
  const { selectedOrder, loadOrder } = useOrdersStore();
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const canvasRef = useRef<any>(null);

  React.useEffect(() => {
    if (id) loadOrder(id);
  }, [id]);

  const handleSave = async () => {
    const signature = canvasRef.current?.getSignature();
    if (!signature) {
      Alert.alert('Erro', 'Assine na area indicada');
      return;
    }
    if (!clientName.trim()) {
      Alert.alert('Erro', 'Preencha o nome do responsavel');
      return;
    }

    setSaving(true);
    try {
      const endpoint = token
        ? `/orders/sign/${token}`
        : `/orders/${id}/send-signature`;

      const payload: any = {
        signature,
        clientName: clientName.trim(),
        clientCpf: clientCpf.trim() || undefined,
      };

      if (token) {
        // Public signing endpoint
        await api.post(endpoint, payload);
      } else {
        // Authenticated endpoint - send signature via WhatsApp
        await api.post(endpoint, { signatureData: signature });
      }

      Alert.alert('Sucesso', 'Assinatura registrada com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Erro ao salvar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    canvasRef.current?.clear();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Assinatura Digital</Text>
        <View style={{ width: 22 }} />
      </View>

      {selectedOrder && (
        <View style={[styles.orderInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.orderNumber, { color: colors.primary }]}>
            OS #{selectedOrder.numero || selectedOrder.id.slice(0, 8)}
          </Text>
          <Text style={[styles.orderTitle, { color: colors.text }]}>{selectedOrder.titulo}</Text>
          {selectedOrder.client && (
            <Text style={[styles.orderClient, { color: colors.textSecondary }]}>
              Cliente: {selectedOrder.client.razaoSocial}
            </Text>
          )}
        </View>
      )}

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.text }]}>Nome do Responsavel *</Text>
        <View style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <TextInput
            value={clientName}
            onChangeText={setClientName}
            placeholder="Nome completo"
            placeholderTextColor={colors.textSecondary}
            style={{ color: colors.text, flex: 1 }}
          />
        </View>

        <Text style={[styles.label, { color: colors.text }]}>CPF (opcional)</Text>
        <View style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <TextInput
            value={clientCpf}
            onChangeText={setClientCpf}
            placeholder="000.000.000-00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            style={{ color: colors.text, flex: 1 }}
            maxLength={14}
          />
        </View>
      </View>

      <View style={styles.canvasSection}>
        <Text style={[styles.label, { color: colors.text }]}>Assinatura *</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Assine na area abaixo com o dedo ou stylus
        </Text>

        <View style={[styles.canvasWrapper, { borderColor: colors.border }]}>
          <SignatureCanvas ref={canvasRef} width={340} height={200} />
        </View>

        <Pressable onPress={handleClear} style={styles.clearBtn}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={styles.clearText}>Limpar assinatura</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Button
          title="Confirmar Assinatura"
          onPress={handleSave}
          loading={saving}
          fullWidth
          icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}

const TextInput = require('react-native').TextInput;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  orderInfo: { margin: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  orderNumber: { fontSize: 13, fontWeight: '700' },
  orderTitle: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  orderClient: { fontSize: 13, marginTop: 2 },
  form: { paddingHorizontal: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 12, marginBottom: 8 },
  input: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  canvasSection: { paddingHorizontal: 12, flex: 1 },
  canvasWrapper: {
    borderWidth: 2, borderStyle: 'dashed', borderRadius: 12,
    overflow: 'hidden', height: 200, marginBottom: 8,
  },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center',
  },
  clearText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },
  footer: { padding: 12, paddingBottom: 30 },
});
