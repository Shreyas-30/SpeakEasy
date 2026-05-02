import { Article, DifficultyLevel } from '@/types';
import { MOCK_ARTICLES } from '@/constants/mockData';
import { buildBackendUrl, getBackendUrl } from '@/services/backend';

const GUARDIAN_KEY = process.env.EXPO_PUBLIC_GUARDIAN_KEY ?? '';
const GNEWS_KEY = process.env.EXPO_PUBLIC_GNEWS_KEY ?? '';

const GUARDIAN_BASE = 'https://content.guardianapis.com';
const GNEWS_BASE = 'https://gnews.io/api/v4';

// ─── Topic → API routing ────────────────────────────────────────────────────

type GuardianConfig = { api: 'guardian'; section: string; tag?: string };
type GNewsConfig = { api: 'gnews'; topic?: string; query: string };
type TopicConfig = GuardianConfig | GNewsConfig;

const TOPIC_MAP: Record<string, TopicConfig> = {
  technology: { api: 'guardian', section: 'technology' },
  sports:     { api: 'guardian', section: 'sport' },
  food:       { api: 'guardian', section: 'food' },
  travel:     { api: 'guardian', section: 'travel' },
  music:      { api: 'guardian', section: 'music' },
  science:    { api: 'guardian', section: 'science' },
  health:     { api: 'guardian', section: 'lifeandstyle' },
  business:   { api: 'guardian', section: 'business' },
  arts:       { api: 'guardian', section: 'culture' },
  fashion:    { api: 'guardian', section: 'fashion' },
  politics:   { api: 'guardian', section: 'politics' },
  movies:     { api: 'guardian', section: 'film' },
  nature:     { api: 'guardian', section: 'environment' },
  gardening:  { api: 'guardian', section: 'lifeandstyle', tag: 'lifeandstyle/gardening' },
  gaming:     { api: 'gnews', topic: 'GAMING', query: 'gaming' },
  anime:      { api: 'gnews', query: 'anime' },
};

const TOPIC_COLORS: Record<string, string> = {
  technology: '#3B82F6',
  sports:     '#10B981',
  food:       '#F59E0B',
  travel:     '#8B5CF6',
  music:      '#EC4899',
  science:    '#06B6D4',
  health:     '#EF4444',
  business:   '#6366F1',
  arts:       '#F97316',
  gaming:     '#84CC16',
  fashion:    '#D946EF',
  politics:   '#64748B',
  anime:      '#A855F7',
  gardening:  '#22C55E',
  nature:     '#14B8A6',
  movies:     '#EF4444',
};

