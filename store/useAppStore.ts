import { create } from 'zustand';
import { Article, VocabWord, CustomTopic, TtsVoiceOption, NativeLanguage } from '@/types';
import { MOCK_ARTICLES, MOCK_VOCAB } from '@/constants/mockData';
import { fetchArticlesForTopics } from '@/services/newsService';

// Rotating color palette for custom topics
const CUSTOM_COLORS = [
  '#6B7280', '#8B5CF6', '#F97316', '#14B8A6', '#EAB308', '#EC4899',
];

interface AppState {
  // Onboarding
  hasCompletedOnboarding: boolean;
  selectedTopics: string[];
  nativeLanguage: NativeLanguage | null;

  // Custom / niche topics
  customTopics: CustomTopic[];

  // Feed
  articles: Article[];
  isLoading: boolean;
  error: string | null;

  // Saved / liked
  savedArticles: Article[];
  likedArticles: Article[];

  // Vocabulary
  savedVocab: VocabWord[];

  // Voice
  selectedVoiceId: string | null;
  selectedVoiceName: string | null;

  // Actions
  completeOnboarding: (topics: string[], nativeLanguage: NativeLanguage) => void;
  setNativeLanguage: (nativeLanguage: NativeLanguage) => void;
  toggleTopicSelection: (topicId: string) => void;
  fetchFeed: () => Promise<void>;
  addCustomTopic: (name: string) => void;
  removeCustomTopic: (id: string) => void;
  toggleSaveArticle: (article: Article) => void;
  toggleLikeArticle: (article: Article) => void;
  saveVocabWord: (word: VocabWord) => void;
  removeVocabWord: (wordId: string) => void;
  setSelectedVoice: (voice: TtsVoiceOption) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  hasCompletedOnboarding: false,
  selectedTopics: [],
  nativeLanguage: null,
  customTopics: [],
  articles: [],
  isLoading: false,
  error: null,
  savedArticles: [],
  likedArticles: [],
  savedVocab: MOCK_VOCAB,
  selectedVoiceId: null,
  selectedVoiceName: null,

  // NOTE: fetchFeed() is called manually by the onboarding screen after this
  completeOnboarding: (topics, nativeLanguage) => {
    set({ hasCompletedOnboarding: true, selectedTopics: topics, nativeLanguage });
  },

  setNativeLanguage: (nativeLanguage) => {
    set({ nativeLanguage });
  },

  toggleTopicSelection: (topicId) => {
    const { selectedTopics } = get();
    const isSelected = selectedTopics.includes(topicId);
    set({
      selectedTopics: isSelected
        ? selectedTopics.filter((id) => id !== topicId)
        : [...selectedTopics, topicId],
    });
  },

  addCustomTopic: (name) => {
    const { customTopics, selectedTopics } = get();
    const id = name.toLowerCase().trim();
    if (customTopics.some((t) => t.id === id)) return; // deduplicate
    const color = CUSTOM_COLORS[customTopics.length % CUSTOM_COLORS.length];
    set({
      customTopics: [...customTopics, { id, name: name.trim(), color }],
      // auto-select the new topic
      selectedTopics: selectedTopics.includes(id)
        ? selectedTopics
        : [...selectedTopics, id],
    });
  },

  removeCustomTopic: (id) => {
    set((state) => ({
      customTopics: state.customTopics.filter((t) => t.id !== id),
      selectedTopics: state.selectedTopics.filter((s) => s !== id),
    }));
  },

  fetchFeed: async () => {
    const { selectedTopics } = get();
    if (selectedTopics.length === 0) return;

    set({ isLoading: true, error: null });
    try {
      const articles = await fetchArticlesForTopics(selectedTopics);
      set({ articles, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.message ?? 'Failed to load feed' });
    }
  },

  toggleSaveArticle: (article) => {
    const { savedArticles } = get();
    const isSaved = savedArticles.some((a) => a.id === article.id);
    set({
      savedArticles: isSaved
        ? savedArticles.filter((a) => a.id !== article.id)
        : [...savedArticles, { ...article, saved: true }],
    });
  },

  toggleLikeArticle: (article) => {
    const { likedArticles } = get();
    const isLiked = likedArticles.some((a) => a.id === article.id);
    set({
      likedArticles: isLiked
        ? likedArticles.filter((a) => a.id !== article.id)
        : [...likedArticles, { ...article, liked: true }],
    });
  },

  saveVocabWord: (word) => {
    const { savedVocab } = get();
    if (!savedVocab.some((v) => v.id === word.id)) {
      set({ savedVocab: [...savedVocab, word] });
    }
  },

  removeVocabWord: (wordId) => {
    set({ savedVocab: get().savedVocab.filter((v) => v.id !== wordId) });
  },

  setSelectedVoice: (voice) => {
    set({
      selectedVoiceId: voice.id,
      selectedVoiceName: voice.name,
    });
  },
}));
