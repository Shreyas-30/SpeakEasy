import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Article } from '@/types';
import { Colors } from '@/constants/colors';

interface ArticleCardProps {
  article: Article;
  onPress: () => void;
  size?: 'normal' | 'small';
}

export function ArticleCard({ article, onPress, size = 'normal' }: ArticleCardProps) {
  const isSmall = size === 'small';

  const difficultyStyle = {
    Beginner:     { bg: Colors.beginner.bg,     text: Colors.beginner.text },
    Intermediate: { bg: Colors.intermediate.bg, text: Colors.intermediate.text },
    Advanced:     { bg: Colors.advanced.bg,     text: Colors.advanced.text },
  }[article.difficulty];

  return (
    <TouchableOpacity
      style={[styles.card, isSmall && styles.cardSmall]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.imageContainer, isSmall && styles.imageContainerSmall]}>
        <Image
          source={{ uri: article.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      <View style={styles.body}>
        {/* Topic + difficulty badges */}
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: article.topicColor }]}>
            <Text style={styles.badgeText}>{article.topic}</Text>
          </View>
          {!isSmall && (
            <View style={[styles.badge, { backgroundColor: difficultyStyle.bg }]}>
              <Text style={[styles.badgeText, { color: difficultyStyle.text }]}>
                {article.difficulty}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text
          style={[styles.title, isSmall && styles.titleSmall]}
          numberOfLines={isSmall ? 2 : 3}
        >
          {article.title}
        </Text>

        {/* Read time + date */}
        <Text style={styles.meta}>
          {article.readTime} min read · {article.publishedAt}
        </Text>

        {/* Source attribution */}
        <View style={styles.sourceRow}>
          <Ionicons name="newspaper-outline" size={10} color={Colors.textMuted} />
          <Text style={styles.sourceText} numberOfLines={1}>
            {article.source}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSmall: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#E5E7EB',
  },
  imageContainerSmall: {
    height: 100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 10,
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  titleSmall: {
    fontSize: 12,
    lineHeight: 16,
  },
  meta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  sourceText: {
    fontSize: 10,
    color: Colors.textMuted,
    flex: 1,
  },
});
