import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/services/theme';
import { useAuthStore } from '../src/stores/authStore';
import { LoadingScreen } from '../src/components/ui/Feedback';
import { offlineService } from '../src/services/offline';

function NetworkStatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    setIsOnline(offlineService.isNetworkOnline());
    return offlineService.onNetworkChange(setIsOnline);
  }, []);

  if (isOnline) return null;

  return (
    <View style={[styles.offlineBar, { backgroundColor: '#ef4444' }]}>
      <Text style={styles.offlineText}>
        ⚠️ Sem conexao — modo offline ativo
      </Text>
    </View>
  );
}

function RootLayoutInner() {
  const { isDark, colors } = useTheme();
  const { isLoading, isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
    // Process offline queue when app starts
    offlineService.processQueue();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NetworkStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="(auth)" />
        ) : (
          <Stack.Screen name="(tabs)" />
        )}
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  offlineBar: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
