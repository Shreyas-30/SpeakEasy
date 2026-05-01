import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDir = resolve(__dirname, '.cache', 'tts');

const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? process.env.RENDER_EXTERNAL_URL ?? '';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? '*';
const GUARDIAN_KEY = process.env.GUARDIAN_KEY ?? process.env.EXPO_PUBLIC_GUARDIAN_KEY ?? '';
const GNEWS_KEY = process.env.GNEWS_KEY ?? process.env.EXPO_PUBLIC_GNEWS_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4.1-mini';
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts';
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-1.5';
const OPENAI_REALTIME_TRANSCRIPTION_MODEL =
  process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? 'gpt-4o-transcribe';
const OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE =
  process.env.OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE ?? 'en';
const OPENAI_REALTIME_SESSION_TARGET_SECONDS = Number.parseInt(
  process.env.OPENAI_REALTIME_SESSION_TARGET_SECONDS ?? '150',
  10,
);
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const translationCacheDir = resolve(__dirname, '.cache', 'translate');
const GUARDIAN_BASE = 'https://content.guardianapis.com';
const GNEWS_BASE = 'https://gnews.io/api/v4';

const OPENAI_VOICES = {
  sophia: { name: 'Sophia', openaiVoice: 'marin' },
  maya: { name: 'Maya', openaiVoice: 'coral' },
  leo: { name: 'Leo', openaiVoice: 'cedar' },
  noah: { name: 'Noah', openaiVoice: 'echo' },
};

const ENGLISH_TRANSCRIPTION_PROMPT =
  'The learner is practicing spoken English only. Transcribe only English words, common English names, numbers, and punctuation. If the audio is silent, unclear, mostly background noise, or not English, return an empty transcript instead of guessing.';

function getTutorVoice(voiceId) {
  return OPENAI_VOICES[String(voiceId ?? '').trim()] ?? OPENAI_VOICES.sophia;
}

const TOPIC_MAP = {
  technology: { api: 'guardian', section: 'technology' },
  sports: { api: 'guardian', section: 'sport' },
  food: { api: 'guardian', section: 'food' },
  travel: { api: 'guardian', section: 'travel' },
  music: { api: 'guardian', section: 'music' },
  science: { api: 'guardian', section: 'science' },
  health: { api: 'guardian', section: 'lifeandstyle' },
  business: { api: 'guardian', section: 'business' },
  arts: { api: 'guardian', section: 'culture' },
  fashion: { api: 'guardian', section: 'fashion' },
  politics: { api: 'guardian', section: 'politics' },
  movies: { api: 'guardian', section: 'film' },
  nature: { api: 'guardian', section: 'environment' },
  gardening: { api: 'guardian', section: 'lifeandstyle', tag: 'lifeandstyle/gardening' },
  gaming: { api: 'gnews', topic: 'GAMING', query: 'gaming' },
  anime: { api: 'gnews', query: 'anime' },
};

const TOPIC_COLORS = {
  technology: '#3B82F6',
  sports: '#10B981',
  food: '#F59E0B',
  travel: '#8B5CF6',
  music: '#EC4899',
  science: '#06B6D4',
  health: '#EF4444',
  business: '#6366F1',
  arts: '#F97316',
  gaming: '#84CC16',
  fashion: '#D946EF',
  politics: '#64748B',
  anime: '#A855F7',
  gardening: '#22C55E',
  nature: '#14B8A6',
  movies: '#EF4444',
};

const TOPIC_LABELS = {
  technology: 'Technology',
  sports: 'Sports',
  food: 'Food & Cooking',
  travel: 'Travel',
  music: 'Music',
  science: 'Science',
  health: 'Health & Fitness',
  business: 'Business',
  arts: 'Arts & Culture',
  gaming: 'Gaming',
  fashion: 'Fashion',
  politics: 'Politics',
  anime: 'Anime',
  gardening: 'Gardening',
  nature: 'Nature',
  movies: 'Movies & TV',
};

