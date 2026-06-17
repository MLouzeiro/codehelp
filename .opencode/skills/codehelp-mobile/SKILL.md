---
name: codehelp-mobile
description: "Skill especialista em desenvolvimento mobile do CodeHelp — React Native, Expo, offline mode, push notifications, biometria, drag-and-drop e integracao com APIs existentes."
---

# CodeHelp Mobile Development Specialist

Voce e um Desenvolvedor Mobile Senior especializado em React Native + Expo para o sistema CodeHelp.

---

## 1. STACK MOBILE

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | React Native | 0.74.5 |
| SDK | Expo | ~51.0.0 |
| Roteamento | Expo Router | file-based |
| State | Zustand | ^4.5.5 |
| HTTP | Axios | ^1.7.7 |
| Estilo | NativeWind | ^4.1.23 |
| Animacoes | react-native-reanimated | ~3.10.1 |
| Gestos | react-native-gesture-handler | ~2.16.1 |
| Canvas | react-native-svg | 15.2.0 |
| Seguranca | expo-secure-store | ~13.0.1 |
| Biometria | expo-local-authentication | ~14.0.1 |
| Push | expo-notifications | ~0.28.9 |
| offline | @react-native-community/netinfo | 11.3.1 |
| Storage | @react-native-async-storage/async-storage | 1.23.1 |

---

## 2. ESTRUTURA DE PASTAS

```
mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root: ThemeProvider + AuthGate + NetworkBar
│   ├── (auth)/
│   │   ├── _layout.tsx           # Stack sem header
│   │   └── login.tsx             # Login + biometria
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar (6 tabs)
│   │   ├── index.tsx             # Dashboard
│   │   ├── helpdesk.tsx          # Kanban helpdesk
│   │   ├── crm.tsx               # Lista de clientes
│   │   ├── orders.tsx            # Lista de OS
│   │   ├── approvals.tsx         # Aprovacoes
│   │   └── notifications.tsx     # Notificacoes
│   └── (modals)/
│       ├── _layout.tsx           # Modal stack
│       ├── ticket/[id].tsx       # Detalhe ticket + chat
│       ├── client/[id].tsx       # Detalhe cliente
│       ├── order/[id].tsx        # Detalhe OS
│       └── settings.tsx          # Configuracoes
├── src/
│   ├── components/ui/            # Componentes reutilizaveis
│   │   ├── Button.tsx            # Button (primary/secondary/danger/ghost)
│   │   ├── Input.tsx             # Input com label + error
│   │   ├── Card.tsx              # Card + StatCard + Badge
│   │   ├── Avatar.tsx            # Avatar com iniciais
│   │   ├── Feedback.tsx          # LoadingScreen + EmptyState + ErrorState
│   │   └── SignatureCanvas.tsx   # Canvas de assinatura SVG
│   ├── screens/                  # Telas complexas
│   │   ├── PipelineScreen.tsx    # Pipeline Kanban com drag-and-drop
│   │   ├── WhatsAppScreen.tsx    # WhatsApp conversas + chat
│   │   ├── SignOrderScreen.tsx   # Assinatura digital OS
│   │   ├── ApprovalsScreen.tsx   # Aprovacoes
│   │   └── SettingsScreen.tsx    # Configuracoes
│   ├── services/                 # Servicos
│   │   ├── api.ts                # Axios + interceptor 401 → refresh
│   │   ├── secureStore.ts        # JWT tokens em SecureStore
│   │   ├── theme.tsx             # Dark/light + 4 bg modes
│   │   ├── notifications.ts      # Push notifications + listeners
│   │   └── offline.ts            # Cache + fila offline
│   ├── stores/                   # Zustand stores
│   │   ├── authStore.ts          # Login/logout/loadUser
│   │   ├── helpdeskStore.ts      # Kanban + tickets + cache
│   │   ├── crmStore.ts           # Clientes + pipeline
│   │   ├── ordersStore.ts        # OS
│   │   └── notificationStore.ts  # Notificacoes
│   ├── hooks/
│   │   └── usePolling.ts         # usePolling + useDebounce + usePaginatedList
│   └── types/
│       └── index.ts              # Todas as interfaces TypeScript
```

---

## 3. PADROES DE CODIGO

### Store Zustand

```typescript
import { create } from 'zustand';
import api from '../services/api';
import { offlineService } from '../services/offline';

interface MyState {
  items: Item[];
  loading: boolean;
  loadItems: () => Promise<void>;
}

export const useMyStore = create<MyState>((set, get) => ({
  items: [],
  loading: false,

  loadItems: async () => {
    set({ loading: true });
    try {
      // Usar cachedGet para offline support
      const data = await offlineService.cachedGet<Item[]>('/endpoint', 30000);
      if (data) set({ items: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
```

### Tela com Polling

```typescript
import { usePolling } from '../hooks/usePolling';

export default function MyScreen() {
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await api.get('/endpoint');
    setData(data);
  }, []);

  useEffect(() => { loadData(); }, []);
  usePolling(loadData, 10000); // Polling a cada 10s

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  return (
    <FlatList
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ...
    />
  );
}
```

### Modal

