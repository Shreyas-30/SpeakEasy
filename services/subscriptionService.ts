import {
  DEFAULT_SUBSCRIPTION_ENTITLEMENT,
  SubscriptionEntitlement,
  SubscriptionPlanId,
  hasUnlimitedAccess,
} from '@/src/config/subscriptionPlans';

export function getEffectiveEntitlement(
  entitlement?: SubscriptionEntitlement | null,
): SubscriptionEntitlement {
  return entitlement ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT;
}

export function hasPaidEntitlement(entitlement?: SubscriptionEntitlement | null) {
  const effectiveEntitlement = getEffectiveEntitlement(entitlement);

  return (
    hasUnlimitedAccess(effectiveEntitlement.planId) &&
    (effectiveEntitlement.status === 'active' || effectiveEntitlement.status === 'trialing')
  );
}

export async function requestSubscriptionUpgrade(
  planId: SubscriptionPlanId,
): Promise<SubscriptionEntitlement | null> {
  // Future integration point:
  // - RevenueCat: present paywall/package purchase, then return verified entitlement.
  // - Stripe: open Checkout/customer portal, then refresh entitlement from backend/Supabase.
  // - StoreKit/Play Billing direct: validate receipt server-side before returning entitlement.
  void planId;
  return null;
}

export async function restoreSubscriptionEntitlement(): Promise<SubscriptionEntitlement | null> {
  // Future integration point for RevenueCat restore purchases or backend entitlement refresh.
  return null;
}
