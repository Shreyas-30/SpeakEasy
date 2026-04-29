import { TOPICS } from '@/constants/topics';
import {
  Article,
  ArticleEventType,
  CloudAppState,
  CustomTopic,
  DiscussionMessageRole,
  NativeLanguage,
  VocabWord,
} from '@/types';
import {
  DEFAULT_SUBSCRIPTION_ENTITLEMENT,
  SubscriptionEntitlement,
  SubscriptionPlanId,
  SubscriptionProvider,
  SubscriptionStatus,
} from '@/constants/subscription';
import { supabase } from './supabaseClient';

type SyncState = {
  hasCompletedOnboarding: boolean;
  selectedTopics: string[];
  nativeLanguage: NativeLanguage | null;
  customTopics: CustomTopic[];
  savedArticles: Article[];
  likedArticles: Article[];
  savedVocab: VocabWord[];
  selectedVoiceId: string | null;
  selectedVoiceName: string | null;
  subscriptionEntitlement: SubscriptionEntitlement;
};

function toArticleRow(userId: string, article: Article) {
  return {
    user_id: userId,
    article_id: article.id,
    title: article.title,
    image_url: article.imageUrl,
    topic: article.topic,
    topic_id: article.topicId,
    topic_color: article.topicColor,
    difficulty: article.difficulty,
    read_time: article.readTime,
    published_at_label: article.publishedAt,
    content: article.content,
    url: article.url ?? null,
    source: article.source,
  };
}

function fromArticleRow(row: any, state: 'saved' | 'liked'): Article {
  return {
    id: row.article_id,
    title: row.title,
    imageUrl: row.image_url,
    topic: row.topic,
    topicId: row.topic_id,
    topicColor: row.topic_color,
    difficulty: row.difficulty,
    readTime: row.read_time,
    publishedAt: row.published_at_label,
    content: row.content,
    url: row.url ?? undefined,
    source: row.source,
    saved: state === 'saved' ? true : undefined,
    liked: state === 'liked' ? true : undefined,
  };
}

function toVocabRow(userId: string, word: VocabWord) {
  return {
    id: word.id,
    user_id: userId,
    word: word.word,
    definition: word.definition,
    context: word.context,
    article_id: word.articleId,
    saved_at_label: word.savedAt,
  };
}

function fromVocabRow(row: any): VocabWord {
  return {
    id: row.id,
    word: row.word,
    definition: row.definition,
    context: row.context,
    articleId: row.article_id,
    savedAt: row.saved_at_label,
  };
}

function buildTopicRows(userId: string, state: SyncState) {
  const predefined = TOPICS.map((topic) => ({
    id: topic.id,
    name: topic.name,
    color: topic.color,
    isCustom: false,
  }));

  const custom = state.customTopics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    color: topic.color,
    isCustom: true,
  }));

  return [...predefined, ...custom]
    .filter((topic) => state.selectedTopics.includes(topic.id))
    .map((topic) => ({
      user_id: userId,
      topic_id: topic.id,
      topic_name: topic.name,
      is_custom: topic.isCustom,
      color: topic.color,
    }));
}

async function getCurrentUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

function fromProfileSubscription(profile: any): SubscriptionEntitlement {
  return {
    planId: (profile?.plan_id as SubscriptionPlanId | undefined) ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT.planId,
    status: (profile?.status as SubscriptionStatus | undefined) ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT.status,
    provider: (profile?.provider as SubscriptionProvider | undefined) ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT.provider,
    renewsAt: profile?.renews_at ?? null,
    updatedAt: profile?.updated_at ?? null,
  };
}

export async function syncProfileAndPreferences(state: SyncState): Promise<void> {
  if (!supabase) return;

  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    native_language: state.nativeLanguage,
    target_language: 'en',
    selected_voice_id: state.selectedVoiceId,
    selected_voice_name: state.selectedVoiceName,
    has_completed_onboarding: state.hasCompletedOnboarding,
    updated_at: new Date().toISOString(),
  });

  await supabase.from('user_topics').delete().eq('user_id', user.id);
  const topicRows = buildTopicRows(user.id, state);
  if (topicRows.length > 0) {
    await supabase.from('user_topics').insert(topicRows);
  }
}

export async function syncSavedArticle(article: Article, shouldSave: boolean): Promise<void> {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;

  if (!shouldSave) {
    await supabase
      .from('saved_articles')
      .delete()
      .eq('user_id', user.id)
      .eq('article_id', article.id);
    return;
  }

  await supabase.from('saved_articles').upsert(toArticleRow(user.id, article));
}

