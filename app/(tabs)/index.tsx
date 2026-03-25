import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAppStore } from '@/store/useAppStore';
import { Article } from '@/types';
import SpeakEasyLogo from '../../assets/images/speakeasy-logo.svg';

function buildExcerpt(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

function getDifficultyBadge(difficulty: Article['difficulty']) {
  switch (difficulty) {
    case 'Beginner':
      return {
        backgroundColor: 'rgba(122, 180, 91, 0.10)',
        color: '#4D8B35',
      };
    case 'Intermediate':
      return {
        backgroundColor: 'rgba(161, 138, 76, 0.10)',
        color: '#A1724C',
      };
    case 'Advanced':
      return {
        backgroundColor: 'rgba(161, 76, 78, 0.10)',
        color: '#A14C4E',
      };
    default:
      return {
        backgroundColor: 'rgba(0,0,0,0.06)',
        color: Colors.textSecondary,
      };
  }
}

function getTopicBadge(topicId: string, topic: string) {
  const map: Record<string, { backgroundColor: string; color: string }> = {
    movies: { backgroundColor: 'rgba(124, 76, 161, 0.10)', color: '#7C4CA1' },
    technology: { backgroundColor: 'rgba(76, 86, 161, 0.10)', color: '#4C4FA1' },
    science: { backgroundColor: 'rgba(83, 161, 76, 0.10)', color: '#3C6F35' },
    business: { backgroundColor: 'rgba(161, 107, 76, 0.10)', color: '#A1794C' },
    finance: { backgroundColor: 'rgba(161, 107, 76, 0.10)', color: '#A1794C' },
    sports: { backgroundColor: 'rgba(161, 138, 76, 0.10)', color: '#8C6A21' },
    food: { backgroundColor: 'rgba(161, 107, 76, 0.10)', color: '#9A6840' },
    travel: { backgroundColor: 'rgba(76, 128, 161, 0.10)', color: '#447B93' },
    music: { backgroundColor: 'rgba(124, 76, 161, 0.10)', color: '#7C4CA1' },
  };

  return (
    map[topicId] ?? {
      backgroundColor: 'rgba(0,0,0,0.05)',
      color: Colors.textSecondary,
    }
  );
}

function FeedCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const topicBadge = getTopicBadge(article.topicId, article.topic);
  const difficultyBadge = getDifficultyBadge(article.difficulty);
  const excerpt = buildExcerpt(article.content);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardCopy}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: topicBadge.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: topicBadge.color }]} numberOfLines={1}>
              {article.topic}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: difficultyBadge.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: difficultyBadge.color }]} numberOfLines={1}>
              {article.difficulty}
            </Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={3}>
          {article.title}
        </Text>

        <Text style={styles.cardExcerpt} numberOfLines={3}>
          {excerpt}
        </Text>
      </View>

      <Image source={{ uri: article.imageUrl }} style={styles.cardImage} resizeMode="cover" />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { articles, isLoading, error, fetchFeed } = useAppStore();

  const navigateToArticle = (article: Article) => {
    router.push({ pathname: '/article/[id]', params: { id: article.id } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <SpeakEasyLogo width={118} height={23} />

        <TouchableOpacity style={styles.profileButton} activeOpacity={0.8}>
          <Ionicons name="person-outline" size={20} color="#7B7B7B" />
        </TouchableOpacity>
      </View>

      {isLoading && articles.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading your feed…</Text>
        </View>
      ) : null}

      {error && !isLoading ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchFeed}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!isLoading || articles.length > 0 ? (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedCard article={item} onPress={() => navigateToArticle(item)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchFeed}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No articles found.</Text>
              </View>
            ) : null
          }
        />
      ) : null}
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
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  profileButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 26,
    gap: 15,
  },
  card: {
    minHeight: 154,
    borderRadius: 10,
    backgroundColor: 'rgba(217,217,217,0.10)',
    paddingVertical: 18,
    paddingLeft: 12,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
    paddingRight: 12,
    justifyContent: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 16,
  },
  badge: {
    maxWidth: 108,
    minHeight: 19,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingTop: 3,
    paddingBottom: 4,
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 10,
  },
  cardExcerpt: {
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(0,0,0,0.5)',
  },
  cardImage: {
    width: 118,
    height: 118,
    borderRadius: 10,
    backgroundColor: '#ECECEC',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.accent,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
});
