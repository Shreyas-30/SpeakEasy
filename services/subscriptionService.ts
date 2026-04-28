import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SUBSCRIPTION_ENTITLEMENT,
  SubscriptionEntitlement,
  SubscriptionPlanId,
  SubscriptionProvider,
  SubscriptionStatus,
} from '@/constants/subscription';
import { supabase } from './supabaseClient';

const TTS_PROXY_URL = process.env.EXPO_PUBLIC_TTS_PROXY_URL ?? '';
const ANONYMOUS_ID_KEY = 'speakeasy-subscription-anonymous-id';
const PENDING_SUBSCRIPTION_INTENT_KEY = 'speakeasy-pending-subscription-intent';

type SubscriptionEventType = 'plan_cta_tap' | 'restore_tap';
export type PendingSubscriptionIntent = {
  intent: 'upgrade' | 'restore';
  planId?: SubscriptionPlanId;
};

function getBackendUrl(pathname: string) {
  if (!TTS_PROXY_URL) {
    throw new Error('Missing EXPO_PUBLIC_TTS_PROXY_URL for backend subscription requests');
  }

  return new URL(pathname, TTS_PROXY_URL).toString();
}

function fromSubscriptionRow(row: any): SubscriptionEntitlement {
  return {
    planId: (row?.plan_id as SubscriptionPlanId | undefined) ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT.planId,
    status: (row?.status as SubscriptionStatus | undefined) ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT.status,
    provider: (row?.provider as SubscriptionProvider | undefined) ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT.provider,
    renewsAt: row?.renews_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function getAnonymousId() {
  const existing = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;

  const nextId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(ANONYMOUS_ID_KEY, nextId);
  return nextId;
}

async function getSessionAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function savePendingSubscriptionIntent(intent: PendingSubscriptionIntent) {
  await AsyncStorage.setItem(PENDING_SUBSCRIPTION_INTENT_KEY, JSON.stringify(intent));
}

export async function consumePendingSubscriptionIntent(): Promise<PendingSubscriptionIntent | null> {
  const raw = await AsyncStorage.getItem(PENDING_SUBSCRIPTION_INTENT_KEY);
  if (!raw) return null;

  await AsyncStorage.removeItem(PENDING_SUBSCRIPTION_INTENT_KEY);

  try {
    return JSON.parse(raw) as PendingSubscriptionIntent;
  } catch {
    return null;
  }
}

export function getEffectiveEntitlement(
  entitlement?: SubscriptionEntitlement | null,
): SubscriptionEntitlement {
  return entitlement ?? DEFAULT_SUBSCRIPTION_ENTITLEMENT;
}

export function hasPaidEntitlement(entitlement?: SubscriptionEntitlement | null) {
  const effectiveEntitlement = getEffectiveEntitlement(entitlement);

  return (
    effectiveEntitlement.planId !== 'free' &&
    (effectiveEntitlement.status === 'active' || effectiveEntitlement.status === 'trialing')
  );
}

export async function requestSubscriptionUpgrade(
  planId: SubscriptionPlanId,
): Promise<SubscriptionEntitlement | null> {
  return requestMockSubscriptionUpgrade(planId);
}

export async function restoreSubscriptionEntitlement(): Promise<SubscriptionEntitlement | null> {
  return refreshSubscriptionEntitlement();
}

export async function logSubscriptionEvent(
  eventType: SubscriptionEventType,
  planId: SubscriptionPlanId | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!supabase) return;

  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;

    await supabase.from('subscription_events').insert({
      user_id: userId,
      anonymous_id: userId ? null : await getAnonymousId(),
      event_type: eventType,
      plan_id: planId,
      source: 'app',
      metadata,
    });
  } catch {
    // Subscription analytics should never block the user flow.
  }
}

export async function refreshSubscriptionEntitlement(): Promise<SubscriptionEntitlement | null> {
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('subscription_entitlements')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? fromSubscriptionRow(data) : DEFAULT_SUBSCRIPTION_ENTITLEMENT;
}

export async function requestMockSubscriptionUpgrade(
  planId: SubscriptionPlanId,
): Promise<SubscriptionEntitlement | null> {
  if (planId === 'free') return DEFAULT_SUBSCRIPTION_ENTITLEMENT;

  const token = await getSessionAccessToken();
  if (!token) return null;

  const response = await fetch(getBackendUrl('/api/subscription/mock-upgrade'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.entitlement) {
    throw new Error(payload.error ?? 'Unable to update subscription');
  }

  return payload.entitlement as SubscriptionEntitlement;
}
