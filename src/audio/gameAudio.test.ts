import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from './gameAudio';

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
});