const TOPIC_LABELS: Record<string, string> = {
  technology: 'Technology',
  sports:     'Sports',
  food:       'Food & Cooking',
  travel:     'Travel',
  music:      'Music',
  science:    'Science',
  health:     'Health & Fitness',
  business:   'Business',
  arts:       'Arts & Culture',
  gaming:     'Gaming',
  fashion:    'Fashion',
  politics:   'Politics',
  anime:      'Anime',
  gardening:  'Gardening',
  nature:     'Nature',
  movies:     'Movies & TV',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 60)  return `${mins} min ago`;
  if (hours < 24)  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days  < 7)   return `${days} day${days > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
}

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  // Description is ~8–10% of article — scale up then divide by 200 wpm
  return Math.max(2, Math.min(Math.ceil((words * 10) / 200), 12));
}

function assignDifficulty(): DifficultyLevel {
  const r = Math.random();
  if (r < 0.5)  return 'Beginner';
  if (r < 0.85) return 'Intermediate';
  return 'Advanced';
}

// ─── The Guardian ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchFromGuardian(
  topicId: string,
  config: GuardianConfig,
  count = 6,
): Promise<Article[]> {
  const params = new URLSearchParams({
    section:      config.section,
    'show-fields': 'thumbnail,trailText,bodyText',
    'page-size':  count.toString(),
    'order-by':   'newest',
    'api-key':    GUARDIAN_KEY,
  });
  if (config.tag) params.set('tag', config.tag);

  const res = await fetch(`${GUARDIAN_BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Guardian ${res.status}`);
  const data = await res.json();

  return (data.response?.results ?? [])
    .filter((item: any) => item.fields?.thumbnail && item.fields?.trailText)
    .map((item: any): Article => {
      const content = item.fields.bodyText
        ? item.fields.bodyText.trim()
        : stripHtml(item.fields.trailText);
      return {
        id:          item.id,
        title:       item.webTitle,
        imageUrl:    item.fields.thumbnail,
        topic:       TOPIC_LABELS[topicId] ?? item.sectionName,
        topicId,
        topicColor:  TOPIC_COLORS[topicId] ?? '#6B7280',
        difficulty:  assignDifficulty(),
        readTime:    estimateReadTime(content),
        publishedAt: timeAgo(item.webPublicationDate),
        content,
        url:         item.webUrl,
        source:      'The Guardian',
      };
    });
}

// ─── GNews ───────────────────────────────────────────────────────────────────

async function fetchFromGNews(
  topicId: string,
  config: GNewsConfig,
  count = 6,
): Promise<Article[]> {
  const params = new URLSearchParams({
    lang:   'en',
    max:    count.toString(),
    apikey: GNEWS_KEY,
  });

  let endpoint: string;
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
    .filter((item: any) => item.image && item.description)
    .map((item: any): Article => ({
      id:          `gnews-${topicId}-${item.publishedAt}`,
      title:       item.title,
      imageUrl:    item.image,
      topic:       TOPIC_LABELS[topicId] ?? (topicId.charAt(0).toUpperCase() + topicId.slice(1)),
      topicId,
      topicColor:  TOPIC_COLORS[topicId] ?? '#6B7280',
      difficulty:  assignDifficulty(),
      readTime:    estimateReadTime(item.description),
      publishedAt: timeAgo(item.publishedAt),
      content:     item.description,
      url:         item.url,
      source:      item.source?.name ?? 'GNews',
    }));
}

// ─── Mock feed builder ────────────────────────────────────────────────────────

// Generic images used as placeholders for custom / niche topics in mock mode
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600',
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=600',
  'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=600',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
  'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
];

const PLACEHOLDER_PREFIXES = ['Top Stories in', "What's New in", 'Latest from'];
const PLACEHOLDER_TIMES   = ['Just now', '1 hour ago', '3 hours ago'];

function generateMockArticlesForTopic(topicId: string, count = 3): Article[] {
  const name  = topicId
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const color = TOPIC_COLORS[topicId] ?? '#6B7280';

  return Array.from({ length: count }, (_, i): Article => ({
    id:          `placeholder-${topicId}-${i}`,
    title:       `${PLACEHOLDER_PREFIXES[i % PLACEHOLDER_PREFIXES.length]} ${name}`,
    imageUrl:    PLACEHOLDER_IMAGES[(topicId.length + i) % PLACEHOLDER_IMAGES.length],
    topic:       name,
    topicId,
    topicColor:  color,
    difficulty:  assignDifficulty(),
    readTime:    2 + i,
    publishedAt: PLACEHOLDER_TIMES[i],
    content:     `Stay up to date with the latest developments in ${name}. Curated content tailored to your interests.`,
    source:      'SpeakEasy',
  }));
}

function buildMockFeed(topicIds: string[]): Article[] {
  const results: Article[] = [];

  for (const topicId of topicIds) {
    const matched = MOCK_ARTICLES.filter((a) => a.topicId === topicId);
    if (matched.length > 0) {
      results.push(...matched);
    } else {
      // Custom / niche topic — generate placeholder articles so the feed has content
      results.push(...generateMockArticlesForTopic(topicId));
    }
  }

  if (results.length === 0) {
    return [...MOCK_ARTICLES].sort(() => Math.random() - 0.5);
  }

  // Shuffle so topics are interleaved, not grouped
  return results.sort(() => Math.random() - 0.5);
}

function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();

  return articles.filter((article) => {
    if (seen.has(article.id)) {
      return false;
    }

    seen.add(article.id);
    return true;
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function fetchFromBackend(topicIds: string[]): Promise<Article[] | null> {
  if (!getBackendUrl()) return null;

  try {
    const feedUrl = new URL(buildBackendUrl('/api/feed'));
    feedUrl.searchParams.set('topics', topicIds.join(','));

    const res = await fetch(feedUrl.toString());
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data?.articles)) {
      return null;
    }

    return data.articles as Article[];
  } catch {
    return null;
  }
}

export async function fetchArticlesForTopics(topicIds: string[]): Promise<Article[]> {
  const backendArticles = await fetchFromBackend(topicIds);
  if (backendArticles && backendArticles.length > 0) {
    return backendArticles;
  }

  // If no API keys are configured, use the topic-aware mock feed
  if (!GUARDIAN_KEY && !GNEWS_KEY) {
    return buildMockFeed(topicIds);
  }

  const settled = await Promise.allSettled(
    topicIds.map((topicId) => {
      const config = TOPIC_MAP[topicId];

      if (!config) {
        // Custom / niche topic — use GNews free-text search with the topicId as query
        if (!GNEWS_KEY) return Promise.resolve([]);
        return fetchFromGNews(topicId, { api: 'gnews', query: topicId }, 6);
      }

      if (config.api === 'guardian' && GUARDIAN_KEY) {
        return fetchFromGuardian(topicId, config);
      }
      if (config.api === 'gnews' && GNEWS_KEY) {
        return fetchFromGNews(topicId, config as GNewsConfig);
      }
      // Fall back for missing key
      return Promise.resolve([]);
    }),
  );

  const all = dedupeArticles(
    settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
  );

  // If APIs returned nothing (e.g. all keys missing), fall back to mock data
  if (all.length === 0) return MOCK_ARTICLES;

  // Shuffle to interleave topics
  return all.sort(() => Math.random() - 0.5);
}
