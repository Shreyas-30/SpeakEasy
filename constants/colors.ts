export const Colors = {
  // Core
  background: '#FFFFFF',
  surface: '#F7F8FA',
  surfaceElevated: '#FFFFFF',

  // Text
  text: '#0A0A0A',
  textSecondary: '#6B7280',
  textMuted: 'rgba(0,0,0,0.3)',

  // Brand
  primary: '#1A1A2E',
  primaryLight: '#2D2D4E',
  accent: '#3B82F6',

  // Borders & Dividers
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.15)',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  // Difficulty badges
  beginner: {
    bg: '#D1FAE5',
    text: '#065F46',
  },
  intermediate: {
    bg: '#FEF3C7',
    text: '#92400E',
  },
  advanced: {
    bg: '#FEE2E2',
    text: '#991B1B',
  },

  // Topic colors
  topics: {
    technology: '#3B82F6',
    sports: '#10B981',
    food: '#F59E0B',
    travel: '#8B5CF6',
    music: '#EC4899',
    science: '#06B6D4',
    health: '#EF4444',
    business: '#6366F1',
    arts: '#F97316',
    gaming: '#84CC16',
    fashion: '#D946EF',
    politics: '#64748B',
    anime: '#A855F7',
    gardening: '#22C55E',
    nature: '#14B8A6',
    default: '#6B7280',
  },

  // Tab bar
  tabBar: {
    background: '#FFFFFF',
    border: 'rgba(0,0,0,0.08)',
    active: '#0A0A0A',
    inactive: '#9CA3AF',
  },

  // Shadows
  shadowColor: '#000000',
};

export type TopicColorKey = keyof typeof Colors.topics;
