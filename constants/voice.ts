import { TtsVoiceOption } from '@/types';

export const OPENAI_VOICE_DEFAULT_ID = 'sophia';

export const OPENAI_REALTIME_CONFIG = {
  model: 'gpt-realtime-1.5',
  sessionTargetMs: 150_000,
  sessionHardLimitMs: 210_000,
  wrapUpWarningMs: 30_000,
};

export const OPENAI_TTS_CONFIG = {
  model: 'gpt-4o-mini-tts',
  maxInputChars: 7_500,
  responseFormat: 'mp3',
  instructions:
    'Speak clearly and naturally for an intermediate English learner. Use steady pacing and careful pronunciation.',
};

export type SpeakingTutorVoice = TtsVoiceOption & {
  openaiVoice: string;
  meta: string;
};

export const SPEAKING_TUTOR_VOICES: SpeakingTutorVoice[] = [
  {
    id: 'sophia',
    name: 'Sophia',
    openaiVoice: 'marin',
    meta: 'Warm and natural',
    description: 'A calm speaking coach for everyday English practice.',
  },
  {
    id: 'maya',
    name: 'Maya',
    openaiVoice: 'coral',
    meta: 'Bright and friendly',
    description: 'An upbeat tutor voice for pronunciation and confidence.',
  },
  {
    id: 'leo',
    name: 'Leo',
    openaiVoice: 'cedar',
    meta: 'Clear and steady',
    description: 'A relaxed coach voice for focused article discussions.',
  },
  {
    id: 'noah',
    name: 'Noah',
    openaiVoice: 'echo',
    meta: 'Conversational and direct',
    description: 'A crisp tutor voice for short, natural practice.',
  },
];

export function getSpeakingTutorVoice(voiceId?: string | null): SpeakingTutorVoice {
  return (
    SPEAKING_TUTOR_VOICES.find((voice) => voice.id === voiceId) ??
    SPEAKING_TUTOR_VOICES[0]
  );
}

export function normalizeSpeakingTutorVoice(voiceId?: string | null): SpeakingTutorVoice {
  return getSpeakingTutorVoice(voiceId);
}
