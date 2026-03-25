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
