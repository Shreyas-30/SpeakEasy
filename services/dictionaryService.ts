import { NativeLanguage } from '@/types';
import { buildBackendUrl, getBackendUrl } from '@/services/backend';

export interface WordDefinition {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  example?: string;
}

export interface TranslatedWordDefinition {
  translatedWord: string;
  translatedDefinition: string;
  nativeLanguage: NativeLanguage;
}

export async function lookupWord(word: string): Promise<WordDefinition | null> {
  // Strip leading/trailing punctuation for the lookup
  const clean = word.toLowerCase().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
  if (!clean || clean.length < 2) return null;

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    const meaning = entry.meanings?.[0];
    const def = meaning?.definitions?.[0];

    return {
      word: entry.word ?? clean,
      phonetic:
        entry.phonetic ??
        entry.phonetics?.find((p: { text?: string }) => p.text)?.text,
      partOfSpeech: meaning?.partOfSpeech,
      definition: def?.definition ?? 'Definition not available',
      example: def?.example,
    };
  } catch {
    return null;
  }
}

export async function translateWordDefinition(
  word: string,
  definition: string,
  nativeLanguage: NativeLanguage,
): Promise<TranslatedWordDefinition | null> {
  if (!getBackendUrl()) return null;

  try {
    const res = await fetch(buildBackendUrl('/api/vocab/translate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        word,
        definition,
        nativeLanguage,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.translatedWord || !data?.translatedDefinition) return null;

    return {
      translatedWord: data.translatedWord,
      translatedDefinition: data.translatedDefinition,
      nativeLanguage,
    };
  } catch {
    return null;
  }
}
