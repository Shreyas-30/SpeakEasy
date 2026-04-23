import * as Speech from 'expo-speech';
import { TtsVoiceOption } from '@/types';

export type TtsMode = 'device' | 'elevenlabs-proxy';

const TTS_MODE: TtsMode =
  process.env.EXPO_PUBLIC_TTS_MODE === 'elevenlabs-proxy' ? 'elevenlabs-proxy' : 'device';
const TTS_PROXY_URL = process.env.EXPO_PUBLIC_TTS_PROXY_URL ?? '';
const ELEVENLABS_VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? '';

function buildArticleSpeech(title: string, source: string, content: string): string {
  return `${title}. Source: ${source}. ${content}`.replace(/\s+/g, ' ').trim();
}

function normalizeSpeechText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function getTtsMode(): TtsMode {
  return TTS_MODE;
}

export function getConfiguredDefaultVoiceId(): string | null {
  return ELEVENLABS_VOICE_ID || null;
}

export async function requestArticleSpeechUrl(
  title: string,
  source: string,
  content: string,
  voiceId?: string | null,
): Promise<string> {
  return requestSpeechUrl(buildArticleSpeech(title, source, content), voiceId);
}

export async function requestSpeechUrl(
  text: string,
  voiceId?: string | null,
): Promise<string> {
  if (TTS_MODE !== 'elevenlabs-proxy') {
    throw new Error('ElevenLabs proxy mode is not enabled');
  }

  if (!TTS_PROXY_URL) {
    throw new Error('Missing EXPO_PUBLIC_TTS_PROXY_URL for ElevenLabs proxy mode');
  }

  const response = await fetch(new URL('/api/tts', TTS_PROXY_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: normalizeSpeechText(text),
      voiceId: voiceId || ELEVENLABS_VOICE_ID || undefined,
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.audioUrl) {
    throw new Error(payload.error ?? 'Failed to create ElevenLabs speech');
  }

  return new URL(payload.audioUrl, TTS_PROXY_URL).toString();
}

export async function fetchTtsVoices(): Promise<TtsVoiceOption[]> {
  if (TTS_MODE !== 'elevenlabs-proxy') {
    return [];
  }

  if (!TTS_PROXY_URL) {
    throw new Error('Missing EXPO_PUBLIC_TTS_PROXY_URL for ElevenLabs proxy mode');
  }

  const voicesUrl = new URL('/api/tts/voices', TTS_PROXY_URL).toString();
  const response = await fetch(voicesUrl);
  const payload = await response.json();

  if (!response.ok || !Array.isArray(payload.voices)) {
    throw new Error(payload.error ?? 'Failed to load ElevenLabs voices');
  }

  return payload.voices;
}

export async function speakArticleOnDevice(
  title: string,
  source: string,
  content: string,
  handlers: {
    onStart?: () => void;
    onDone?: () => void;
    onError?: () => void;
  } = {},
): Promise<void> {
  return speakTextOnDevice(buildArticleSpeech(title, source, content), handlers);
}

export async function speakTextOnDevice(
  text: string,
  handlers: {
    onStart?: () => void;
    onDone?: () => void;
    onError?: () => void;
  } = {},
): Promise<void> {
  handlers.onStart?.();

  Speech.speak(normalizeSpeechText(text), {
    language: 'en-US',
    pitch: 1.0,
    rate: 0.92,
    onDone: handlers.onDone,
    onStopped: handlers.onDone,
    onError: handlers.onError,
  });
}

export async function stopDeviceSpeech(): Promise<void> {
  await Speech.stop();
}
