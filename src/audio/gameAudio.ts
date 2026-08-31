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
export const BGM_SYNTHESIS_SAMPLE_RATE = 24_000;

export const DEFAULT_BGM_PATTERN = {
  beatsPerBar: 4,
  bpm: 134,
  chordProgression: [
    { quality: 'major', root: 50 }, { quality: 'major', root: 45 },
    { quality: 'minor', root: 47 }, { quality: 'minor', root: 42 },
    { quality: 'major', root: 43 }, { quality: 'major', root: 50 },
    { quality: 'minor', root: 40 }, { quality: 'major', root: 45 },
    { quality: 'major', root: 43 }, { quality: 'major', root: 45 },
    { quality: 'minor', root: 42 }, { quality: 'minor', root: 47 },
    { quality: 'minor', root: 40 }, { quality: 'major', root: 45 },
    { quality: 'major', root: 50 }, { quality: 'major', root: 45 },
  ],
  instrument: 'acoustic-piano',
  melody: [
    74, 78, 81, 78, 76, 74, 69, 71,
    73, 76, 81, 83, 81, 76, 73, null,
    74, 78, 81, 83, 86, 83, 81, 78,
    76, 78, 76, 74, 71, null, 69, 73,
    74, 76, 78, 81, 83, 81, 78, 76,
    74, 78, 81, 86, 83, 81, 78, null,
    76, 76, 79, 83, 81, 79, 76, 74,
    73, 76, 81, 78, 76, 73, 71, null,
    81, 83, 86, 83, 81, 78, 76, 78,
    83, 86, 88, 86, 83, 81, 78, null,
    78, 83, 86, 83, 81, 78, 76, 74,
    78, 81, 85, 81, 78, 76, 73, null,
    79, 83, 86, 83, 81, 79, 78, 76,
    76, 81, 85, 83, 81, 76, 73, 76,
    74, 78, 81, 83, 81, 78, 76, 74,
    76, 73, 69, 71, 73, 74, null, null,
  ],
  percussion: false,
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

function chineseVoiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const language = voice.lang.toLowerCase();
  let score = language === 'zh-cn' || language.startsWith('zh-hans') ? 50 : 20;

  if (/natural|neural|online/.test(name)) score += 90;
  if (/xiaoxiao|晓晓/.test(name)) score += 150;
  else if (/xiaoyi|xiaohan|xiaomeng|xiaorui|晓伊|晓涵|晓梦|晓睿/.test(name)) score += 130;
  else if (/google.*普通话|google.*mandarin/.test(name)) score += 115;
  else if (/tingting|yaoyao|hanhan|sin-ji|婷婷|瑶瑶|韩韩|female|女/.test(name)) score += 80;

  if (/yunxi|yunyang|yunjian|kangkang|云希|云扬|云健|康康/.test(name)) score -= 90;
  if (/huihui|慧慧|desktop|legacy/.test(name)) score -= 70;
  if (voice.default) score += 5;
  return score;
}

