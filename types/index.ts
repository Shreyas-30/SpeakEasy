import type { SubscriptionEntitlement } from '@/constants/subscription';

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type NativeLanguage =
  | 'ar'
  | 'es'
  | 'hi'
  | 'zh'
  | 'id'
  | 'ko'
  | 'ja'
  | 'fr'
  | 'de';

export type ArticleEventType =
  | 'article_open'
  | 'article_like'
  | 'article_save'
  | 'article_share'
  | 'full_article_open'
  | 'listen_start'
  | 'discuss_start'
  | 'vocab_lookup'
  | 'vocab_save';

export type DiscussionMessageRole = 'user' | 'assistant';

export interface DiscussionMessage {
  id: string;
  role: DiscussionMessageRole;
  content: string;
}

export interface Article {
  id: string;
  title: string;
  imageUrl: string;
  topic: string;
  topicId: string;
  topicColor: string;
  difficulty: DifficultyLevel;
  readTime: number; // in minutes
  publishedAt: string; // relative string like "1 hour ago"
  content: string;
  url?: string;
  source: string; // e.g. "The Guardian", "BBC News"
  likedByFriends?: string[];
  trending?: boolean;
  recommended?: boolean;
  saved?: boolean;
  liked?: boolean;
}

export interface Topic {
  id: string;
  name: string;
  imageUrl: string;
  color: string;
}

export interface CustomTopic {
  id: string;    // lowercased + trimmed, e.g. "cars", "formula 1"
  name: string;  // display name, e.g. "Cars", "Formula 1"
  color: string; // hex color from rotating palette
}

export interface VocabWord {
  id: string;
  word: string;
  definition: string;
  context: string;
  articleId: string;
  savedAt: string;
}

export interface TtsVoiceOption {
  id: string;
  name: string;
  originalName?: string;
  category?: string;
  description?: string;
  previewUrl?: string;
  labels?: Record<string, string>;
}

export interface CloudAppState {
  hasCompletedOnboarding?: boolean;
  selectedTopics?: string[];
  nativeLanguage?: NativeLanguage | null;
  customTopics?: CustomTopic[];
  savedArticles?: Article[];
  likedArticles?: Article[];
  savedVocab?: VocabWord[];
  selectedVoiceId?: string | null;
  selectedVoiceName?: string | null;
  subscriptionEntitlement?: SubscriptionEntitlement;
}
