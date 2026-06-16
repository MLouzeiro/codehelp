const SOUNDS: Record<string, string> = {
  nova_mensagem: '/sounds/message.mp3',
  cliente_entrou: '/sounds/notify.mp3',
  sla_alerta: '/sounds/alert.mp3',
  aprovacao: '/sounds/success.mp3',
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export async function playSound(tipo: string, enabled: boolean = true): Promise<void> {
  if (!enabled) return;

  try {
    const soundUrl = SOUNDS[tipo];
    if (!soundUrl) return;

    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    console.warn(`[SoundAlert] Erro ao reproduzir som ${tipo}:`, err);
  }
}

export function initAudioContext(): void {
  const handler = () => {
    getAudioContext();
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
}

export const SOUND_LABELS: Record<string, string> = {
  nova_mensagem: 'Nova Mensagem',
  cliente_entrou: 'Cliente Entrou',
  sla_alerta: 'Alerta SLA',
  aprovacao: 'Aprovação',
};
