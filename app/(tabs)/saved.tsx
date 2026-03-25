import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Colors } from '@/constants/colors';
import { useAppStore } from '@/store/useAppStore';
import { getTtsMode, requestSpeechUrl, speakTextOnDevice, stopDeviceSpeech } from '@/services/ttsService';

export default function SavedScreen() {
  const { likedArticles, savedVocab, removeVocabWord, selectedVoiceId } = useAppStore();
  const [showAllLiked, setShowAllLiked] = React.useState(false);
  const [showAllVocab, setShowAllVocab] = React.useState(false);
  const [speakingWordId, setSpeakingWordId] = React.useState<string | null>(null);
  const [isPreparingWordAudio, setIsPreparingWordAudio] = React.useState(false);
  const [audioCache, setAudioCache] = React.useState<Record<string, string>>({});
  const player = useAudioPlayer(null, { downloadFirst: true, updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);

  const handleSpeakWord = React.useCallback(
    async (wordId: string, word: string) => {
      const activeVoiceKey = selectedVoiceId ?? 'default';
      const cacheKey = `${activeVoiceKey}:${wordId}`;

      try {
        if (getTtsMode() === 'elevenlabs-proxy') {
          if (speakingWordId === wordId && (playerStatus.playing || isPreparingWordAudio)) {
            try {
              player.pause();
            } catch {}
            try {
              await player.seekTo(0);
            } catch {}
            setSpeakingWordId(null);
            setIsPreparingWordAudio(false);
            return;
          }

          setSpeakingWordId(wordId);

          const cachedUrl = audioCache[cacheKey];
          if (cachedUrl) {
            setIsPreparingWordAudio(true);
            player.replace(cachedUrl);
            return;
          }

          setIsPreparingWordAudio(true);
          const nextAudioUrl = await requestSpeechUrl(word, selectedVoiceId);
          setAudioCache((current) => ({ ...current, [cacheKey]: nextAudioUrl }));
          player.replace(nextAudioUrl);
          return;
        }

        if (speakingWordId === wordId) {
          await stopDeviceSpeech();
          setSpeakingWordId(null);
          return;
        }

        await speakTextOnDevice(word, {
          onStart: () => setSpeakingWordId(wordId),
          onDone: () => setSpeakingWordId((current) => (current === wordId ? null : current)),
          onError: () => setSpeakingWordId((current) => (current === wordId ? null : current)),
        });
      } catch {
        setSpeakingWordId((current) => (current === wordId ? null : current));
        setIsPreparingWordAudio(false);
      }
    },
    [audioCache, isPreparingWordAudio, player, playerStatus.playing, selectedVoiceId, speakingWordId],
  );

  React.useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });
  }, []);

  React.useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;

    if (isPreparingWordAudio && playerStatus.isLoaded && !playerStatus.isBuffering) {
      player.volume = 1.0;
      player.play();
      setIsPreparingWordAudio(false);
    }
  }, [isPreparingWordAudio, player, playerStatus.isBuffering, playerStatus.isLoaded]);

  React.useEffect(() => {
    if (getTtsMode() !== 'elevenlabs-proxy') return;

    if (!playerStatus.playing && playerStatus.didJustFinish) {
      setSpeakingWordId(null);
      try {
        void player.seekTo(0);
      } catch {}
    }
  }, [player, playerStatus.didJustFinish, playerStatus.playing]);

  React.useEffect(() => {
    setSpeakingWordId(null);
    setIsPreparingWordAudio(false);
  }, [selectedVoiceId]);

  React.useEffect(() => {
    return () => {
      void stopDeviceSpeech();
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  const previewArticles = likedArticles.length
    ? likedArticles
    : [
        {
          id: 'preview-1',
          title: 'Smartphones May Soon Last a Week Per Charge',
          imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400',
          topic: 'Technology', topicId: 'technology', topicColor: '#3B82F6',
          difficulty: 'Beginner' as const,
          readTime: 5, publishedAt: '1 hour ago',
          content: '', source: 'The Guardian',
        },
        {
          id: 'preview-2',
          title: 'Tech Giants Invest in Renewable Energy',
          imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400',
          topic: 'Technology', topicId: 'technology', topicColor: '#3B82F6',
          difficulty: 'Intermediate' as const,
          readTime: 2, publishedAt: '1 day ago',
          content: '', source: 'BBC News',
        },
      ];
  const visibleArticles = showAllLiked ? previewArticles : previewArticles.slice(0, 6);
  const visibleVocab = showAllVocab ? savedVocab : savedVocab.slice(0, 6);
  const hasExtraLikedArticles = previewArticles.length > 6;
  const hasExtraVocab = savedVocab.length > 6;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
        <TouchableOpacity style={styles.avatarButton}>
          <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Liked Articles */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="heart" size={14} color={Colors.text} />
              <Text style={styles.sectionTitle}>Liked articles</Text>
            </View>
            {hasExtraLikedArticles ? (
              <TouchableOpacity onPress={() => setShowAllLiked((current) => !current)}>
                <Text style={styles.seeAll}>{showAllLiked ? 'Show less' : 'See all →'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            horizontal
            data={visibleArticles}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.articleCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/article/[id]',
                    params: { id: item.id },
                  })
                }
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.articleImage}
                  resizeMode="cover"
                />
                <View style={styles.articleBody}>
                  <View style={[styles.topicBadge, { backgroundColor: item.topicColor }]}>
                    <Text style={styles.topicBadgeText}>{item.topic}</Text>
                  </View>
                  <Text style={styles.articleTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.articleMeta}>{item.readTime} min read</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Vocabulary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="book-outline" size={14} color={Colors.text} />
              <Text style={styles.sectionTitle}>My Vocabulary</Text>
            </View>
            {hasExtraVocab ? (
              <TouchableOpacity onPress={() => setShowAllVocab((current) => !current)}>
                <Text style={styles.seeAll}>{showAllVocab ? 'Show less' : 'See all →'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {savedVocab.length === 0 ? (
            <View style={styles.emptyVocab}>
              <Ionicons name="library-outline" size={32} color={Colors.textSecondary} />
              <Text style={styles.emptyVocabText}>
                Tap any word while reading to save it here.
              </Text>
            </View>
          ) : (
            <View style={styles.vocabList}>
              {visibleVocab.map((word) => (
                <View key={word.id} style={styles.vocabCard}>
                  <View style={styles.vocabCardContent}>
                    <View style={styles.vocabWordRow}>
                      <Text style={styles.vocabWord}>{word.word}</Text>
                      <TouchableOpacity
                        onPress={() => handleSpeakWord(word.id, word.word)}
                        style={[
                          styles.pronounceButton,
                          speakingWordId === word.id && styles.pronounceButtonActive,
                        ]}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={speakingWordId === word.id ? 'stop-circle' : 'volume-high'}
                          size={15}
                          color={speakingWordId === word.id ? '#FFFFFF' : Colors.accent}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.vocabDefinition}>{word.definition}</Text>
                    <Text style={styles.vocabContext} numberOfLines={1}>
                      "{word.context}"
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeVocabWord(word.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  avatarButton: {
    position: 'absolute',
    right: 14,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  seeAll: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  articleCard: {
    width: 155,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  articleImage: {
    width: '100%',
    height: 95,
    backgroundColor: '#E5E7EB',
  },
  articleBody: {
    padding: 9,
    gap: 4,
  },
  topicBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  topicBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  articleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 16,
  },
  articleMeta: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  emptyVocab: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyVocabText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  vocabList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  vocabCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  vocabCardContent: {
    flex: 1,
    gap: 3,
  },
  vocabWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vocabWord: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  pronounceButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },
  pronounceButtonActive: {
    backgroundColor: Colors.accent,
  },
  vocabDefinition: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  vocabContext: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  removeButton: {
    padding: 2,
  },
});
