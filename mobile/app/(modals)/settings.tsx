import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/services/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { Avatar } from '../../src/components/ui/Avatar';

export default function SettingsModal() {
  const { colors, themeMode, bgMode, setThemeMode, setBgMode } = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Configuracoes</Text>
      </View>

      {/* Profile */}
      <View style={[styles.profileCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Avatar name={user?.name || '?'} size={56} />
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          <Text style={[styles.profileRole, { color: colors.primary }]}>
            {user?.role?.charAt(0).toUpperCase() + (user?.role?.slice(1) || '')}
          </Text>
        </View>
      </View>

      {/* Appearance */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APARENCIA</Text>

      <Pressable
        onPress={() => {
          const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
          const idx = modes.indexOf(themeMode);
          setThemeMode(modes[(idx + 1) % modes.length]);
        }}
        style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        <Text style={styles.settingIcon}>🌙</Text>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Tema</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
            {themeMode === 'system' ? 'Sistema' : themeMode === 'dark' ? 'Escuro' : 'Claro'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={() => {
          const modes: Array<'white' | 'ice' | 'gray' | 'lightblue'> = ['white', 'ice', 'gray', 'lightblue'];
          const idx = modes.indexOf(bgMode);
          setBgMode(modes[(idx + 1) % modes.length]);
        }}
        style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        <Text style={styles.settingIcon}>🎨</Text>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Fundo</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
            {bgMode === 'white' ? 'Branco' : bgMode === 'ice' ? 'Gelo' : bgMode === 'gray' ? 'Cinza' : 'Azul Claro'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>

      {/* Modules */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MODULOS</Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.settingIcon}>✅</Text>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Aprovacoes</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Gerenciar solicitacoes</Text>
        </View>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.settingIcon}>🔔</Text>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Alertas</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Som e notificacoes</Text>
        </View>
      </View>

      {/* Account */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONTA</Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.settingIcon}>👤</Text>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Meu Perfil</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.settingIcon}>🔐</Text>
        <View style={styles.settingContent}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Biometria</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Face ID / Touch ID</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>

      {/* Logout */}
      <Pressable onPress={handleLogout} style={[styles.logoutBtn, { borderColor: '#ef4444' }]}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>

      <Text style={[styles.version, { color: colors.textSecondary }]}>CodeHelp v1.4.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, gap: 12 },
  backBtn: {},
  headerTitle: { fontSize: 20, fontWeight: '700' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 16, borderWidth: 1, marginBottom: 20, gap: 14,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  profileRole: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 8, marginLeft: 4 },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    borderWidth: 1, padding: 14, marginBottom: 6, gap: 12,
  },
  settingIcon: { fontSize: 20 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500' },
  settingValue: { fontSize: 12, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 20, gap: 8,
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', marginTop: 20, fontSize: 12 },
});
