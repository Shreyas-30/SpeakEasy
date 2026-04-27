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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { SubscriptionPlanCard } from '@/components/SubscriptionPlanCard';
import { useAppStore } from '@/store/useAppStore';
import {
  SUBSCRIPTION_PLANS,
  getPlanById,
} from '@/constants/subscription';

export default function SubscriptionScreen() {
  const {
    subscriptionEntitlement,
    isRefreshingEntitlement,
    requestPlanUpgrade,
    restoreSubscription,
  } = useAppStore();
  const currentPlan = getPlanById(subscriptionEntitlement.planId);
  const showPaymentNotice = isRefreshingEntitlement ? 'Checking subscription...' : 'Payments are coming soon';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Current plan</Text>
          <View style={styles.currentRow}>
            <Text style={styles.currentName}>{currentPlan.name}</Text>
            <Text style={styles.currentPrice}>
              {currentPlan.billingLabel
                ? `${currentPlan.price} ${currentPlan.billingLabel}`
                : currentPlan.price}
            </Text>
          </View>
          <Text style={styles.currentDescription}>{currentPlan.description}</Text>
          <Text style={styles.statusText}>
            Status: {subscriptionEntitlement.status.replace('_', ' ')}
          </Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{showPaymentNotice}</Text>
          <Text style={styles.noticeText}>
            This screen is ready for a payment provider, but paid upgrades are not active yet.
            Once RevenueCat, Stripe, or store billing is connected, plan changes will only apply
            after the entitlement is verified.
          </Text>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => {
              void restoreSubscription();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.restoreButtonText}>Restore purchases</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.planList}>
          {SUBSCRIPTION_PLANS.map((plan) => (
            <SubscriptionPlanCard
              key={plan.id}
              plan={plan}
              currentPlanId={subscriptionEntitlement.planId}
              onSelectPlan={(planId) => {
                void requestPlanUpgrade(planId);
              }}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  currentCard: {
    borderRadius: 16,
    backgroundColor: Colors.background,
    padding: 16,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
  },
  currentRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  currentName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  currentPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#66643B',
  },
  currentDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  statusText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#66643B',
    textTransform: 'capitalize',
  },
  noticeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,100,59,0.14)',
    backgroundColor: '#FFFDF7',
    padding: 16,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  noticeText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  restoreButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.background,
  },
  restoreButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#66643B',
  },
  planList: {
    gap: 12,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
