import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  HARD_PAYWALL_COPY,
  HardPaywallReason,
} from '@/src/config/subscriptionPlans';

interface HardPaywallProps {
  visible: boolean;
  reason: HardPaywallReason | null;
  onUpgrade: () => void;
  onClose: () => void;
}

export function HardPaywall({ visible, reason, onUpgrade, onClose }: HardPaywallProps) {
  const copy = reason ? HARD_PAYWALL_COPY[reason] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={24} color="#66643B" />
          </View>

          <Text style={styles.headline}>{copy?.headline}</Text>
          <Text style={styles.subtext}>{copy?.subtext}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={onUpgrade} activeOpacity={0.88}>
            <Text style={styles.primaryText}>{copy?.primaryCta}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.secondaryText}>{copy?.secondaryCta}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.background,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 28,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102,100,59,0.10)',
    marginBottom: 18,
  },
  headline: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    color: Colors.text,
  },
  subtext: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  primaryButton: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    backgroundColor: '#5C5A35',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
