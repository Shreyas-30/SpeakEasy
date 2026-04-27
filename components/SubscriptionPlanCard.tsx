import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  SubscriptionPlanId,
  SUBSCRIPTION_PLANS,
} from '@/src/config/subscriptionPlans';

type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  currentPlanId: SubscriptionPlanId;
  onSelectPlan: (planId: SubscriptionPlanId) => void;
}

export function SubscriptionPlanCard({
  plan,
  currentPlanId,
  onSelectPlan,
}: SubscriptionPlanCardProps) {
  const isCurrent = plan.id === currentPlanId;
  const ctaLabel = plan.id === 'free' ? 'Included' : plan.ctaLabel;

  return (
    <TouchableOpacity
      style={[styles.card, plan.recommended && styles.recommendedCard]}
      onPress={() => onSelectPlan(plan.id)}
      activeOpacity={0.86}
    >
      <View style={styles.headerRow}>
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.planName}>{plan.name}</Text>
            {plan.recommended ? (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.description}>{plan.description}</Text>
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.price}>{plan.price}</Text>
          {plan.billingLabel ? <Text style={styles.billing}>{plan.billingLabel}</Text> : null}
        </View>
      </View>

      <View style={styles.features}>
        {plan.features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Ionicons name="checkmark-circle-outline" size={15} color="#66643B" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.cta, isCurrent && styles.currentCta]}>
        <Text style={[styles.ctaText, isCurrent && styles.currentCtaText]}>
          {isCurrent ? 'Current plan' : ctaLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 16,
    gap: 14,
  },
  recommendedCard: {
    borderColor: '#B8B59A',
    backgroundColor: '#FFFDF7',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  recommendedBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(102,100,59,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#66643B',
  },
  description: {
    marginTop: 5,
    maxWidth: 190,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  priceWrap: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  billing: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  features: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  cta: {
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C5A35',
  },
  currentCta: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentCtaText: {
    color: Colors.textSecondary,
  },
});
