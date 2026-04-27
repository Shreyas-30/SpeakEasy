export type SubscriptionPlanId = 'free' | 'plus' | 'pro';
export type SubscriptionStatus = 'free' | 'active' | 'trialing' | 'past_due' | 'expired';
export type SubscriptionProvider = 'mock' | 'revenuecat' | 'stripe' | 'app_store' | 'play_store';
export type SoftPromptTrigger = 'articlesRead' | 'speakingSessions' | 'wordsLearned';
export type HardPaywallReason = 'article-limit' | 'saved-word-limit' | 'speaking-limit';

export type SubscriptionEntitlement = {
  planId: SubscriptionPlanId;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  renewsAt: string | null;
  updatedAt: string | null;
};

export const DEFAULT_SUBSCRIPTION_ENTITLEMENT: SubscriptionEntitlement = {
  planId: 'free',
  status: 'free',
  provider: 'mock',
  renewsAt: null,
  updatedAt: null,
};

export const SUBSCRIPTION_LIMITS = {
  free: {
    articlesPerDay: 10,
    savedWords: 20,
    speakingSessionsPerDay: 5,
    softPromptAfterArticlesRead: 5,
    softPromptAfterSpeakingSessions: 2,
    softPromptAfterWordsLearned: 15,
  },
};

export const SUBSCRIPTION_PLANS: {
  id: SubscriptionPlanId;
  name: string;
  price: string;
  billingLabel: string;
  description: string;
  ctaLabel: string;
  recommended?: boolean;
  features: string[];
}[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    billingLabel: '',
    description: 'Start learning with real articles.',
    ctaLabel: 'Current plan',
    features: [
      '10 articles per day',
      'Save up to 20 words',
      '5 speaking practice sessions per day',
      'Basic vocabulary support',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$6.99',
    billingLabel: 'per month',
    description: 'Learn without daily limits.',
    ctaLabel: 'Upgrade to Plus',
    recommended: true,
    features: [
      'Unlimited articles',
      'Unlimited word saves',
      'More speaking practice',
      'Deeper word insights',
      'Ad-free experience',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12.99',
    billingLabel: 'per month',
    description: 'Practice speaking with more personalized support.',
    ctaLabel: 'Go Pro',
    features: [
      'Everything in Plus',
      'Unlimited AI speaking coach',
      'Personalized learning based on interests',
      'Pronunciation feedback',
      'Real-life conversation practice',
    ],
  },
];

export const HARD_PAYWALL_COPY: Record<
  HardPaywallReason,
  { headline: string; subtext: string; primaryCta: string; secondaryCta: string }
> = {
  'article-limit': {
    headline: 'You’ve reached today’s article limit',
    subtext: 'You’re making great progress. Upgrade to keep going without limits.',
    primaryCta: 'Upgrade to Plus',
    secondaryCta: 'Continue later',
  },
  'saved-word-limit': {
    headline: 'You’ve reached your saved word limit',
    subtext: 'You’re making great progress. Upgrade to keep going without limits.',
    primaryCta: 'Upgrade to Plus',
    secondaryCta: 'Continue later',
  },
  'speaking-limit': {
    headline: 'You’ve used today’s speaking practice',
    subtext: 'You’re making great progress. Upgrade to keep going without limits.',
    primaryCta: 'Upgrade to Plus',
    secondaryCta: 'Continue later',
  },
};

export const SOFT_UPGRADE_PROMPTS: Record<
  SoftPromptTrigger,
  { headline: string; body: string; primaryCta: string; secondaryCta: string }
> = {
  articlesRead: {
    headline: 'Nice work — you’ve read 5 articles today',
    body: 'Upgrade to read without limits and build your daily habit.',
    primaryCta: 'See plans',
    secondaryCta: 'Not now',
  },
  speakingSessions: {
    headline: 'You’re getting more confident speaking',
    body: 'Unlock more practice and improve faster with Pro.',
    primaryCta: 'See plans',
    secondaryCta: 'Not now',
  },
  wordsLearned: {
    headline: 'You learned 15 new words today',
    body: 'Save and practice unlimited words with Plus.',
    primaryCta: 'See plans',
    secondaryCta: 'Not now',
  },
};

export function getPlanById(planId: SubscriptionPlanId) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) ?? SUBSCRIPTION_PLANS[0];
}

export function hasUnlimitedAccess(planId: SubscriptionPlanId) {
  return planId !== 'free';
}
