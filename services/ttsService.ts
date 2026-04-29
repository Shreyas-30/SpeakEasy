import { OPENAI_TTS_CONFIG, getSpeakingTutorVoice } from '@/constants/voice';
import { buildBackendUrl } from '@/services/backend';

function buildArticleSpeech(title: string, source: string, content: string): string {
  return `${title}. Source: ${source}. ${content}`.replace(/\s+/g, ' ').trim();
}

function normalizeSpeechText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, OPENAI_TTS_CONFIG.maxInputChars);
}

export async function requestArticleSpeechUrl(
  title: string,
  source: string,
  content: string,
  voiceId?: string | null,
): Promise<string> {
  return requestSpeechUrl(buildArticleSpeech(title, source, content), voiceId);
}

export async function requestSpeechUrl(text: string, voiceId?: string | null): Promise<string> {
  const tutorVoice = getSpeakingTutorVoice(voiceId);
  const response = await fetch(buildBackendUrl('/api/tts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: normalizeSpeechText(text),
      voiceId: tutorVoice.id,
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.audioUrl) {
    throw new Error(payload.error ?? 'Failed to create speech audio');
  }

  return new URL(payload.audioUrl, buildBackendUrl('/')).toString();
}

export async function stopDeviceSpeech(): Promise<void> {
  // OpenAI TTS playback uses expo-audio players; this is kept as a safe no-op
  // for existing cleanup paths while we remove device speech usage.
}
