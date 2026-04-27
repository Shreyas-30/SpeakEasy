import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Article,
  VocabWord,
  CustomTopic,
  TtsVoiceOption,
  NativeLanguage,
  CloudAppState,
} from '@/types';
import {
  HardPaywallReason,
  SoftPromptTrigger,
  SubscriptionEntitlement,
  SUBSCRIPTION_LIMITS,
  DEFAULT_SUBSCRIPTION_ENTITLEMENT,
} from '@/src/config/subscriptionPlans';
import {
  hasPaidEntitlement,
  requestSubscriptionUpgrade,
  restoreSubscriptionEntitlement,
} from '@/services/subscriptionService';
import { MOCK_VOCAB } from '@/constants/mockData';
import { fetchArticlesForTopics } from '@/services/newsService';
import {
  deleteSavedVocabWord,
  logArticleEvent,
  syncLikedArticle,
  syncProfileAndPreferences,
  syncSavedArticle,
  syncSavedVocabWord,
} from '@/services/supabaseSyncService';

// Rotating color palette for custom topics
const CUSTOM_COLORS = [
  '#6B7280', '#8B5CF6', '#F97316', '#14B8A6', '#EAB308', '#EC4899',
];

type DailyUsage = {
  date: string;
  articlesOpened: number;
  speakingSessionsStarted: number;
  wordsLearned: number;
  dismissedSoftPrompts: SoftPromptTrigger[];
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDailyUsage(): DailyUsage {
  return {
    date: getTodayKey(),
    articlesOpened: 0,
    speakingSessionsStarted: 0,
    wordsLearned: 0,
    dismissedSoftPrompts: [],
  };
}

function normalizeDailyUsage(dailyUsage: DailyUsage): DailyUsage {
  return dailyUsage.date === getTodayKey() ? dailyUsage : createDailyUsage();
}

interface AppState {
  // Onboarding
  hasHydrated: boolean;
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

  // Subscription
  subscriptionEntitlement: SubscriptionEntitlement;
  dailyUsage: DailyUsage;
  activeSoftPrompt: SoftPromptTrigger | null;
  pendingHardPaywall: HardPaywallReason | null;
  isRefreshingEntitlement: boolean;

  // Actions
  setHasHydrated: (hasHydrated: boolean) => void;
  applyCloudState: (state: CloudAppState) => void;
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
  requestPlanUpgrade: (planId: SubscriptionEntitlement['planId']) => Promise<void>;
  restoreSubscription: () => Promise<void>;
  applySubscriptionEntitlement: (entitlement: SubscriptionEntitlement) => void;
  clearHardPaywall: () => void;
  dismissSoftPrompt: (trigger?: SoftPromptTrigger) => void;
  canOpenArticle: () => boolean;
  recordArticleOpen: () => void;
  canSaveVocabWord: () => boolean;
  canStartSpeakingPractice: () => boolean;
  recordSpeakingPracticeStart: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
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
      subscriptionEntitlement: DEFAULT_SUBSCRIPTION_ENTITLEMENT,
      dailyUsage: createDailyUsage(),
      activeSoftPrompt: null,
      pendingHardPaywall: null,
      isRefreshingEntitlement: false,

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },

      applyCloudState: (cloudState) => {
        set((state) => ({
          hasCompletedOnboarding:
            cloudState.hasCompletedOnboarding ?? state.hasCompletedOnboarding,
          selectedTopics: cloudState.selectedTopics ?? state.selectedTopics,
          nativeLanguage:
            cloudState.nativeLanguage !== undefined
              ? cloudState.nativeLanguage
              : state.nativeLanguage,
          customTopics: cloudState.customTopics ?? state.customTopics,
          savedArticles: cloudState.savedArticles ?? state.savedArticles,
          likedArticles: cloudState.likedArticles ?? state.likedArticles,
          savedVocab: cloudState.savedVocab ?? state.savedVocab,
          selectedVoiceId:
            cloudState.selectedVoiceId !== undefined
              ? cloudState.selectedVoiceId
              : state.selectedVoiceId,
          selectedVoiceName:
            cloudState.selectedVoiceName !== undefined
              ? cloudState.selectedVoiceName
              : state.selectedVoiceName,
          subscriptionEntitlement:
            cloudState.subscriptionEntitlement ?? state.subscriptionEntitlement,
        }));
      },

      // NOTE: fetchFeed() is called manually by the onboarding screen after this
      completeOnboarding: (topics, nativeLanguage) => {
        set({ hasCompletedOnboarding: true, selectedTopics: topics, nativeLanguage });
        void syncProfileAndPreferences(get());
      },

      setNativeLanguage: (nativeLanguage) => {
        set({ nativeLanguage });
        void syncProfileAndPreferences(get());
      },

      toggleTopicSelection: (topicId) => {
        const { selectedTopics } = get();
        const isSelected = selectedTopics.includes(topicId);
        set({
          selectedTopics: isSelected
            ? selectedTopics.filter((id) => id !== topicId)
            : [...selectedTopics, topicId],
        });
        void syncProfileAndPreferences(get());
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
        void syncProfileAndPreferences(get());
      },

      removeCustomTopic: (id) => {
        set((state) => ({
          customTopics: state.customTopics.filter((t) => t.id !== id),
          selectedTopics: state.selectedTopics.filter((s) => s !== id),
        }));
        void syncProfileAndPreferences(get());
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
        void syncSavedArticle(article, !isSaved);
        if (!isSaved) {
          void logArticleEvent('article_save', article);
        }
      },

      toggleLikeArticle: (article) => {
        const { likedArticles } = get();
        const isLiked = likedArticles.some((a) => a.id === article.id);
        set({
          likedArticles: isLiked
            ? likedArticles.filter((a) => a.id !== article.id)
            : [...likedArticles, { ...article, liked: true }],
        });
        void syncLikedArticle(article, !isLiked);
        if (!isLiked) {
          void logArticleEvent('article_like', article);
        }
      },

      saveVocabWord: (word) => {
        const { savedVocab } = get();
        if (!get().canSaveVocabWord()) return;

        if (!savedVocab.some((v) => v.id === word.id)) {
          const dailyUsage = normalizeDailyUsage(get().dailyUsage);
          const nextUsage = {
            ...dailyUsage,
            wordsLearned: dailyUsage.wordsLearned + 1,
          };
          const shouldShowSoftPrompt =
            !hasPaidEntitlement(get().subscriptionEntitlement) &&
            nextUsage.wordsLearned >= SUBSCRIPTION_LIMITS.free.softPromptAfterWordsLearned &&
            !nextUsage.dismissedSoftPrompts.includes('wordsLearned');

          set({
            savedVocab: [...savedVocab, word],
            dailyUsage: nextUsage,
            activeSoftPrompt: shouldShowSoftPrompt ? 'wordsLearned' : get().activeSoftPrompt,
          });
          void syncSavedVocabWord(word);
        }
      },

      removeVocabWord: (wordId) => {
        set({ savedVocab: get().savedVocab.filter((v) => v.id !== wordId) });
        void deleteSavedVocabWord(wordId);
      },

      setSelectedVoice: (voice) => {
        set({
          selectedVoiceId: voice.id,
          selectedVoiceName: voice.name,
        });
        void syncProfileAndPreferences(get());
      },

      requestPlanUpgrade: async (planId) => {
        set({ isRefreshingEntitlement: true });
        const entitlement = await requestSubscriptionUpgrade(planId);

        set((state) => ({
          isRefreshingEntitlement: false,
          subscriptionEntitlement: entitlement ?? state.subscriptionEntitlement,
          pendingHardPaywall: entitlement ? null : state.pendingHardPaywall,
          activeSoftPrompt: entitlement ? null : state.activeSoftPrompt,
        }));
      },

      restoreSubscription: async () => {
        set({ isRefreshingEntitlement: true });
        const entitlement = await restoreSubscriptionEntitlement();

        set((state) => ({
          isRefreshingEntitlement: false,
          subscriptionEntitlement: entitlement ?? state.subscriptionEntitlement,
          pendingHardPaywall: entitlement ? null : state.pendingHardPaywall,
          activeSoftPrompt: entitlement ? null : state.activeSoftPrompt,
        }));
      },

      applySubscriptionEntitlement: (entitlement) => {
        set({
          subscriptionEntitlement: entitlement,
          pendingHardPaywall: hasPaidEntitlement(entitlement) ? null : get().pendingHardPaywall,
          activeSoftPrompt: hasPaidEntitlement(entitlement) ? null : get().activeSoftPrompt,
        });
      },

      clearHardPaywall: () => {
        set({ pendingHardPaywall: null });
      },

      dismissSoftPrompt: (trigger) => {
        const currentTrigger = trigger ?? get().activeSoftPrompt;
        if (!currentTrigger) {
          set({ activeSoftPrompt: null });
          return;
        }

        const dailyUsage = normalizeDailyUsage(get().dailyUsage);
        set({
          activeSoftPrompt: null,
          dailyUsage: {
            ...dailyUsage,
            dismissedSoftPrompts: dailyUsage.dismissedSoftPrompts.includes(currentTrigger)
              ? dailyUsage.dismissedSoftPrompts
              : [...dailyUsage.dismissedSoftPrompts, currentTrigger],
          },
        });
      },

      canOpenArticle: () => {
        const { subscriptionEntitlement } = get();
        if (hasPaidEntitlement(subscriptionEntitlement)) return true;

        const dailyUsage = normalizeDailyUsage(get().dailyUsage);
        if (dailyUsage.articlesOpened >= SUBSCRIPTION_LIMITS.free.articlesPerDay) {
          set({ dailyUsage, pendingHardPaywall: 'article-limit' });
          return false;
        }

        set({ dailyUsage });
        return true;
      },

      recordArticleOpen: () => {
        const { subscriptionEntitlement } = get();
        const dailyUsage = normalizeDailyUsage(get().dailyUsage);
        const nextUsage = {
          ...dailyUsage,
          articlesOpened: dailyUsage.articlesOpened + 1,
        };
        const shouldShowSoftPrompt =
          !hasPaidEntitlement(subscriptionEntitlement) &&
          nextUsage.articlesOpened >= SUBSCRIPTION_LIMITS.free.softPromptAfterArticlesRead &&
          !nextUsage.dismissedSoftPrompts.includes('articlesRead');

        set({
          dailyUsage: nextUsage,
          activeSoftPrompt: shouldShowSoftPrompt ? 'articlesRead' : get().activeSoftPrompt,
        });
      },

      canSaveVocabWord: () => {
        const { subscriptionEntitlement, savedVocab } = get();
        if (hasPaidEntitlement(subscriptionEntitlement)) return true;

        if (savedVocab.length >= SUBSCRIPTION_LIMITS.free.savedWords) {
          set({ pendingHardPaywall: 'saved-word-limit' });
          return false;
        }

        return true;
      },

      canStartSpeakingPractice: () => {
        const { subscriptionEntitlement } = get();
        if (hasPaidEntitlement(subscriptionEntitlement)) return true;

        const dailyUsage = normalizeDailyUsage(get().dailyUsage);
        if (
          dailyUsage.speakingSessionsStarted >=
          SUBSCRIPTION_LIMITS.free.speakingSessionsPerDay
        ) {
          set({ dailyUsage, pendingHardPaywall: 'speaking-limit' });
          return false;
        }

        set({ dailyUsage });
        return true;
      },

      recordSpeakingPracticeStart: () => {
        const { subscriptionEntitlement } = get();
        const dailyUsage = normalizeDailyUsage(get().dailyUsage);
        const nextUsage = {
          ...dailyUsage,
          speakingSessionsStarted: dailyUsage.speakingSessionsStarted + 1,
        };
        const shouldShowSoftPrompt =
          !hasPaidEntitlement(subscriptionEntitlement) &&
          nextUsage.speakingSessionsStarted >=
            SUBSCRIPTION_LIMITS.free.softPromptAfterSpeakingSessions &&
          !nextUsage.dismissedSoftPrompts.includes('speakingSessions');

        set({
          dailyUsage: nextUsage,
          activeSoftPrompt: shouldShowSoftPrompt ? 'speakingSessions' : get().activeSoftPrompt,
        });
      },
    }),
    {
      name: 'speakeasy-app-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedTopics: state.selectedTopics,
        nativeLanguage: state.nativeLanguage,
        customTopics: state.customTopics,
        articles: state.articles,
        savedArticles: state.savedArticles,
        likedArticles: state.likedArticles,
        savedVocab: state.savedVocab,
        selectedVoiceId: state.selectedVoiceId,
        selectedVoiceName: state.selectedVoiceName,
        subscriptionEntitlement: state.subscriptionEntitlement,
        dailyUsage: state.dailyUsage,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
