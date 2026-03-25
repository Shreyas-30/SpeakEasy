import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAppStore } from '@/store/useAppStore';

const TRY_SAYING_PROMPTS = ['“I thought it was...”', '“The part I liked...”'];

function buildPrompt(articleTitle: string, source: string) {
  return `What did you think of this article? Do you agree?`;
}

export default function DiscussScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles, savedArticles, selectedVoiceName } = useAppStore();

  const article = [...articles, ...savedArticles].find((item) => item.id === id);
  const tutorName = selectedVoiceName ?? 'Sophia';

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Discussion unavailable</Text>
          <Text style={styles.emptyText}>
            Open the article again from your feed to start an English practice session.
          </Text>
          <TouchableOpacity style={styles.backToArticleButton} onPress={() => router.back()}>
            <Text style={styles.backToArticleText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#7A7663" />
        </TouchableOpacity>

        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>• Live</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.articleCard}>
          <View style={styles.articleCardIcon}>
            <Ionicons name="document-text-outline" size={17} color="#7A7663" />
          </View>
          <View style={styles.articleCardBody}>
            <Text style={styles.articleCardTitle} numberOfLines={1}>
              {article.title}
            </Text>
            <Text style={styles.articleCardMeta}>{article.source}</Text>
          </View>
        </View>

        <View style={styles.promptCard}>
          <View style={styles.promptHeader}>
            <View style={styles.promptIdentity}>
              <View style={styles.promptAvatar}>
                <Ionicons name="happy-outline" size={18} color="#6A6840" />
              </View>
              <Text style={styles.promptSpeaker}>{tutorName}</Text>
            </View>

            <View style={styles.audioGlyph}>
              {Array.from({ length: 6 }).map((_, index) => (
                <View
                  key={`wave-${index}`}
                  style={[
                    styles.audioBar,
                    index % 3 === 0
                      ? styles.audioBarTall
                      : index % 2 === 0
                        ? styles.audioBarMedium
                        : styles.audioBarShort,
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={styles.promptTitle}>{buildPrompt(article.title, article.source)}</Text>
          <Text style={styles.promptSubtitle}>Take your time -- speak naturally</Text>
        </View>

        <View style={styles.trySayingSection}>
          <Text style={styles.trySayingTitle}>TRY SAYING</Text>
          <View style={styles.promptChips}>
            {TRY_SAYING_PROMPTS.map((prompt) => (
              <TouchableOpacity key={prompt} style={styles.promptChip} activeOpacity={0.85}>
                <Text style={styles.promptChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.micDock}>
        <TouchableOpacity style={styles.primaryMicButton} activeOpacity={0.9}>
          <View style={styles.primaryMicInner}>
            <Ionicons name="mic" size={34} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F1',
  },
  header: {
    height: 85,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(161,76,76,0.07)',
  },
  liveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A14C4C',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
  },
  articleCard: {
    height: 55,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(161,114,76,0.24)',
    backgroundColor: 'rgba(161,114,76,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  articleCardIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleCardBody: {
    marginLeft: 14,
    flex: 1,
  },
  articleCardTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3A3A3A',
  },
  articleCardMeta: {
    marginTop: 2,
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
  },
  promptCard: {
    marginTop: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promptAvatar: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DAD6C7',
    backgroundColor: '#FFFDF8',
  },
  promptSpeaker: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A3A3A',
  },
  audioGlyph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  audioBar: {
    width: 3,
    borderRadius: 999,
    backgroundColor: '#7A7663',
  },
  audioBarShort: {
    height: 10,
  },
  audioBarMedium: {
    height: 14,
  },
  audioBarTall: {
    height: 18,
  },
  promptTitle: {
    marginTop: 28,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '500',
    color: '#000000',
  },
  promptSubtitle: {
    marginTop: 28,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(58,58,58,0.5)',
  },
  trySayingSection: {
    marginTop: 78,
  },
  trySayingTitle: {
    fontSize: 12,
    color: 'rgba(58,58,58,0.5)',
  },
  promptChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  promptChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(161,138,76,0.07)',
  },
  promptChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7C7C7C',
  },
  micDock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 38,
  },
  primaryMicButton: {
    width: 125,
    height: 125,
    borderRadius: 62.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D0CDC0',
  },
  primaryMicInner: {
    width: 87,
    height: 87,
    borderRadius: 43.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#66643B',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
    backgroundColor: '#F8F7F1',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  backToArticleButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#66643B',
  },
  backToArticleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