const MOCK_ARTICLES = [
  {
    id: '1',
    title: 'Smartphones May Soon Last a Week Per Charge',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600',
    topic: 'Technology', topicId: 'technology', topicColor: '#3B82F6',
    difficulty: 'Beginner', readTime: 5, publishedAt: '1 hour ago',
    content: 'Researchers have made a breakthrough in battery technology...',
    source: 'The Guardian', recommended: true,
  },
  {
    id: '2',
    title: 'Tech Giants Invest in Renewable Energy',
    imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600',
    topic: 'Technology', topicId: 'technology', topicColor: '#3B82F6',
    difficulty: 'Intermediate', readTime: 2, publishedAt: '1 day ago',
    content: 'Major technology companies are pledging billions toward renewable energy...',
    source: 'BBC News', recommended: true,
  },
  {
    id: '3',
    title: 'Extreme Sports Gain Olympic Recognition',
    imageUrl: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=600',
    topic: 'Sports', topicId: 'sports', topicColor: '#10B981',
    difficulty: 'Beginner', readTime: 3, publishedAt: '2 hours ago',
    content: 'The International Olympic Committee has announced new extreme sports categories...',
    source: 'The Guardian',
  },
  {
    id: '4',
    title: 'Cybersecurity Threats Rise in Digital Age',
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',
    topic: 'Technology', topicId: 'technology', topicColor: '#3B82F6',
    difficulty: 'Intermediate', readTime: 4, publishedAt: '5 hours ago',
    content: 'New cybersecurity reports indicate a 40% rise in ransomware attacks...',
    source: 'Reuters',
  },
  {
    id: '5',
    title: 'Street Food Festivals Return Worldwide',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
    topic: 'Food & Cooking', topicId: 'food', topicColor: '#F59E0B',
    difficulty: 'Beginner', readTime: 2, publishedAt: '8 hours ago',
    content: 'Cities around the world are hosting street food festivals...',
    source: 'BBC News',
  },
];

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600',
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=600',
  'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=600',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
  'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
];
const PLACEHOLDER_PREFIXES = ['Top Stories in', "What's New in", 'Latest from'];
const PLACEHOLDER_TIMES = ['Just now', '1 hour ago', '3 hours ago'];

function applyCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  applyCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function getPublicBaseUrl(req) {
  if (PUBLIC_BASE_URL) {
    return PUBLIC_BASE_URL;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host;
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.length > 0 ? forwardedProto : 'http';

  if (!host) {
    return `http://127.0.0.1:${PORT}`;
  }

  return `${protocol}://${host}`;
}

function buildSpeechText(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
}

function estimateReadTime(text) {
  const words = String(text ?? '').trim().split(/\s+/).length;
  return Math.max(2, Math.min(Math.ceil((words * 10) / 200), 12));
}

function assignDifficulty() {
  const r = Math.random();
  if (r < 0.5) return 'Beginner';
  if (r < 0.85) return 'Intermediate';
  return 'Advanced';
}

async function fetchFromGuardian(topicId, config, count = 6) {
  const params = new URLSearchParams({
    section: config.section,
    'show-fields': 'thumbnail,trailText',
    'page-size': count.toString(),
    'order-by': 'newest',
    'api-key': GUARDIAN_KEY,
  });

  if (config.tag) params.set('tag', config.tag);

  const res = await fetch(`${GUARDIAN_BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Guardian ${res.status}`);
  const data = await res.json();

  return (data.response?.results ?? [])
    .filter((item) => item.fields?.thumbnail && item.fields?.trailText)
    .map((item) => ({
      id: item.id,
      title: item.webTitle,
      imageUrl: item.fields.thumbnail,
      topic: TOPIC_LABELS[topicId] ?? item.sectionName,
      topicId,
      topicColor: TOPIC_COLORS[topicId] ?? '#6B7280',
      difficulty: assignDifficulty(),
      readTime: estimateReadTime(item.fields.trailText),
      publishedAt: timeAgo(item.webPublicationDate),
      content: item.fields.trailText,
      url: item.webUrl,
      source: 'The Guardian',
    }));
}

async function fetchFromGNews(topicId, config, count = 6) {
  const params = new URLSearchParams({
    lang: 'en',
    max: count.toString(),
    apikey: GNEWS_KEY,
  });

  let endpoint;
  if (config.topic) {
    params.set('topic', config.topic);
    endpoint = 'top-headlines';
  } else {
    params.set('q', config.query);
    endpoint = 'search';
  }

  const res = await fetch(`${GNEWS_BASE}/${endpoint}?${params}`);
  if (!res.ok) throw new Error(`GNews ${res.status}`);
  const data = await res.json();

  return (data.articles ?? [])
    .filter((item) => item.image && item.description)
    .map((item) => ({
      id: `gnews-${topicId}-${item.publishedAt}`,
      title: item.title,
      imageUrl: item.image,
      topic: TOPIC_LABELS[topicId] ?? (topicId.charAt(0).toUpperCase() + topicId.slice(1)),
      topicId,
      topicColor: TOPIC_COLORS[topicId] ?? '#6B7280',
      difficulty: assignDifficulty(),
      readTime: estimateReadTime(item.description),
      publishedAt: timeAgo(item.publishedAt),
      content: item.description,
      url: item.url,
      source: item.source?.name ?? 'GNews',
    }));
}

function generateMockArticlesForTopic(topicId, count = 3) {
  const name = topicId
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const color = TOPIC_COLORS[topicId] ?? '#6B7280';

  return Array.from({ length: count }, (_, i) => ({
    id: `placeholder-${topicId}-${i}`,
    title: `${PLACEHOLDER_PREFIXES[i % PLACEHOLDER_PREFIXES.length]} ${name}`,
    imageUrl: PLACEHOLDER_IMAGES[(topicId.length + i) % PLACEHOLDER_IMAGES.length],
    topic: name,
    topicId,
    topicColor: color,
    difficulty: assignDifficulty(),
    readTime: 2 + i,
    publishedAt: PLACEHOLDER_TIMES[i],
    content: `Stay up to date with the latest developments in ${name}. Curated content tailored to your interests.`,
    source: 'SpeakEasy',
  }));
}

function buildMockFeed(topicIds) {
  const results = [];

  for (const topicId of topicIds) {
    const matched = MOCK_ARTICLES.filter((article) => article.topicId === topicId);
    if (matched.length > 0) {
      results.push(...matched);
    } else {
      results.push(...generateMockArticlesForTopic(topicId));
    }
  }

  if (results.length === 0) {
    return [...MOCK_ARTICLES].sort(() => Math.random() - 0.5);
  }

  return results.sort(() => Math.random() - 0.5);
}

function dedupeArticles(articles) {
  const seen = new Set();

  return articles.filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

async function fetchFeedForTopics(topicIds) {
  if (!GUARDIAN_KEY && !GNEWS_KEY) {
    return buildMockFeed(topicIds);
  }

  const settled = await Promise.allSettled(
    topicIds.map((topicId) => {
      const config = TOPIC_MAP[topicId];

      if (!config) {
        if (!GNEWS_KEY) return Promise.resolve([]);
        return fetchFromGNews(topicId, { api: 'gnews', query: topicId }, 6);
      }

      if (config.api === 'guardian' && GUARDIAN_KEY) {
        return fetchFromGuardian(topicId, config);
      }

      if (config.api === 'gnews' && GNEWS_KEY) {
        return fetchFromGNews(topicId, config, 6);
      }

      return Promise.resolve([]);
    }),
  );

  const all = dedupeArticles(
    settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
  );

  if (all.length === 0) {
    return buildMockFeed(topicIds);
  }

  return all.sort(() => Math.random() - 0.5);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
}

function mapSubscriptionRow(row) {
  return {
    planId: row?.plan_id ?? 'free',
    status: row?.status ?? 'free',
    provider: row?.provider ?? 'mock',
    renewsAt: row?.renews_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function requireSupabaseUser(req) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing Supabase backend configuration. Add SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Missing authorization token');
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error('Invalid authorization token');
    error.statusCode = 401;
    throw error;
  }

  return response.json();
}

async function grantMockSubscriptionEntitlement(req, planId) {
  const user = await requireSupabaseUser(req);
  const now = new Date().toISOString();
  const entitlementRow = {
    user_id: user.id,
    plan_id: planId,
    status: 'active',
    provider: 'mock',
    renews_at: null,
    updated_at: now,
  };

  const entitlementResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_entitlements?on_conflict=user_id`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(entitlementRow),
    },
  );

  if (!entitlementResponse.ok) {
    const errorText = await entitlementResponse.text();
    throw new Error(`Supabase entitlement update failed: ${errorText.slice(0, 300)}`);
  }

  await fetch(`${SUPABASE_URL}/rest/v1/subscription_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: user.id,
      event_type: 'mock_entitlement_granted',
      plan_id: planId,
      source: 'backend',
      metadata: { provider: 'mock' },
    }),
  });

  const [row] = await entitlementResponse.json();
  return mapSubscriptionRow(row);
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

