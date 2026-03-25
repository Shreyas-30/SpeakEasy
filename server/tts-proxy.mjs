import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDir = resolve(__dirname, '.cache', 'tts');

const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? '*';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4.1-mini';
const translationCacheDir = resolve(__dirname, '.cache', 'translate');

function applyCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  applyCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function buildSpeechText(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function buildCacheId({ text, voiceId, modelId }) {
  return createHash('sha256')
    .update(JSON.stringify({ text, voiceId, modelId }))
    .digest('hex');
}

async function ensureCacheDir() {
  await mkdir(cacheDir, { recursive: true });
}

async function ensureTranslationCacheDir() {
  await mkdir(translationCacheDir, { recursive: true });
}

async function createElevenLabsSpeech(text, voiceId) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${errorText.slice(0, 300)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function fetchElevenLabsVoices() {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = await response.json();
  return (payload.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    category: voice.category,
    description: voice.description,
    previewUrl: voice.preview_url,
    labels: voice.labels ?? {},
  }));
}

function getNativeLanguageLabel(nativeLanguage) {
  if (nativeLanguage === 'ar') return 'Arabic';
  if (nativeLanguage === 'es') return 'Spanish';
  if (nativeLanguage === 'hi') return 'Hindi';
  if (nativeLanguage === 'zh') return 'Chinese';
  if (nativeLanguage === 'id') return 'Indonesian';
  if (nativeLanguage === 'ko') return 'Korean';
  if (nativeLanguage === 'ja') return 'Japanese';
  if (nativeLanguage === 'fr') return 'French';
  if (nativeLanguage === 'de') return 'German';
  return 'Native language';
}

async function translateVocabulary({ word, definition, nativeLanguage }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_TRANSLATION_MODEL,
      text: {
        format: {
          type: 'json_object',
        },
      },
      instructions:
        'You translate English vocabulary for language learners. Return valid JSON only with keys translatedWord and translatedDefinition.',
      input: `Translate this English vocabulary entry into ${getNativeLanguageLabel(nativeLanguage)}.\nWord: ${word}\nDefinition: ${definition}\nRules:\n- Keep translatedWord concise and natural.\n- Keep translatedDefinition simple, clear, and learner-friendly.\n- Use the target language script.\n- Return JSON only.`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = await response.json();
  const fallbackText = payload.output
    ?.flatMap((item) => item.content ?? [])
    ?.find((item) => item.type === 'output_text')
    ?.text;
  const text = payload.output_text?.trim() || fallbackText?.trim();
  if (!text) {
    throw new Error('OpenAI returned an empty translation response');
  }

  const parsed = JSON.parse(text);
  if (!parsed.translatedWord || !parsed.translatedDefinition) {
    throw new Error('OpenAI translation response was missing required fields');
  }

  return {
    translatedWord: String(parsed.translatedWord).trim(),
    translatedDefinition: String(parsed.translatedDefinition).trim(),
  };
}

const server = createServer(async (req, res) => {
  applyCorsHeaders(res);

  if (!req.url) {
    sendJson(res, 400, { error: 'Missing request URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, PUBLIC_BASE_URL);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'tts-proxy' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/tts/voices') {
    if (!ELEVENLABS_API_KEY) {
      sendJson(res, 500, {
        error: 'Missing ELEVENLABS_API_KEY. Add it to .env.server before starting the proxy.',
      });
      return;
    }

    try {
      const voices = await fetchElevenLabsVoices();
      sendJson(res, 200, { voices });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unable to load ElevenLabs voices',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/vocab/translate') {
    if (!OPENAI_API_KEY) {
      sendJson(res, 500, {
        error: 'Missing OPENAI_API_KEY. Add it to .env.server before starting the proxy.',
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const word = buildSpeechText(body.word);
      const definition = buildSpeechText(body.definition);
      const nativeLanguage = String(body.nativeLanguage || '').trim();

      if (
        !word ||
        !definition ||
        !['ar', 'es', 'hi', 'zh', 'id', 'ko', 'ja', 'fr', 'de'].includes(nativeLanguage)
      ) {
        sendJson(res, 400, {
          error: 'word, definition, and a supported nativeLanguage are required',
        });
        return;
      }

      await ensureTranslationCacheDir();

      const cacheId = buildCacheId({
        text: `${word}::${definition}`,
        voiceId: nativeLanguage,
        modelId: OPENAI_TRANSLATION_MODEL,
      });
      const filePath = join(translationCacheDir, `${cacheId}.json`);

      if (existsSync(filePath)) {
        const cached = JSON.parse(await readFile(filePath, 'utf8'));
        sendJson(res, 200, cached);
        return;
      }

      const translated = await translateVocabulary({
        word,
        definition,
        nativeLanguage,
      });

      const payload = {
        translatedWord: translated.translatedWord,
        translatedDefinition: translated.translatedDefinition,
        nativeLanguage,
      };

      await writeFile(filePath, JSON.stringify(payload));
      sendJson(res, 200, payload);
    } catch (error) {
      console.error('Vocabulary translation failed:', error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unable to translate vocabulary',
      });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/tts/cache/')) {
    const fileName = url.pathname.replace('/api/tts/cache/', '');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(cacheDir, safeName);

    try {
      await stat(filePath);
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      createReadStream(filePath).pipe(res);
    } catch {
      sendJson(res, 404, { error: 'Audio file not found' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tts') {
    if (!ELEVENLABS_API_KEY) {
      sendJson(res, 500, {
        error: 'Missing ELEVENLABS_API_KEY. Add it to .env.server before starting the proxy.',
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const text = buildSpeechText(body.text);
      const voiceId = String(body.voiceId || ELEVENLABS_VOICE_ID).trim();

      if (!text) {
        sendJson(res, 400, { error: 'Missing text for speech generation' });
        return;
      }

      if (text.length > 5000) {
        sendJson(res, 400, { error: 'Text too long for a single speech request' });
        return;
      }

      await ensureCacheDir();

      const cacheId = buildCacheId({
        text,
        voiceId,
        modelId: ELEVENLABS_MODEL_ID,
      });
      const fileName = `${cacheId}.mp3`;
      const filePath = join(cacheDir, fileName);

      if (!existsSync(filePath)) {
        const audio = await createElevenLabsSpeech(text, voiceId);
        await writeFile(filePath, audio);
      }

      sendJson(res, 200, {
        audioUrl: `${PUBLIC_BASE_URL}/api/tts/cache/${fileName}`,
        voiceId,
        modelId: ELEVENLABS_MODEL_ID,
      });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown TTS proxy error',
      });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

await ensureCacheDir();
await ensureTranslationCacheDir();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TTS proxy listening on ${PUBLIC_BASE_URL}`);
});
