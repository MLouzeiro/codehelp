let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  try {
    const ctx = getCtx();
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
    console.warn('[SoundAlert] Erro ao reproduzir som:', err);
  }
}

const SOUND_PATTERNS: Record<string, () => void> = {
  nova_mensagem: () => {
    playTone(880, 0.12, 'sine', 0.25);
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.25), 120);
  },
  cliente_entrou: () => {
    playTone(523, 0.15, 'sine', 0.25);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 150);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.25), 300);
  },
  sla_alerta: () => {
    playTone(800, 0.1, 'square', 0.15);
    setTimeout(() => playTone(600, 0.1, 'square', 0.15), 120);
    setTimeout(() => playTone(800, 0.1, 'square', 0.15), 240);
  },
  aprovacao: () => {
    playTone(660, 0.15, 'sine', 0.25);
    setTimeout(() => playTone(880, 0.2, 'sine', 0.25), 160);
  },
};

export function playSound(tipo: string, _enabled: boolean = true): void {
  const pattern = SOUND_PATTERNS[tipo];
  if (pattern) {
    pattern();
  } else {
    playTone(800, 0.2, 'sine', 0.25);
  }
}

export function initAudioContext(): void {
  const handler = () => {
    getCtx();
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
    document.removeEventListener('touchstart', handler);
  };
  document.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
  document.addEventListener('touchstart', handler);
}

export const SOUND_LABELS: Record<string, string> = {
  nova_mensagem: 'Nova Mensagem',
  cliente_entrou: 'Cliente Entrou',
  sla_alerta: 'Alerta SLA',
  aprovacao: 'Aprovação',
};
