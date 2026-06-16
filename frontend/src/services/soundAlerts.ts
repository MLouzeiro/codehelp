let audioCtx: AudioContext | null = null;
let initialized = false;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  const ctx = getCtx();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('[Sound] Erro ao tocar:', err);
  }
}

const SOUND_PATTERNS: Record<string, () => void> = {
  nova_mensagem: () => {
    playTone(880, 0.15, 'sine', 0.4);
    setTimeout(() => playTone(1100, 0.2, 'sine', 0.4), 150);
  },
  cliente_entrou: () => {
    playTone(523, 0.15, 'sine', 0.4);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.4), 150);
    setTimeout(() => playTone(784, 0.25, 'sine', 0.4), 300);
  },
  sla_alerta: () => {
    playTone(800, 0.12, 'square', 0.2);
    setTimeout(() => playTone(600, 0.12, 'square', 0.2), 130);
    setTimeout(() => playTone(800, 0.15, 'square', 0.2), 260);
  },
  aprovacao: () => {
    playTone(660, 0.15, 'sine', 0.4);
    setTimeout(() => playTone(880, 0.25, 'sine', 0.4), 160);
  },
};

export function playSound(tipo: string): void {
  if (!initialized) {
    initAudioContext();
  }

  const pattern = SOUND_PATTERNS[tipo];
  if (pattern) {
    pattern();
  } else {
    playTone(800, 0.25, 'sine', 0.4);
  }
}

export function initAudioContext(): void {
  if (initialized) return;

  const handler = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        initialized = true;
      }).catch(() => {});
    } else {
      initialized = true;
    }
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
    document.removeEventListener('touchstart', handler);
  };

  document.addEventListener('click', handler, { once: true });
  document.addEventListener('keydown', handler, { once: true });
  document.addEventListener('touchstart', handler, { once: true });

  // Also try to init immediately if already interacted
  const ctx = getCtx();
  if (ctx && ctx.state === 'running') {
    initialized = true;
  }
}

export const SOUND_LABELS: Record<string, string> = {
  nova_mensagem: 'Nova Mensagem',
  cliente_entrou: 'Cliente Entrou',
  sla_alerta: 'Alerta SLA',
  aprovacao: 'Aprovação',
};
