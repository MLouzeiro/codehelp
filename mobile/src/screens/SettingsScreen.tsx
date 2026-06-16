import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../services/theme';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../../components/ui/Avatar';

interface SettingItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  colors: any;
  showArrow?: boolean;
}

function SettingItem({ icon, label, value, onPress, colors, showArrow = true }: SettingItemProps) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={({ pressed }) => [styles.settingItem, {
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
        opacity: onPress && pressed ? 0.85 : 1,
      }]}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {value && <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>}
      </View>
      {showArrow && onPress && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
    </Comp>
  );
}

export default function SettingsScreen() {
  const { colors, themeMode, bgMode, setThemeMode, setBgMode } = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
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
      <SettingItem
        icon="🌙"
        label="Tema"
        value={themeMode === 'system' ? 'Sistema' : themeMode === 'dark' ? 'Escuro' : 'Claro'}
        onPress={() => {
          const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
          const idx = modes.indexOf(themeMode);
          setThemeMode(modes[(idx + 1) % modes.length]);
        }}
        colors={colors}
      />
      <SettingItem
        icon="🎨"
        label="Fundo"
        value={bgMode === 'white' ? 'Branco' : bgMode === 'ice' ? 'Gelo' : bgMode === 'gray' ? 'Cinza' : 'Azul Claro'}
        onPress={() => {
          const modes: Array<'white' | 'ice' | 'gray' | 'lightblue'> = ['white', 'ice', 'gray', 'lightblue'];
          const idx = modes.indexOf(bgMode);
          setBgMode(modes[(idx + 1) % modes.length]);
        }}
        colors={colors}
      />

      {/* Modules */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MODULOS</Text>
      <SettingItem icon="✅" label="Aprovacoes" onPress={() => {}} colors={colors} showArrow={false} />
      <SettingItem icon="🔔" label="Configuracao de Alertas" onPress={() => {}} colors={colors} showArrow={false} />

      {/* Account */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONTA</Text>
      <SettingItem icon="👤" label="Meu Perfil" onPress={() => {}} colors={colors} showArrow={false} />
      <SettingItem icon="🔐" label="Biometria" value="Configurar" onPress={() => {}} colors={colors} showArrow={false} />

      {/* Danger zone */}
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
