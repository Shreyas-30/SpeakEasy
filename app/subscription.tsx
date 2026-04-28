import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { SubscriptionPlanCard } from '@/components/SubscriptionPlanCard';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlanId,
  getPlanById,
} from '@/constants/subscription';
import {
  consumePendingSubscriptionIntent,
  logSubscriptionEvent,
  savePendingSubscriptionIntent,
} from '@/services/subscriptionService';

const CONFETTI_COLORS = ['#5C5A35', '#B8B59A', '#E7D9A8', '#7E9F6E', '#D7A86E'];

function ConfettiBurst() {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1050,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {Array.from({ length: 22 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 22;
        const radius = 80 + (index % 5) * 18;
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(angle) * radius],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(angle) * radius + 42],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: [1, 1, 0],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${120 + index * 24}deg`],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.confettiPiece,
              {
                backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function normalizePlanId(planId?: string | string[]): SubscriptionPlanId | null {
  const value = Array.isArray(planId) ? planId[0] : planId;
  return value === 'plus' || value === 'pro' || value === 'free' ? value : null;
}

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{
    intent?: string;
    planId?: string;
  }>();
  const {
    subscriptionEntitlement,
    isRefreshingEntitlement,
    requestPlanUpgrade,
    restoreSubscription,
  } = useAppStore();
  const user = useAuthStore((state) => state.user);
  const currentPlan = getPlanById(subscriptionEntitlement.planId);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successPlanId, setSuccessPlanId] = React.useState<SubscriptionPlanId | null>(null);
  const handledIntentRef = React.useRef<string | null>(null);

  const routeToAuth = React.useCallback(
    async (intent: 'upgrade' | 'restore', planId?: SubscriptionPlanId) => {
      await savePendingSubscriptionIntent({ intent, planId });
      router.push({
        pathname: '/auth',
        params: {
          returnTo: 'subscription',
          intent,
          planId,
        },
      });
    },
    [],
  );

  const completeRestore = React.useCallback(async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const entitlement = await restoreSubscription();
      const restoredPlan = getPlanById(entitlement?.planId ?? 'free');
      setStatusMessage(
        entitlement?.planId && entitlement.planId !== 'free'
          ? `${restoredPlan.name} access restored.`
          : 'No paid plan was found for this account yet.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to restore purchases right now.',
      );
    }
  }, [restoreSubscription]);

  const handleRestore = React.useCallback(async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    void logSubscriptionEvent('restore_tap', subscriptionEntitlement.planId, {
      authenticated: Boolean(user),
    });

    if (!user) {
      await routeToAuth('restore');
      return;
    }

    await completeRestore();
  }, [completeRestore, routeToAuth, subscriptionEntitlement.planId, user]);

  const completeUpgrade = React.useCallback(
    async (planId: SubscriptionPlanId) => {
      setStatusMessage(null);
      setErrorMessage(null);

      if (planId === 'free' || planId === subscriptionEntitlement.planId) return;

      try {
        const entitlement = await requestPlanUpgrade(planId);
        if (entitlement?.planId === planId) {
          setSuccessPlanId(planId);
          return;
        }

        setStatusMessage('Paid plans are coming soon. We will let you know when billing is live.');
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to update your plan right now.',
        );
      }
    },
    [requestPlanUpgrade, subscriptionEntitlement.planId],
  );

  const handleSelectPlan = React.useCallback(
    async (planId: SubscriptionPlanId) => {
      setStatusMessage(null);
      setErrorMessage(null);

      if (planId === 'free' || planId === subscriptionEntitlement.planId) return;

      void logSubscriptionEvent('plan_cta_tap', planId, {
        authenticated: Boolean(user),
        currentPlanId: subscriptionEntitlement.planId,
      });

      if (!user) {
        await routeToAuth('upgrade', planId);
        return;
      }

      await completeUpgrade(planId);
    },
    [completeUpgrade, routeToAuth, subscriptionEntitlement.planId, user],
  );

  React.useEffect(() => {
    const planId = normalizePlanId(params.planId);
    const intent = params.intent;
    const intentKey = `${intent ?? ''}:${planId ?? ''}:${user?.id ?? ''}`;

    if (!user || handledIntentRef.current === intentKey) return;
    handledIntentRef.current = intentKey;
    void consumePendingSubscriptionIntent();

    if (intent === 'upgrade' && planId && planId !== 'free') {
      void completeUpgrade(planId);
    }

    if (intent === 'restore') {
      void completeRestore();
    }
  }, [completeRestore, completeUpgrade, params.intent, params.planId, user]);

  if (successPlanId) {
    const successPlan = getPlanById(successPlanId);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.successScreen}>
          <ConfettiBurst />
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Thank you</Text>
          <Text style={styles.successText}>
            Paid plans are coming soon. You now have preview access to {successPlan.name} while
            we finish subscriptions.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setSuccessPlanId(null)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>View my plan</Text>
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
            <View style={styles.currentPriceWrap}>
              <Text style={styles.currentPrice}>{currentPlan.price}</Text>
              {currentPlan.billingLabel ? (
                <Text style={styles.currentBilling}>{currentPlan.billingLabel}</Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.currentDescription}>{currentPlan.description}</Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            {isRefreshingEntitlement ? 'Checking your plan...' : 'Paid plans are coming soon'}
          </Text>
          <Text style={styles.noticeText}>
            For early testers, choosing a paid plan unlocks preview access while billing is not
            live yet. When subscriptions launch, you will be able to manage purchases securely
            through your app store account.
          </Text>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            activeOpacity={0.85}
            disabled={isRefreshingEntitlement}
          >
            {isRefreshingEntitlement ? (
              <ActivityIndicator size="small" color="#66643B" />
            ) : (
              <Text style={styles.restoreButtonText}>
                {user ? 'Restore purchases' : 'Sign in to restore'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}

        <View style={styles.planList}>
          {SUBSCRIPTION_PLANS.map((plan) => (
            <SubscriptionPlanCard
              key={plan.id}
              plan={plan}
              currentPlanId={subscriptionEntitlement.planId}
              isLoading={isRefreshingEntitlement}
              onSelectPlan={handleSelectPlan}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  currentName: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  currentPriceWrap: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  currentBilling: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  currentDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
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
    minHeight: 38,
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  restoreButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#66643B',
  },
  statusMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#66643B',
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.error,
  },
  planList: {
    gap: 12,
  },
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: Colors.background,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#5C5A35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  successText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5C5A35',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confettiLayer: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    width: 1,
    height: 1,
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 14,
    borderRadius: 3,
  },
});
