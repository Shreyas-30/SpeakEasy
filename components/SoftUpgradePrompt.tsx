import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  SOFT_UPGRADE_PROMPTS,
  SoftPromptTrigger,
} from '@/constants/subscription';

interface SoftUpgradePromptProps {
  trigger: SoftPromptTrigger | null;
  onSeePlans: () => void;
  onDismiss: () => void;
}

export function SoftUpgradePrompt({
  trigger,
  onSeePlans,
  onDismiss,
}: SoftUpgradePromptProps) {
  if (!trigger) return null;

  const copy = SOFT_UPGRADE_PROMPTS[trigger];

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <View style={styles.iconWrap}>
          <Ionicons name="trending-up-outline" size={16} color="#66643B" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onSeePlans} activeOpacity={0.86}>
          <Text style={styles.primaryText}>{copy.primaryCta}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>{copy.secondaryCta}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,100,59,0.18)',
    backgroundColor: '#FFFDF7',
    padding: 14,
    gap: 14,
  },
  copy: {
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102,100,59,0.10)',
  },
  textWrap: {
    flex: 1,
  },
  headline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  body: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C5A35',
  },
  primaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