export function selectPreferredChineseVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
    .map((voice, index) => ({ index, score: chineseVoiceScore(voice), voice }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.voice;
}

export function getAnnouncementRate(text: string): number {
  if (/炸/.test(text)) {
    return 1.3;
  }
  if (/木板|三个.+三个|顺子|同花顺|带对/.test(text)) {
    return 1.22;
  }
  return 1.12;
}

class GameAudio {
  private assets: AudioAssetManifest = {};
  private backgroundElement: HTMLAudioElement | null = null;
  private backgroundBuffer: AudioBuffer | null = null;
  private backgroundGain: GainNode | null = null;
  private backgroundSource: AudioBufferSourceNode | null = null;
  private backgroundStartQueued = false;
  private context: AudioContext | null = null;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
  private voiceListenerAttached = false;

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
      this.queueBackgroundStart();
    }
  }

  configureAssets(assets: AudioAssetManifest): void {
    this.stopBackground();
    this.assets = assets;
    if (this.context?.state === 'running') {
      this.queueBackgroundStart();
    }
  }

  async unlock(): Promise<void> {
    if (this.context === null) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.preparePreferredVoice();
    this.queueBackgroundStart();
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

    this.preparePreferredVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.preferredVoice?.lang ?? 'zh-CN';
    utterance.rate = getAnnouncementRate(text);
    utterance.pitch = 1.02;
    utterance.volume = this.settings.voice / 100;
    utterance.voice = this.preferredVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  private preparePreferredVoice(): void {
    if (!('speechSynthesis' in window)) {
      return;
    }
    this.preferredVoice = selectPreferredChineseVoice(window.speechSynthesis.getVoices()) ?? null;
    if (!this.voiceListenerAttached) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        this.preferredVoice = selectPreferredChineseVoice(window.speechSynthesis.getVoices()) ?? null;
      });
      this.voiceListenerAttached = true;
    }
  }

  private createBackgroundBuffer(): AudioBuffer {
    const context = this.context as AudioContext;
    const { beatsPerBar, bpm, chordProgression, melody } = DEFAULT_BGM_PATTERN;
    const beatSeconds = 60 / bpm;
    const eighthSeconds = beatSeconds / 2;
    const duration = chordProgression.length * beatsPerBar * beatSeconds;
    const sampleRate = Math.min(context.sampleRate, BGM_SYNTHESIS_SAMPLE_RATE);
    const buffer = context.createBuffer(1, sampleRate * duration, sampleRate);
    const channel = buffer.getChannelData(0);

    const addPianoNote = (
      midiNote: number,
      startSeconds: number,
      lengthSeconds: number,
      gain: number,
    ) => {
      const start = Math.floor(startSeconds * sampleRate);
      const releaseSeconds = 0.46;
      const length = Math.floor((lengthSeconds + releaseSeconds) * sampleRate);
      const frequency = midiToFrequency(midiNote);
      const partials = [
        { decay: 1.15, level: 1, multiple: 1 },
        { decay: 2.4, level: 0.42, multiple: 2.006 },
        { decay: 3.4, level: 0.19, multiple: 3.014 },
        { decay: 4.8, level: 0.08, multiple: 4.028 },
      ];
      for (let sample = 0; sample < length && start + sample < channel.length; sample += 1) {
        const time = sample / sampleRate;
        const attack = 1 - Math.exp(-time * 125);
        const release = time <= lengthSeconds ? 1 : Math.exp(-(time - lengthSeconds) * 8.5);
        let wave = 0;
        for (const partial of partials) {
          wave += partial.level
            * Math.exp(-time * partial.decay)
            * Math.sin(2 * Math.PI * frequency * partial.multiple * time);
        }
        const hammer = Math.exp(-time * 38)
          * Math.sin(2 * Math.PI * frequency * 7.9 * time)
          * 0.035;
        channel[start + sample] += (wave + hammer) * attack * release * gain;
      }
    };

    melody.forEach((note, index) => {
      if (note === null) {
        return;
      }
      const phraseAccent = index % (beatsPerBar * 2) === 0 ? 1.12 : 1;
      addPianoNote(
        note,
        index * eighthSeconds + 0.012,
        eighthSeconds * 0.82,
        0.064 * phraseAccent,
      );
    });

    chordProgression.forEach((chord, bar) => {
      const third = chord.quality === 'major' ? 4 : 3;
      const arpeggio = [0, 7, 12, third + 12, 19, third + 12, 12, 7];
      arpeggio.forEach((interval, step) => {
        addPianoNote(
          chord.root + interval,
          bar * beatsPerBar * beatSeconds + step * eighthSeconds,
          eighthSeconds * 0.76,
          step === 0 ? 0.028 : 0.021,
        );
      });

      [0, 2].forEach((beat) => {
        addPianoNote(
          chord.root - 12 + (beat === 0 ? 0 : 7),
          (bar * beatsPerBar + beat) * beatSeconds,
          beatSeconds * 1.3,
          0.038,
        );
      });
    });

    let peak = 0;
    for (const sample of channel) {
      peak = Math.max(peak, Math.abs(sample));
    }
    if (peak > 0.86) {
      const scale = 0.86 / peak;
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] *= scale;
      }
    }
    return buffer;
  }

  private queueBackgroundStart(): void {
    if (this.backgroundStartQueued) {
      return;
    }
    this.backgroundStartQueued = true;
    window.setTimeout(() => {
      this.backgroundStartQueued = false;
      this.startBackground();
    }, 0);
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
    this.backgroundBuffer ??= this.createBackgroundBuffer();
    this.backgroundSource.buffer = this.backgroundBuffer;
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