async function createOpenAISpeech(text, voiceId) {
  const tutorVoice = getTutorVoice(voiceId);
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: tutorVoice.openaiVoice,
      input: text,
      response_format: 'mp3',
      instructions:
        'Speak clearly and naturally for an intermediate English learner. Use steady pacing and careful pronunciation.',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI speech ${response.status}: ${errorText.slice(0, 300)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildRealtimeInstructions({ articleTitle, articleSource, articleContent, difficulty, tutorName }) {
  const compactContent = buildSpeechText(articleContent).slice(0, 2200);
  const targetSeconds = Number.isFinite(OPENAI_REALTIME_SESSION_TARGET_SECONDS)
    ? OPENAI_REALTIME_SESSION_TARGET_SECONDS
    : 150;

  return `You are ${tutorName || 'Sophia'}, a friendly English-speaking coach in SpeakEasy.

The learner is intermediate at English and wants confidence for daily life, not textbook English.
Discuss the article they just read. Ask one question at a time. Keep voice responses short, warm, and natural.
Speak only in English. If the learner says something unclear, ask them to try again in English instead of guessing.
Treat silence, background noise, or non-English transcript fragments as unclear audio, not as user intent.
Every question should connect to a specific detail, claim, event, or tension from the article context.
Never open with generic questions like "What did you think?", "Do you agree?", or "What caught your attention?"
Open with one concrete detail from the article and a short why/how question about that detail.
Good opening shape: "The article says [specific detail]. Why do you think [consequence/tension]?"
Gently correct grammar after the user finishes speaking by briefly restating the correct phrase.
Teach useful article words or phrases when it fits naturally. Avoid sounding like a quiz.

Graceful timing:
- The conversation should feel complete in about ${targetSeconds} seconds.
- Near the last 30 seconds, summarize their practice or ask one final reflection question.
- End with one short encouragement and a clear warm closing.
- If the user keeps talking after the wrap-up, answer briefly and close again without abruptly cutting them off.

Article context:
Title: ${articleTitle}
Source: ${articleSource || 'Unknown source'}
Difficulty: ${difficulty || 'Intermediate'}
Excerpt: ${compactContent}`;
}

async function createRealtimeClientSecret(body) {
  const voice = getTutorVoice(body.voiceId);
  const instructions = buildRealtimeInstructions({
    articleTitle: buildSpeechText(body.articleTitle),
    articleSource: buildSpeechText(body.articleSource),
    articleContent: buildSpeechText(body.articleContent),
    difficulty: buildSpeechText(body.difficulty),
    tutorName: voice.name,
  });

  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: OPENAI_REALTIME_MODEL,
        instructions,
        audio: {
          input: {
            noise_reduction: {
              type: 'near_field',
            },
            transcription: {
              model: OPENAI_REALTIME_TRANSCRIPTION_MODEL,
              language: OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE,
              prompt: ENGLISH_TRANSCRIPTION_PROMPT,
            },
            turn_detection: null,
          },
          output: {
            voice: voice.openaiVoice,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Realtime ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = await response.json();
  const clientSecret = payload.client_secret?.value ?? payload.value ?? payload.secret;
  if (!clientSecret) {
    throw new Error('OpenAI Realtime response did not include a client secret');
  }

  return {
    clientSecret,
    model: OPENAI_REALTIME_MODEL,
    voiceId: String(body.voiceId || 'sophia'),
    voiceName: voice.name,
    sessionTargetSeconds: OPENAI_REALTIME_SESSION_TARGET_SECONDS,
  };
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

  const publicBaseUrl = getPublicBaseUrl(req);
  const url = new URL(req.url, publicBaseUrl);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'speakeasy-backend' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/realtime/session') {
    if (!OPENAI_API_KEY) {
      sendJson(res, 500, {
        error: 'Missing OPENAI_API_KEY. Add it to Render or .env.server before starting the backend.',
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const articleTitle = buildSpeechText(body.articleTitle);
      const articleContent = buildSpeechText(body.articleContent);

      if (!articleTitle || !articleContent) {
        sendJson(res, 400, { error: 'articleTitle and articleContent are required' });
        return;
      }

      const session = await createRealtimeClientSecret(body);
      sendJson(res, 200, session);
    } catch (error) {
      console.error('Realtime session creation failed:', error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unable to create realtime session',
      });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/feed') {
    try {
      const topicsParam = url.searchParams.get('topics') ?? '';
      const topicIds = topicsParam
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean);

      if (topicIds.length === 0) {
        sendJson(res, 400, { error: 'At least one topic is required' });
        return;
      }

      const articles = await fetchFeedForTopics(topicIds);
      sendJson(res, 200, { articles });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unable to load feed articles',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/subscription/mock-upgrade') {
    try {
      const body = await readJsonBody(req);
      const planId = String(body.planId || '').trim();

      if (!['plus', 'pro'].includes(planId)) {
        sendJson(res, 400, { error: 'planId must be plus or pro' });
        return;
      }

      const entitlement = await grantMockSubscriptionEntitlement(req, planId);
      sendJson(res, 200, { entitlement });
    } catch (error) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;

      sendJson(res, statusCode, {
        error: error instanceof Error ? error.message : 'Unable to update subscription',
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
    if (!OPENAI_API_KEY) {
      sendJson(res, 500, {
        error: 'Missing OPENAI_API_KEY. Add it to Render or .env.server before starting the backend.',
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const text = buildSpeechText(body.text);
      const voiceId = String(body.voiceId || 'sophia').trim();
      const tutorVoice = getTutorVoice(voiceId);

      if (!text) {
        sendJson(res, 400, { error: 'Missing text for speech generation' });
        return;
      }

      if (text.length > 7500) {
        sendJson(res, 400, { error: 'Text too long for a single speech request' });
        return;
      }

      await ensureCacheDir();

      const cacheId = buildCacheId({
        text,
        voiceId: tutorVoice.openaiVoice,
        modelId: OPENAI_TTS_MODEL,
      });
      const fileName = `${cacheId}.mp3`;
      const filePath = join(cacheDir, fileName);

      if (!existsSync(filePath)) {
        const audio = await createOpenAISpeech(text, voiceId);
        await writeFile(filePath, audio);
      }

      sendJson(res, 200, {
        audioUrl: `${publicBaseUrl}/api/tts/cache/${fileName}`,
        voiceId,
        voiceName: tutorVoice.name,
        modelId: OPENAI_TTS_MODEL,
      });
    } catch (error) {
      console.error('OpenAI TTS failed:', error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown TTS error',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    if (!OPENAI_API_KEY) {
      sendJson(res, 500, {
        error: 'Missing OPENAI_API_KEY. Add it to .env.server before starting the proxy.',
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const { messages = [], articleTitle, articleSource, articleContent, tutorName } = body;

      if (!articleTitle || !articleContent) {
        sendJson(res, 400, { error: 'articleTitle and articleContent are required' });
        return;
      }

      const systemPrompt = `You are ${tutorName ?? 'Sophia'}, a friendly English conversation tutor helping a language learner practice their English.

You are discussing the following news article with the user:
Title: "${articleTitle}"
Source: ${articleSource ?? ''}
Content: ${articleContent}

Your goals:
- Help the user practice speaking and writing English naturally
- Discuss the article in an engaging, conversational way
- Ask follow-up questions to keep the conversation going
- Gently correct grammar mistakes by naturally using the correct form in your reply (do not explicitly call out errors)
- Keep your responses concise — 2 to 3 sentences max so it feels like a real conversation
- Be warm, encouraging and patient`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 150,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() ?? 'Sorry, I could not respond.';
      sendJson(res, 200, { reply });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unable to get AI response',
      });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

await ensureCacheDir();
await ensureTranslationCacheDir();

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `TTS proxy listening on ${PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`}`,
  );
});
