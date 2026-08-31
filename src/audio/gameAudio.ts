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
  beatsPerBar: 4,
  bpm: 142,
  chordProgression: [
    { quality: 'major', root: 48 }, { quality: 'major', root: 43 },
    { quality: 'minor', root: 45 }, { quality: 'minor', root: 40 },
    { quality: 'major', root: 41 }, { quality: 'major', root: 48 },
    { quality: 'minor', root: 38 }, { quality: 'major', root: 43 },
    { quality: 'major', root: 48 }, { quality: 'major', root: 43 },
    { quality: 'minor', root: 45 }, { quality: 'minor', root: 40 },
    { quality: 'major', root: 41 }, { quality: 'major', root: 43 },
    { quality: 'major', root: 48 }, { quality: 'major', root: 43 },
  ],
  melody: [
    72, 76, 79, 79, 81, 79, 76, 72,
    74, 76, 79, 76, 74, 72, 74, null,
    76, 76, 81, 81, 79, 76, 74, 72,
    76, 79, 76, 74, 72, null, 67, 69,
    72, 74, 76, 79, 81, 79, 76, 74,
    72, 76, 79, 84, 81, 79, 76, null,
    74, 74, 77, 81, 79, 77, 74, 72,
    71, 74, 79, 77, 74, 71, 69, null,
    79, 81, 84, 84, 81, 79, 76, 79,
    81, 84, 86, 84, 81, 79, 76, null,
    76, 81, 84, 81, 79, 76, 74, 72,
    76, 79, 83, 79, 76, 74, 71, null,
    77, 81, 84, 81, 79, 77, 76, 74,
    74, 79, 83, 81, 79, 74, 71, 74,
    72, 76, 79, 81, 79, 76, 74, 72,
    74, 71, 67, 69, 71, 72, null, null,
  ],
} as const;

function midiToFrequency(note: number): number {
  return 440 * (2 ** ((note - 69) / 12));
}

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
    const { beatsPerBar, bpm, chordProgression, melody } = DEFAULT_BGM_PATTERN;
    const beatSeconds = 60 / bpm;
    const eighthSeconds = beatSeconds / 2;
    const duration = chordProgression.length * beatsPerBar * beatSeconds;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const channel = buffer.getChannelData(0);

    const addTone = (
      frequency: number,
      startSeconds: number,
      lengthSeconds: number,
      gain: number,
      decay: number,
      harmonics: readonly number[],
    ) => {
      const start = Math.floor(startSeconds * context.sampleRate);
      const length = Math.floor(lengthSeconds * context.sampleRate);
      for (let sample = 0; sample < length && start + sample < channel.length; sample += 1) {
        const time = sample / context.sampleRate;
        const envelope = Math.min(1, time * 55) * Math.exp(-time * decay);
        let wave = 0;
        harmonics.forEach((amount, harmonic) => {
          wave += amount * Math.sin(2 * Math.PI * frequency * (harmonic + 1) * time);
        });
        channel[start + sample] += wave * envelope * gain;
      }
    };

    melody.forEach((note, index) => {
      if (note === null) {
        return;
      }
      const swing = index % 2 === 1 ? eighthSeconds * 0.08 : 0;
      const barAccent = index % (beatsPerBar * 2) === 0 ? 1.18 : 1;
      addTone(
        midiToFrequency(note),
        index * eighthSeconds + swing + 0.018,
        eighthSeconds * 0.9,
        0.055 * barAccent,
        7.8,
        [1, 0.3, 0.12, 0.04],
      );
    });

    chordProgression.forEach((chord, bar) => {
      const intervals = chord.quality === 'major' ? [0, 4, 7] : [0, 3, 7];
      [0, 2].forEach((beat) => {
        intervals.forEach((interval, noteIndex) => {
          addTone(
            midiToFrequency(chord.root + 12 + interval),
            (bar * beatsPerBar + beat) * beatSeconds + noteIndex * 0.012,
            beatSeconds * 1.65,
            0.012,
            1.8,
            [1, 0.16],
          );
        });
      });

      [0, 1, 2, 3].forEach((beat) => {
        const bassNote = chord.root + (beat % 2 === 0 ? 0 : 7);
        addTone(
          midiToFrequency(bassNote),
          (bar * beatsPerBar + beat) * beatSeconds,
          beatSeconds * 0.72,
          0.035,
          4.1,
          [1, 0.12],
        );
      });
    });

    const totalBeats = chordProgression.length * beatsPerBar;
    for (let beat = 0; beat < totalBeats; beat += 1) {
      addTone(beat % 4 === 0 ? 92 : 110, beat * beatSeconds, beatSeconds * 0.32, 0.026, 13, [1]);
      if (beat % 4 === 1 || beat % 4 === 3) {
        addTone(1_760, beat * beatSeconds, beatSeconds * 0.18, 0.009, 24, [1, 0.45]);
      }
      [0, 1].forEach((half) => {
        addTone(3_100, (beat + half / 2) * beatSeconds, beatSeconds * 0.08, 0.0045, 34, [1]);
      });
    }
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
