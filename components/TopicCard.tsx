import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Topic } from '@/types';
import { Colors } from '@/constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 8;
const COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_MARGIN * (COLUMNS - 1)) / COLUMNS;

interface TopicCardProps {
  topic: Topic;
  selected: boolean;
  onPress: () => void;
}

export function TopicCard({ topic, selected, onPress }: TopicCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: topic.imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      {/* Gradient overlay */}
      <View style={styles.overlay} />
      <Text style={styles.name}>{topic.name}</Text>

      {selected && (
        <View style={styles.checkContainer}>
          <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: CARD_MARGIN,
    backgroundColor: '#E5E7EB',
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  name: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
  },
});