```typescript
<Modal visible={visible} animationType="slide" transparent>
  <View style={styles.overlay}>
    <View style={[styles.content, { backgroundColor: colors.bgCard }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Titulo</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      {/* Conteudo */}
    </View>
  </View>
</Modal>
```

---

## 4. OFFLINE MODE

### Como funciona

1. **Cache**: AsyncStorage com TTL (5min default)
2. **Fila**: Operacoes offline sao salvas e processadas ao reconectar
3. **Indicador**: Barra vermelha "Sem conexao" no layout

### Uso

```typescript
import { offlineService } from '../services/offline';

// Ler com cache (fallback automatico)
const data = await offlineService.cachedGet<T>('/api/endpoint', 30000);

// Adicionar a fila (quando offline)
await offlineService.addToQueue('POST', '/api/endpoint', { field: 'value' });

// Verificar status
const isOnline = offlineService.isNetworkOnline();
```

### Stores com offline

Todas as mutacoes (move, assign, sendMessage) verificam `isNetworkOnline()`:
- Online → executar + limpar cache
- Offline → adicionar a fila

---

## 5. PUSH NOTIFICATIONS

### Setup

```typescript
import { registerForPushNotifications, setupNotificationListeners } from '../services/notifications';

// No _layout.tsx
useEffect(() => {
  registerForPushNotifications();
  const cleanup = setupNotificationListeners(
    (notification) => { /* Recebida em background */ },
    (response) => {
      // Tocou na notificacao → navegar
      const data = response.notification.request.content.data;
      if (data?.ticketId) router.push(`/(modals)/ticket/${data.ticketId}`);
    }
  );
  return cleanup;
}, []);
```

### Tipos de notificacao

| Tipo | Icone | Cor |
|------|-------|-----|
| novo_ticket | 🎫 | azul |
| cliente_respondeu | 💬 | verde |
| sla_alerta | ⏰ | laranja |
| sla_vencido | 🔴 | vermelho |
| transferencia | 🔀 | roxo |
| aprovacao_pendente | ✅ | verde |
| mensagem_recebida | 📩 | azul |
| avaliacao_recebida | ⭐ | amarelo |

---

## 6. DRAG-AND-DROP (Pipeline)

### Stack
- `react-native-gesture-handler` → PanGestureHandler
- `react-native-reanimated` → Animated values

### Padrao

```typescript
const translateX = useSharedValue(0);
const translateY = useSharedValue(0);
const scale = useSharedValue(1);

const gestureHandler = useAnimatedGestureHandler({
  onStart: () => { scale.value = withSpring(1.05); },
  onActive: (event) => {
    translateX.value = event.translationX;
    translateY.value = event.translationY;
  },
  onEnd: (event) => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    // Determinar coluna de destino pelo absoluteX
    runOnJS(onDrop)(event.absoluteX);
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
```

---

## 7. ASSINATURA DIGITAL

### Componente

```typescript
import { SignatureCanvas, SignatureCanvasRef } from '../components/ui/SignatureCanvas';

const canvasRef = useRef<SignatureCanvasRef>(null);

// Limpar
canvasRef.current?.clear();

// Obter dados
const signature = canvasRef.current?.getSignature(); // JSON string ou null
```

### API de envio

```typescript
// Via token publico (sem auth)
await api.post(`/orders/sign/${token}`, {
  signature: canvasRef.current?.getSignature(),
  clientName: 'Nome do Responsavel',
  clientCpf: '000.000.000-00',
});

// Via auth (enviar por WhatsApp)
await api.post(`/orders/${id}/send-signature`, {
  signatureData: canvasRef.current?.getSignature(),
});
```

---

## 8. TEMA

### Modos de fundo

| Modo | Light | Dark |
|------|-------|------|
| white | #ffffff | #0f172a |
| ice | #f0f9ff | #0c1929 |
| gray | #f8fafc | #1e293b |
| lightblue | #e0f2fe | #0c1d36 |

### Uso

```typescript
import { useTheme } from '../services/theme';

const { colors, isDark, themeMode, bgMode, setThemeMode, setBgMode } = useTheme();

// colors: { bg, bgCard, bgInput, text, textSecondary, border, primary, primaryText }
```

---

## 9. COMANDOS

```bash
cd mobile
npm install --legacy-peer-deps    # Instalar dependencias
npx expo start                    # Iniciar dev server
npx expo start --clear            # Limpar cache
npx expo run:android              # Build Android
npx expo run:ios                  # Build iOS
npx expo prebuild                 # Gerar nativo
```

---

## 10. COMMON ISSUES

### NetInfo EPERM
Se `@react-native-community/netinfo` falhar no Windows:
- Verificar se esta no package.json
- `npm install --legacy-peer-deps`

### Canvas de assinatura nao funciona
- Garantir que `react-native-svg` esta instalado
- Verificar que o PanGestureHandler esta dentro de `GestureHandlerRootView`

### Push notifications no iOS
- Requer Apple Developer Account
- Configurar APNs no Expo
- Testar em dispositivo fisico (simulador nao suporta)

### Offline queue nao processa
- Verificar `offlineService.isNetworkOnline()`
- Chamar `offlineService.processQueue()` ao reconectar
- A fila e persistida em AsyncStorage (sobrevive reboot)
