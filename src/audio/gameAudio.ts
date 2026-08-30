export interface AudioSettings {
  bgm: number;
  effects: number;
  voice: number;
}

export type SoundEffect = 'finish' | 'play' | 'tribute' | 'turn';

export interface AudioAssetManifest {
  announcements?: Record<string, string>;
  backgroundMusic?: string;
  effects?: Partial<Record<SoundEffect, string>>;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgm: 24,
  effects: 62,
  voice: 58,
};

const STORAGE_KEY = 'guandan-audio-settings';

export const DEFAULT_BGM_PATTERN = {
  bass: [261.63, 349.23, 392, 261.63, 349.23, 392, 440, 392],
  beatSeconds: 0.48,
  melody: [
    523.25, 659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25,
    698.46, 880, 1046.5, 880, 783.99, 698.46, 659.25, 783.99,
    523.25, 659.25, 783.99, 1046.5, 987.77, 880, 783.99, 659.25,
    698.46, 783.99, 880, 783.99, 659.25, 587.33, 523.25, 659.25,
  ],
} as const;

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

export function normalizeAudioSettings(settings: Partial<AudioSettings>): AudioSettings {
  return {
    bgm: clampVolume(settings.bgm ?? DEFAULT_AUDIO_SETTINGS.bgm),
    effects: clampVolume(settings.effects ?? DEFAULT_AUDIO_SETTINGS.effects),
    voice: clampVolume(settings.voice ?? DEFAULT_AUDIO_SETTINGS.voice),
  };
}

export function loadAudioSettings(): AudioSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null
      ? DEFAULT_AUDIO_SETTINGS
      : normalizeAudioSettings(JSON.parse(stored) as Partial<AudioSettings>);
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function saveAudioSettings(settings: AudioSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The game still works if private browsing prevents local settings storage.
  }
}

function preferredChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const chineseVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('zh'));
  const preferredNames = /xiaoxiao|xiaoyi|huihui|yaoyao|yunxi|tingting|sin-ji|female|女/i;
  return chineseVoices.find((voice) => preferredNames.test(voice.name)) ?? chineseVoices[0];
}

class GameAudio {
  private assets: AudioAssetManifest = {};
  private backgroundElement: HTMLAudioElement | null = null;
  private backgroundGain: GainNode | null = null;
  private backgroundSource: AudioBufferSourceNode | null = null;
  private context: AudioContext | null = null;
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;

  configure(settings: AudioSettings): void {
    this.settings = normalizeAudioSettings(settings);
    saveAudioSettings(this.settings);
    if (this.backgroundGain !== null) {
      this.backgroundGain.gain.value = this.settings.bgm / 100;
    }
    if (this.backgroundElement !== null) {
      this.backgroundElement.volume = this.settings.bgm / 100;
    }
    if (this.settings.bgm === 0) {
      this.stopBackground();
    } else if (this.context?.state === 'running') {
      this.startBackground();
    }
  }

  configureAssets(assets: AudioAssetManifest): void {
    this.stopBackground();
    this.assets = assets;
    if (this.context?.state === 'running') {
      this.startBackground();
    }
  }

  async unlock(): Promise<void> {
    if (this.context === null) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.startBackground();
  }

