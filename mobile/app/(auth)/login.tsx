import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../src/services/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { settingsStorage } from '../../src/services/secureStore';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  React.useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricsEnabled = await settingsStorage.getBiometricsEnabled();
      setBiometricsAvailable(compatible && enrolled && biometricsEnabled);
    })();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Preencha email e senha');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Credenciais invalidas');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometrics = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autentique-se para acessar o CodeHelp',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    if (result.success) {
      // Load stored credentials and login
      const storedEmail = email; // In production, retrieve from SecureStore
      if (storedEmail) {
        await handleLogin();
      } else {
        Alert.alert('Info', 'Faca login uma vez para habilitar biometria');
      }
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Recuperar senha', 'Acesse o painel web para redefinir sua senha.');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>CH</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>CodeHelp</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Acesse sua conta para continuar
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="seu@email.com"
            value={email}
            onChangeText={(t) => { setEmail(t); clearError(); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Senha"
            placeholder="Sua senha"
            value={password}
            onChangeText={(t) => { setPassword(t); clearError(); }}
            secureTextEntry={!showPassword}
            rightIcon={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Text style={{ color: colors.primary, fontSize: 14 }}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </Text>
              </Pressable>
            }
          />

          {error && (
            <Text style={styles.error}>{error}</Text>
          )}

          <Button
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            fullWidth
          />

          {biometricsAvailable && (
            <Button
              title="Entrar com Biometria"
              onPress={handleBiometrics}
              variant="secondary"
              fullWidth
              icon={<Text style={{ fontSize: 18 }}>🔐</Text>}
              style={{ marginTop: 12 }}
            />
          )}

          <Pressable onPress={handleForgotPassword} style={styles.forgot}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Esqueci minha senha
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          v1.4.0 • CodeHelp CRM
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15 },
  form: { width: '100%' },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  forgot: { alignItems: 'center', marginTop: 16 },
  forgotText: { fontSize: 14, fontWeight: '500' },
  footer: { textAlign: 'center', marginTop: 40, fontSize: 12 },
});
