/**
 * Preset notification sounds using Web Audio API.
 * Each sound creates a distinctive short tone.
 */

export type NotificationSoundType = 'chime' | 'bell' | 'pop' | 'ding' | 'melody';

const STORAGE_KEY = 'datavend-notification-sound';

export function getSelectedSound(): NotificationSoundType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['chime', 'bell', 'pop', 'ding', 'melody'].includes(saved)) {
      return saved as NotificationSoundType;
    }
  } catch {}
  return 'chime';
}

export function setSelectedSound(sound: NotificationSoundType) {
  try {
    localStorage.setItem(STORAGE_KEY, sound);
  } catch {}
}

export const SOUND_LABELS: Record<NotificationSoundType, string> = {
  chime: '🔔 Chime',
  bell: '🛎️ Bell',
  pop: '💧 Pop',
  ding: '✨ Ding',
  melody: '🎵 Melody',
};

function playChime(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

function playBell(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 1200;
  osc.type = 'triangle';
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

function playPop(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

function playDing(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 1047;
  osc.type = 'sine';
  osc2.frequency.value = 1319;
  osc2.type = 'sine';
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  osc.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
  osc2.stop(ctx.currentTime + 0.4);
}

function playMelody(ctx: AudioContext) {
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const t = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

const soundPlayers: Record<NotificationSoundType, (ctx: AudioContext) => void> = {
  chime: playChime,
  bell: playBell,
  pop: playPop,
  ding: playDing,
  melody: playMelody,
};

/**
 * Play the user's selected notification sound.
 * Optionally pass a specific sound to preview.
 */
export function playNotificationSound(overrideSound?: NotificationSoundType) {
  try {
    const ctx = new AudioContext();
    const sound = overrideSound || getSelectedSound();
    soundPlayers[sound](ctx);
  } catch {
    // AudioContext not available
  }
}
