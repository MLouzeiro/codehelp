import { Stack } from 'expo-router';
import { useTheme } from '../../src/services/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.bg },
      presentation: 'modal',
    }}>
      <Stack.Screen name="ticket/[id]" />
      <Stack.Screen name="client/[id]" />
      <Stack.Screen name="order/[id]" />
    </Stack>
  );
}