  playEffect(effect: SoundEffect): void {
    if (this.settings.effects === 0 || this.context?.state !== 'running') {
      return;
    }
    const asset = this.assets.effects?.[effect];
    if (asset !== undefined) {
      this.playMedia(asset, this.settings.effects);
      return;
    }

    const now = this.context.currentTime;
    const output = this.context.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(this.settings.effects / 520, now + 0.012);
    output.gain.exponentialRampToValueAtTime(0.0001, now + (effect === 'finish' ? 0.72 : 0.2));
    output.connect(this.context.destination);

    const frequencies = effect === 'finish'
      ? [392, 523.25, 659.25]
      : effect === 'turn'
        ? [659.25, 783.99]
        : effect === 'tribute'
          ? [440, 587.33]
          : [196, 246.94];
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context?.createOscillator();
      if (oscillator === undefined) {
        return;
      }
      oscillator.type = effect === 'play' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(output);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + (effect === 'finish' ? 0.75 : 0.22));
    });
  }

  announce(text: string): void {
    if (this.settings.voice === 0 || !('speechSynthesis' in window)) {
      return;
    }
    const recorded = this.assets.announcements?.[text];
    if (recorded !== undefined) {
      this.playMedia(recorded, this.settings.voice);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.02;
    utterance.pitch = 1.08;
    utterance.volume = this.settings.voice / 100;
    utterance.voice = preferredChineseVoice(window.speechSynthesis.getVoices()) ?? null;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  private createBackgroundBuffer(): AudioBuffer {
    const context = this.context as AudioContext;
    const { bass, beatSeconds, melody } = DEFAULT_BGM_PATTERN;
    const duration = melody.length * beatSeconds;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const channel = buffer.getChannelData(0);

    melody.forEach((frequency, index) => {
      const start = Math.floor((index * beatSeconds + 0.06) * context.sampleRate);
      const length = Math.floor(beatSeconds * 0.82 * context.sampleRate);
      for (let sample = 0; sample < length && start + sample < channel.length; sample += 1) {
        const time = sample / context.sampleRate;
        const envelope = Math.min(1, time * 42) * Math.exp(-time * 5.2);
        channel[start + sample] += (
          Math.sin(2 * Math.PI * frequency * time)
          + 0.2 * Math.sin(2 * Math.PI * frequency * 2 * time)
          + 0.07 * Math.sin(2 * Math.PI * frequency * 3 * time)
        ) * envelope * 0.075;
      }
    });

    bass.forEach((frequency, index) => {
      const start = Math.floor(index * beatSeconds * 4 * context.sampleRate);
      const length = Math.floor(beatSeconds * 3.4 * context.sampleRate);
      for (let sample = 0; sample < length && start + sample < channel.length; sample += 1) {
        const time = sample / context.sampleRate;
        const envelope = Math.min(1, time * 12) * Math.exp(-time * 1.9);
        channel[start + sample] += (
          Math.sin(2 * Math.PI * frequency * time)
          + 0.12 * Math.sin(2 * Math.PI * frequency * 2 * time)
        ) * envelope * 0.035;
      }
    });
    return buffer;
  }

  private playMedia(source: string, volume: number): void {
    const media = new Audio(source);
    media.volume = volume / 100;
    void media.play().catch(() => undefined);
  }

  private startBackground(): void {
    if (this.settings.bgm === 0 || this.backgroundElement !== null || this.backgroundSource !== null) {
      return;
    }
    if (this.assets.backgroundMusic !== undefined) {
      this.backgroundElement = new Audio(this.assets.backgroundMusic);
      this.backgroundElement.loop = true;
      this.backgroundElement.volume = this.settings.bgm / 100;
      void this.backgroundElement.play().catch(() => undefined);
      return;
    }
    if (this.context?.state !== 'running') {
      return;
    }

    this.backgroundGain = this.context.createGain();
    this.backgroundGain.gain.value = this.settings.bgm / 100;
    this.backgroundGain.connect(this.context.destination);
    this.backgroundSource = this.context.createBufferSource();
    this.backgroundSource.buffer = this.createBackgroundBuffer();
    this.backgroundSource.loop = true;
    this.backgroundSource.connect(this.backgroundGain);
    this.backgroundSource.start();
  }

  private stopBackground(): void {
    this.backgroundElement?.pause();
    this.backgroundElement = null;
    try {
      this.backgroundSource?.stop();
    } catch {
      // It may already have stopped while the page was suspended.
    }
    this.backgroundSource = null;
    this.backgroundGain?.disconnect();
    this.backgroundGain = null;
  }
}

export const gameAudio = new GameAudio();
