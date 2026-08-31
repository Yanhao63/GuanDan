import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_BGM_PATTERN,
  getAnnouncementRate,
  normalizeAudioSettings,
  selectPreferredChineseVoice,
} from './gameAudio';

function voice(name: string, lang = 'zh-CN'): SpeechSynthesisVoice {
  return {
    default: false,
    lang,
    localService: true,
    name,
    voiceURI: name,
  };
}

describe('audio settings', () => {
  it('keeps defaults for missing values and clamps invalid volume levels', () => {
    expect(normalizeAudioSettings({ effects: 140, voice: -12 })).toEqual({
      bgm: DEFAULT_AUDIO_SETTINGS.bgm,
      effects: 100,
      voice: 0,
    });
  });

  it('rounds fractional values for stable persisted settings', () => {
    expect(normalizeAudioSettings({ bgm: 24.6, effects: 52.4, voice: 80.5 })).toEqual({
      bgm: 25,
      effects: 52,
      voice: 81,
    });
  });

  it('uses a structured upbeat tune instead of a repeated rising scale', () => {
    const pitchedNotes = DEFAULT_BGM_PATTERN.melody.filter(
      (note): note is NonNullable<typeof note> => note !== null,
    );
    const directionChanges = pitchedNotes.slice(2).filter((note, index) => {
      const previousDirection = Math.sign(pitchedNotes[index + 1] - pitchedNotes[index]);
      const currentDirection = Math.sign(note - pitchedNotes[index + 1]);
      return previousDirection !== 0 && currentDirection !== 0 && previousDirection !== currentDirection;
    }).length;

    expect(DEFAULT_BGM_PATTERN.bpm).toBeGreaterThanOrEqual(140);
    expect(DEFAULT_BGM_PATTERN.chordProgression).toHaveLength(16);
    expect(DEFAULT_BGM_PATTERN.melody).toHaveLength(
      DEFAULT_BGM_PATTERN.chordProgression.length * DEFAULT_BGM_PATTERN.beatsPerBar * 2,
    );
    expect(new Set(pitchedNotes).size).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_BGM_PATTERN.melody.filter((note) => note === null).length).toBeGreaterThanOrEqual(8);
    expect(directionChanges).toBeGreaterThanOrEqual(24);
  });

  it('prefers a natural mainland female voice over robotic legacy voices', () => {
    const selected = selectPreferredChineseVoice([
      voice('Microsoft Huihui Desktop'),
      voice('Google 普通话'),
      voice('Microsoft 晓晓 Online (Natural) - Chinese (Mainland)'),
      voice('Microsoft Yunxi Online (Natural) - Chinese (Mainland)'),
    ]);

    expect(selected?.name).toContain('晓晓');
  });

  it('speeds up bombs and complex combinations without rushing simple plays', () => {
    expect(getAnnouncementRate('一对九')).toBe(1.12);
    expect(getAnnouncementRate('木板六 七 八')).toBe(1.22);
    expect(getAnnouncementRate('六张圈炸炸炸')).toBe(1.3);
  });
});
