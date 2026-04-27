import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  Linking,
  Share,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Colors } from '@/constants/colors';
import { useAppStore } from '@/store/useAppStore';
import { VocabWord } from '@/types';
import { HardPaywall } from '@/components/HardPaywall';
import { SoftUpgradePrompt } from '@/components/SoftUpgradePrompt';
import {
  lookupWord,
  WordDefinition,
  TranslatedWordDefinition,
  translateWordDefinition,
} from '@/services/dictionaryService';
import {
  getTtsMode,
  requestArticleSpeechUrl,
  requestSpeechUrl,
  speakArticleOnDevice,
  speakTextOnDevice,
  stopDeviceSpeech,
} from '@/services/ttsService';
import { logArticleEvent } from '@/services/supabaseSyncService';

const HERO_HEIGHT = 220;
const NATIVE_LANGUAGE_LABELS = {
  ar: 'Arabic',
  es: 'Spanish',
  hi: 'Hindi',
  zh: 'Chinese',
  id: 'Indonesian',
  ko: 'Korean',
  ja: 'Japanese',
  fr: 'French',
  de: 'German',
} as const;

function stripPunctuation(word: string): string {
  return word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
}

export default function ArticleReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    articles,
    savedArticles,
    likedArticles,
    savedVocab,
    nativeLanguage,
    selectedVoiceId,
    pendingHardPaywall,
    activeSoftPrompt,
    toggleLikeArticle,
    saveVocabWord,
    canStartSpeakingPractice,
    recordArticleOpen,
    recordSpeakingPracticeStart,
    clearHardPaywall,
    dismissSoftPrompt,
  } = useAppStore();

  // Find article across all lists
  const article = [...articles, ...savedArticles].find((a) => a.id === id);

  // Scroll animation for header title fade
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT - 60, HERO_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Word definition sheet state
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDef, setWordDef] = useState<WordDefinition | null>(null);
  const [translatedWordDef, setTranslatedWordDef] = useState<TranslatedWordDefinition | null>(null);
  const [definitionView, setDefinitionView] = useState<'english' | 'native'>('english');
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isPronouncingWord, setIsPronouncingWord] = useState(false);
  const [isPreparingWordAudio, setIsPreparingWordAudio] = useState(false);
  const [wordAudioSource, setWordAudioSource] = useState<string | null>(null);
  const [wordAudioKey, setWordAudioKey] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const hasLoggedArticleOpen = useRef(false);
  const player = useAudioPlayer(null, { downloadFirst: true, updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);
  const wordPlayer = useAudioPlayer(null, { downloadFirst: true, updateInterval: 250 });
  const wordPlayerStatus = useAudioPlayerStatus(wordPlayer);

  const isLiked = likedArticles.some((a) => a.id === id);
  const savedVocabWords = savedVocab.map((v) => v.word.toLowerCase());

  const openSheet = () => {
    setSheetVisible(true);
    sheetAnim.setValue(400);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      void stopDeviceSpeech();
      try {
        wordPlayer.pause();
      } catch {}
      setIsPronouncingWord(false);
      setIsPreparingWordAudio(false);
      setSheetVisible(false);
      setSelectedWord(null);
      setWordDef(null);
      setTranslatedWordDef(null);
      setDefinitionView('english');
      setIsLoadingTranslation(false);
      setWordAudioKey(null);
      setWordAudioSource(null);
    });
  }, [sheetAnim, wordPlayer]);

  const handleWordTap = useCallback(
    async (token: string) => {
      const clean = stripPunctuation(token);
      if (!clean || clean.length < 2) return;

      setSelectedWord(clean.toLowerCase());
      setWordDef(null);
      setTranslatedWordDef(null);
      setDefinitionView('english');
      setIsLoadingDef(true);
      setIsLoadingTranslation(false);
      openSheet();
      if (article) {
        void logArticleEvent('vocab_lookup', article, { word: clean.toLowerCase() });
      }

      const def = await lookupWord(clean);
      setWordDef(def);
      setIsLoadingDef(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [article]
  );

  const handleSaveWord = useCallback(() => {
    if (!article || !wordDef) return;
    const vocabWord: VocabWord = {
      id: `${article.id}-${wordDef.word}-${Date.now()}`,
      word: wordDef.word,
      definition: wordDef.definition,
      context: article.content,
      articleId: article.id,
      savedAt: 'just now',
    };
    saveVocabWord(vocabWord);
    void logArticleEvent('vocab_save', article, { word: wordDef.word });
  }, [article, wordDef, saveVocabWord]);

  const handlePronounceSelectedWord = useCallback(async () => {
    const wordToSpeak = wordDef?.word ?? selectedWord;
    if (!wordToSpeak) return;
    const activeVoiceKey = selectedVoiceId ?? 'default';
    const nextWordAudioKey = `${activeVoiceKey}:${wordToSpeak.toLowerCase()}`;

    try {
      if (getTtsMode() === 'elevenlabs-proxy') {
        if (wordPlayerStatus.playing || isPreparingWordAudio) {
          try {
            wordPlayer.pause();
          } catch {}
          try {
            await wordPlayer.seekTo(0);
          } catch {}
          setIsPronouncingWord(false);
          setIsPreparingWordAudio(false);
          return;
        }

        setIsPronouncingWord(true);

        if (wordAudioSource && wordAudioKey === nextWordAudioKey) {
          try {
            await wordPlayer.seekTo(0);
            wordPlayer.play();
            return;
          } catch {
            // If replay fails, fetch a fresh URL below.
          }
        }

        setIsPreparingWordAudio(true);
        const nextWordAudioUrl = await requestSpeechUrl(wordToSpeak, selectedVoiceId);
        setWordAudioSource(nextWordAudioUrl);
        setWordAudioKey(nextWordAudioKey);
        wordPlayer.replace(nextWordAudioUrl);
        return;
      }

      if (isPronouncingWord) {
        await stopDeviceSpeech();
        setIsPronouncingWord(false);
        return;
      }

      await speakTextOnDevice(wordToSpeak, {
        onStart: () => setIsPronouncingWord(true),
        onDone: () => setIsPronouncingWord(false),
        onError: () => setIsPronouncingWord(false),
      });
    } catch {
      setIsPreparingWordAudio(false);
      setIsPronouncingWord(false);
    }
  }, [
    isPreparingWordAudio,
    isPronouncingWord,
    selectedVoiceId,
    selectedWord,
    wordAudioKey,
    wordAudioSource,
    wordDef?.word,
    wordPlayer,
    wordPlayerStatus.playing,
  ]);

  const resetProxyPlayback = useCallback(async () => {
    try {
      player.pause();
    } catch {
      // Ignore teardown races when the native player is already gone.
    }

    try {
      await player.seekTo(0);
    } catch {
      // Ignore teardown races when the native player is already gone.
    }
  }, [player]);

  const handleListenToggle = useCallback(async () => {
    if (!article) return;

    setListenError(null);

    if (getTtsMode() === 'elevenlabs-proxy') {
      if (playerStatus.playing || isPreparingAudio) {
        await resetProxyPlayback();
        setIsPreparingAudio(false);
        setIsListening(false);
        return;
      }

      try {
        setIsListening(true);
        void logArticleEvent('listen_start', article);

        if (audioSource) {
          try {
            await player.seekTo(0);
            player.play();
          } catch (error) {
            throw error instanceof Error
              ? error
              : new Error('Unable to resume ElevenLabs playback.');
          }
          return;
        }

        setIsPreparingAudio(true);
        const nextAudioUrl = await requestArticleSpeechUrl(
          article.title,
          article.source,
          article.content,
          selectedVoiceId,
        );
        setAudioSource(nextAudioUrl);
        player.replace(nextAudioUrl);
      } catch (error) {
        setListenError(
          error instanceof Error ? error.message : 'Unable to start ElevenLabs playback.',
        );
        setIsPreparingAudio(false);
        setIsListening(false);
      }
      return;
    }

    if (isListening) {
      await stopDeviceSpeech();
      setIsListening(false);
      return;
    }

    try {
      void logArticleEvent('listen_start', article);
      await speakArticleOnDevice(article.title, article.source, article.content, {
        onStart: () => setIsListening(true),
        onDone: () => setIsListening(false),
        onError: () => setIsListening(false),
      });
    } catch (error) {
      setListenError(error instanceof Error ? error.message : 'Unable to start audio playback.');
    }
  }, [
    article,
    audioSource,
    isListening,
    isPreparingAudio,
    player,
    playerStatus.playing,
    resetProxyPlayback,
    selectedVoiceId,
  ]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });
  }, []);

  useEffect(() => {
    if (!article || hasLoggedArticleOpen.current) return;
    hasLoggedArticleOpen.current = true;
    recordArticleOpen();
    void logArticleEvent('article_open', article);
  }, [article, recordArticleOpen]);

  useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;

    if (isPreparingAudio && playerStatus.isLoaded && !playerStatus.isBuffering) {
      player.volume = 1.0;
      player.play();
      setIsPreparingAudio(false);
    }
  }, [isPreparingAudio, player, playerStatus.isBuffering, playerStatus.isLoaded]);

  useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;

    if (isPreparingWordAudio && wordPlayerStatus.isLoaded && !wordPlayerStatus.isBuffering) {
      wordPlayer.volume = 1.0;
      wordPlayer.play();
      setIsPreparingWordAudio(false);
    }
  }, [isPreparingWordAudio, wordPlayer, wordPlayerStatus.isBuffering, wordPlayerStatus.isLoaded]);

  useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;

    if (playerStatus.playing) {
      setIsListening(true);
      return;
    }

    if (playerStatus.didJustFinish) {
      setIsListening(false);
      void resetProxyPlayback();
    }
  }, [playerStatus.didJustFinish, playerStatus.playing, resetProxyPlayback]);

  useEffect(() => {
    setAudioSource(null);
    setWordAudioSource(null);
    setWordAudioKey(null);
    setIsListening(false);
    setIsPronouncingWord(false);
    setIsPreparingAudio(false);
    setIsPreparingWordAudio(false);
  }, [selectedVoiceId]);

  useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;

    if (wordPlayerStatus.playing) {
      setIsPronouncingWord(true);
      return;
    }

    if (wordPlayerStatus.didJustFinish) {
      setIsPronouncingWord(false);
      try {
        void wordPlayer.seekTo(0);
      } catch {}
    }
  }, [wordPlayer, wordPlayerStatus.didJustFinish, wordPlayerStatus.playing]);

  useEffect(() => {
    return () => {
      void stopDeviceSpeech();
      void resetProxyPlayback();
      try {
        wordPlayer.pause();
      } catch {}
    };
  }, [resetProxyPlayback, wordPlayer]);

  useEffect(() => {
    if (!wordDef || !nativeLanguage) return;
    if (translatedWordDef?.nativeLanguage === nativeLanguage) return;

    let isMounted = true;

    const loadTranslation = async () => {
      setIsLoadingTranslation(true);
      const translated = await translateWordDefinition(
        wordDef.word,
        wordDef.definition,
        nativeLanguage,
      );

      if (!isMounted) return;

      setTranslatedWordDef(translated);
      setIsLoadingTranslation(false);
    };

    void loadTranslation();

    return () => {
      isMounted = false;
    };
  }, [nativeLanguage, translatedWordDef?.nativeLanguage, wordDef]);

  // Not found state
  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.notFoundText}>Article not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLinkBtn}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const words = article.content.split(' ').filter(Boolean);

  const difficultyStyle = {
    Beginner: { bg: Colors.beginner.bg, text: Colors.beginner.text },
    Intermediate: { bg: Colors.intermediate.bg, text: Colors.intermediate.text },
    Advanced: { bg: Colors.advanced.bg, text: Colors.advanced.text },
  }[article.difficulty];

  const articleVocab = savedVocab.filter((v) => v.articleId === article.id);
  const isWordAlreadySaved =
    selectedWord != null && savedVocabWords.includes(selectedWord.toLowerCase());
  const nativeLanguageLabel = nativeLanguage ? NATIVE_LANGUAGE_LABELS[nativeLanguage] : 'Native';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── Sticky Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <Animated.Text
          style={[styles.headerTitle, { opacity: headerTitleOpacity }]}
          numberOfLines={1}
        >
          {article.title}
        </Animated.Text>
      </View>

      {/* ── Scrollable body ── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.contentColumn}>
        {/* Hero image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>

        {/* Article info */}
        <View style={styles.infoSection}>
          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: article.topicColor }]}>
              <Text style={styles.badgeText}>{article.topic}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: difficultyStyle.bg }]}>
              <Text style={[styles.badgeText, { color: difficultyStyle.text }]}>
                {article.difficulty}
              </Text>
            </View>
          </View>

          <Text style={styles.articleTitle}>{article.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{article.source}</Text>
            <Text style={styles.metaText}>{article.readTime} min read</Text>
            <Text style={styles.metaText}>{article.publishedAt}</Text>
          </View>

          <TouchableOpacity
            style={[styles.listenBtn, isListening && styles.listenBtnActive]}
            onPress={handleListenToggle}
            activeOpacity={0.85}
          >
            <View style={[styles.listenIconWrap, isListening && styles.listenIconWrapActive]}>
              <Ionicons
                name={isListening ? 'stop-circle' : isPreparingAudio ? 'hourglass-outline' : 'volume-high'}
                size={16}
                color={isListening ? '#FFFFFF' : Colors.accent}
              />
            </View>
            <View style={styles.listenCopy}>
              <Text style={[styles.listenTitle, isListening && styles.listenTitleActive]}>
                {isListening
                  ? 'Stop listening'
                  : isPreparingAudio
                    ? 'Preparing audio...'
                    : 'Listen to this article'}
              </Text>
              <Text style={styles.listenSubtitle}>
                Voice playback for pronunciation and pacing
              </Text>
            </View>
          </TouchableOpacity>

          {listenError ? <Text style={styles.listenError}>{listenError}</Text> : null}

          {activeSoftPrompt ? (
            <View style={styles.softPromptWrap}>
              <SoftUpgradePrompt
                trigger={activeSoftPrompt}
                onDismiss={() => dismissSoftPrompt()}
                onSeePlans={() => {
                  dismissSoftPrompt();
                  router.push('/subscription' as any);
                }}
              />
            </View>
          ) : null}
        </View>

        {/* ── Reading Zone ── */}
        <View style={styles.readingZone}>
          <View style={styles.tipRow}>
            <Ionicons name="bulb-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.tipText}>Tap any word to look it up</Text>
          </View>

          {/* Interactive word-by-word content */}
          <View style={styles.contentWrapper}>
            {words.map((word, idx) => {
              const clean = stripPunctuation(word).toLowerCase();
              const isSelected = selectedWord === clean && sheetVisible;
              const isKnown = clean.length > 1 && savedVocabWords.includes(clean);

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleWordTap(word)}
                  activeOpacity={0.65}
                  style={styles.wordWrap}
                >
                  <Text
                    style={[
                      styles.word,
                      isSelected && styles.wordSelected,
                      isKnown && !isSelected && styles.wordKnown,
                    ]}
                  >
                    {word}{' '}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Saved vocab from this article ── */}
        {articleVocab.length > 0 && (
          <View style={styles.vocabSection}>
            <Text style={styles.vocabSectionTitle}>Words you&apos;ve saved from this article</Text>
            <View style={styles.vocabChips}>
              {articleVocab.map((v) => (
                <View key={v.id} style={styles.vocabChip}>
                  <Text style={styles.vocabChipText}>{v.word}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.discussButton}
          onPress={() => {
            if (!canStartSpeakingPractice()) return;
            recordSpeakingPracticeStart();
            void logArticleEvent('discuss_start', article);
            router.push({ pathname: '/discuss/[id]', params: { id: article.id } })
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.discussButtonText}>Discuss this article</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
        </View>
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => toggleLikeArticle(article)}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? Colors.error : Colors.textSecondary}
          />
          <Text style={[styles.actionLabel, isLiked && { color: Colors.error }]}>Like</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            void logArticleEvent('article_share', article);
            void Share.share({
              message: article.title,
              url: article.url ?? '',
            });
          }}
        >
          <Ionicons
            name="share-outline"
            size={22}
            color={Colors.textSecondary}
          />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (article.url) {
              void logArticleEvent('full_article_open', article);
              void Linking.openURL(article.url);
            }
          }}
          disabled={!article.url}
        >
          <Ionicons
            name="open-outline"
            size={22}
            color={article.url ? Colors.textSecondary : Colors.textMuted}
          />
          <Text style={styles.actionLabel}>Full article</Text>
        </TouchableOpacity>
      </View>

      <HardPaywall
        visible={Boolean(pendingHardPaywall)}
        reason={pendingHardPaywall}
        onClose={clearHardPaywall}
        onUpgrade={() => {
          clearHardPaywall();
          router.push('/subscription' as any);
        }}
      />

      {/* ── Word Definition Bottom Sheet ── */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet}>
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            {/* Prevent tap-through on the sheet itself */}
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              {/* Drag handle */}
              <View style={styles.sheetHandle} />

              {/* Close button */}
              <TouchableOpacity style={styles.sheetClose} onPress={closeSheet}>
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>

              {isLoadingDef ? (
                <View style={styles.sheetLoading}>
                  <ActivityIndicator color={Colors.accent} />
                  <Text style={styles.sheetLoadingText}>
                    Looking up &quot;{selectedWord}&quot;…
                  </Text>
                </View>
              ) : wordDef ? (
                <View style={styles.sheetContent}>
                  {/* Word + part of speech */}
                  <View style={styles.sheetWordRow}>
                    <View style={styles.sheetWordPrimary}>
                      <Text style={styles.sheetWord}>{wordDef.word}</Text>
                      <TouchableOpacity
                        style={[
                          styles.wordAudioButton,
                          isPronouncingWord && styles.wordAudioButtonActive,
                        ]}
                        onPress={handlePronounceSelectedWord}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={isPronouncingWord ? 'stop-circle' : 'volume-high'}
                          size={16}
                          color={isPronouncingWord ? '#FFFFFF' : Colors.accent}
                        />
                      </TouchableOpacity>
                    </View>
                    {wordDef.partOfSpeech && (
                      <View style={styles.posTag}>
                        <Text style={styles.posTagText}>{wordDef.partOfSpeech}</Text>
                      </View>
                    )}
                  </View>

                  {/* Phonetic */}
                  {wordDef.phonetic && (
                    <Text style={styles.phonetic}>{wordDef.phonetic}</Text>
                  )}

                  {nativeLanguage ? (
                    <View style={styles.definitionTabs}>
                      <TouchableOpacity
                        style={[
                          styles.definitionTab,
                          definitionView === 'english' && styles.definitionTabActive,
                        ]}
                        onPress={() => setDefinitionView('english')}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.definitionTabText,
                            definitionView === 'english' && styles.definitionTabTextActive,
                          ]}
                        >
                          English
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.definitionTab,
                          definitionView === 'native' && styles.definitionTabActive,
                        ]}
                        onPress={() => setDefinitionView('native')}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.definitionTabText,
                            definitionView === 'native' && styles.definitionTabTextActive,
                          ]}
                        >
                          {nativeLanguageLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {definitionView === 'native' && translatedWordDef ? (
                    <View style={styles.translationBlock}>
                      <Text style={styles.translationWord}>{translatedWordDef.translatedWord}</Text>
                      <Text style={styles.translationCaption}>
                        In your native language
                      </Text>
                    </View>
                  ) : null}

                  {definitionView === 'native' && nativeLanguage ? (
                    isLoadingTranslation ? (
                      <View style={styles.translationLoading}>
                        <ActivityIndicator color={Colors.accent} size="small" />
                        <Text style={styles.translationLoadingText}>
                          Translating this definition...
                        </Text>
                      </View>
                    ) : translatedWordDef ? (
                      <Text style={styles.definition}>{translatedWordDef.translatedDefinition}</Text>
                    ) : (
                      <Text style={styles.translationFallback}>
                        Translation unavailable right now.
                      </Text>
                    )
                  ) : (
                    <Text style={styles.definition}>{wordDef.definition}</Text>
                  )}

                  {/* Example */}
                  {wordDef.example && (
                    <Text style={styles.example}>&quot;{wordDef.example}&quot;</Text>
                  )}

                  {/* Save button */}
                  <TouchableOpacity
                    style={[
                      styles.saveWordBtn,
                      isWordAlreadySaved && styles.saveWordBtnSaved,
                    ]}
                    onPress={isWordAlreadySaved ? undefined : handleSaveWord}
                    activeOpacity={isWordAlreadySaved ? 1 : 0.8}
                  >
                    <Ionicons
                      name={isWordAlreadySaved ? 'checkmark-circle' : 'bookmark-outline'}
                      size={16}
                      color={isWordAlreadySaved ? Colors.success : '#fff'}
                    />
                    <Text
                      style={[
                        styles.saveWordText,
                        isWordAlreadySaved && { color: Colors.success },
                      ]}
                    >
                      {isWordAlreadySaved ? 'Already saved' : 'Save to Vocabulary'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.sheetContent}>
                  <Text style={styles.sheetWord}>{selectedWord}</Text>
                  <Text style={styles.noDefText}>
                    No definition found for this word.
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  contentColumn: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // ── Hero ──
  heroContainer: {
    width: '100%',
    height: HERO_HEIGHT,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 18,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 140,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7C4CA1',
  },

  // ── Article info ──
  infoSection: {
    paddingTop: 2,
  },
  articleTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    opacity: 0.5,
    marginTop: 10,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text,
  },
  listenBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(232,238,244,0.55)',
  },
  listenBtnActive: {
    backgroundColor: '#E9EEF8',
  },
  listenIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  listenIconWrapActive: {
    backgroundColor: '#3965B5',
  },
  listenCopy: {
    flex: 1,
    gap: 2,
  },
  listenTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3965B5',
  },
  listenTitleActive: {
    color: '#23488A',
  },
  listenSubtitle: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
  },
  listenError: {
    fontSize: 12,
    color: Colors.error,
    lineHeight: 17,
    marginTop: 8,
  },
  softPromptWrap: {
    marginTop: 14,
  },

  // ── Reading zone ──
  readingZone: {
    paddingTop: 16,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    backgroundColor: 'rgba(232,230,217,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  tipText: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
  },
  contentWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordWrap: {
    // Allows flex wrapping per word
  },
  word: {
    fontSize: 14,
    lineHeight: 26,
    color: 'rgba(0,0,0,0.7)',
    letterSpacing: 0.1,
  },
  wordSelected: {
    backgroundColor: '#DBEAFE',
    color: Colors.accent,
    borderRadius: 4,
    overflow: 'hidden',
  },
  wordKnown: {
    color: Colors.text,
    borderBottomWidth: 2,
    borderBottomColor: Colors.success,
  },

  // ── Vocab chips ──
  vocabSection: {
    marginTop: 8,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  vocabSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 10,
  },
  vocabChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  vocabChip: {
    backgroundColor: '#D1FAE5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vocabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },

  bottomSpacer: {
    height: 8,
  },
  discussButton: {
    marginTop: 26,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#66643B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussButtonText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // ── Bottom action bar ──
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    paddingVertical: 10,
    minHeight: 85,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actionLabelActive: {
    color: Colors.accent,
  },
  actionDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // ── Bottom sheet ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    minHeight: 180,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderStrong,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetClose: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
  },
  sheetLoading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  sheetLoadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sheetContent: {
    gap: 8,
    paddingTop: 4,
  },
  sheetWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sheetWordPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetWord: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  wordAudioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },
  wordAudioButtonActive: {
    backgroundColor: Colors.accent,
  },
  posTag: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  posTagText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  phonetic: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  definitionTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  definitionTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  definitionTabActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#B8D0FF',
  },
  definitionTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  definitionTabTextActive: {
    color: Colors.accent,
  },
  translationBlock: {
    gap: 2,
    marginTop: 4,
  },
  translationWord: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  translationCaption: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  definition: {
    fontSize: 16,
    lineHeight: 23,
    color: Colors.text,
  },
  translationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  translationLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  translationFallback: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  example: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  saveWordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 6,
    justifyContent: 'center',
  },
  saveWordBtnSaved: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveWordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  noDefText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // ── Not found ──
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backLinkBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.accent,
    borderRadius: 8,
  },
  backLinkText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