export async function syncLikedArticle(article: Article, shouldLike: boolean): Promise<void> {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;

  if (!shouldLike) {
    await supabase
      .from('liked_articles')
      .delete()
      .eq('user_id', user.id)
      .eq('article_id', article.id);
    return;
  }

  await supabase.from('liked_articles').upsert(toArticleRow(user.id, article));
}

export async function syncSavedVocabWord(word: VocabWord): Promise<void> {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('saved_vocab').upsert(toVocabRow(user.id, word));
}

export async function deleteSavedVocabWord(wordId: string): Promise<void> {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('saved_vocab').delete().eq('user_id', user.id).eq('id', wordId);
}

export async function logArticleEvent(
  eventType: ArticleEventType,
  article: Article,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from('article_events').insert({
    user_id: user.id,
    article_id: article.id,
    topic_id: article.topicId,
    source: article.source,
    difficulty: article.difficulty,
    event_type: eventType,
    metadata,
  });
}

export async function createDiscussionSession(article: Article): Promise<string | null> {
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('discussion_sessions')
    .insert({
      user_id: user.id,
      article_id: article.id,
      article_title: article.title,
      article_source: article.source,
      topic_id: article.topicId,
      difficulty: article.difficulty,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Unable to create discussion session:', error.message);
    return null;
  }

  return data.id;
}

export async function saveDiscussionMessage(
  sessionId: string | null,
  role: DiscussionMessageRole,
  content: string,
): Promise<void> {
  if (!supabase || !sessionId || !content.trim()) return;
  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await supabase.from('discussion_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role,
    content: content.trim(),
  });

  if (error) {
    console.warn('Unable to save discussion message:', error.message);
  }
}

export async function pushLocalStateToSupabase(state: SyncState): Promise<void> {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;

  await syncProfileAndPreferences(state);

  if (state.savedArticles.length > 0) {
    await supabase
      .from('saved_articles')
      .upsert(state.savedArticles.map((article) => toArticleRow(user.id, article)));
  }

  if (state.likedArticles.length > 0) {
    await supabase
      .from('liked_articles')
      .upsert(state.likedArticles.map((article) => toArticleRow(user.id, article)));
  }

  if (state.savedVocab.length > 0) {
    await supabase.from('saved_vocab').upsert(state.savedVocab.map((word) => toVocabRow(user.id, word)));
  }
}

export async function pullUserStateFromSupabase(): Promise<CloudAppState | null> {
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    profileResult,
    topicsResult,
    savedArticlesResult,
    likedArticlesResult,
    savedVocabResult,
    subscriptionResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_topics').select('*').eq('user_id', user.id),
    supabase.from('saved_articles').select('*').eq('user_id', user.id),
    supabase.from('liked_articles').select('*').eq('user_id', user.id),
    supabase.from('saved_vocab').select('*').eq('user_id', user.id),
    supabase.from('subscription_entitlements').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  const profile = profileResult.data;
  const topics = topicsResult.data ?? [];
  const savedArticles = savedArticlesResult.data ?? [];
  const likedArticles = likedArticlesResult.data ?? [];
  const savedVocab = savedVocabResult.data ?? [];
  const subscription = subscriptionResult.data;

  if (
    !profile &&
    topics.length === 0 &&
    savedArticles.length === 0 &&
    likedArticles.length === 0 &&
    savedVocab.length === 0
  ) {
    return null;
  }

  return {
    hasCompletedOnboarding: Boolean(profile?.has_completed_onboarding),
    nativeLanguage: (profile?.native_language as NativeLanguage | null) ?? null,
    selectedVoiceId: profile?.selected_voice_id ?? null,
    selectedVoiceName: profile?.selected_voice_name ?? null,
    subscriptionEntitlement: fromProfileSubscription(subscription),
    selectedTopics: topics.map((topic) => topic.topic_id),
    customTopics: topics
      .filter((topic) => topic.is_custom)
      .map((topic) => ({
        id: topic.topic_id,
        name: topic.topic_name,
        color: topic.color,
      })),
    savedArticles: savedArticles.map((row) => fromArticleRow(row, 'saved')),
    likedArticles: likedArticles.map((row) => fromArticleRow(row, 'liked')),
    savedVocab: savedVocab.map(fromVocabRow),
  };
}
