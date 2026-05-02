import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { consumePendingSubscriptionIntent } from '@/services/subscriptionService';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthScreen() {
  const params = useLocalSearchParams<{
    returnTo?: string;
    intent?: string;
    planId?: string;
  }>();
  const [mode, setMode] = React.useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = React.useState<string | null>(null);
  const { error, isLoading, user, signInWithEmail, signUpWithEmail } = useAuthStore();
  const hasHandledAuthenticatedRedirect = React.useRef(false);

  const isSignUp = mode === 'sign-up';
  const canSubmit = email.trim().length > 3 && password.length >= 6 && !isLoading;

  React.useEffect(() => {
    if (!user || hasHandledAuthenticatedRedirect.current) return;

    hasHandledAuthenticatedRedirect.current = true;

    const redirectAfterAuth = async () => {
      if (params.returnTo === 'subscription') {
        router.replace({
          pathname: '/subscription',
          params: {
            intent: params.intent,
            planId: params.planId,
          },
        });
        return;
      }

      const pendingIntent = await consumePendingSubscriptionIntent();
      if (pendingIntent) {
        router.replace({
          pathname: '/subscription',
          params: {
            intent: pendingIntent.intent,
            planId: pendingIntent.planId,
          },
        });
        return;
      }

      router.replace('/(tabs)/settings');
    };

    void redirectAfterAuth();
  }, [params.intent, params.planId, params.returnTo, user]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (isSignUp) {
      const submittedEmail = email.trim();
      await signUpWithEmail(submittedEmail, password);
      // No session means Supabase sent a confirmation email — show the check-your-email state
      if (!useAuthStore.getState().user && !useAuthStore.getState().error) {
        setPendingConfirmationEmail(submittedEmail);
      }
      return;
    }

    await signInWithEmail(email.trim(), password);
  };

  if (pendingConfirmationEmail) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setPendingConfirmationEmail(null);
              setMode('sign-in');
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-outline" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.emailHighlight}>{pendingConfirmationEmail}</Text>
          </Text>
          <Text style={styles.confirmInstructions}>
            Open the email and tap the link to verify your account. Once confirmed, come back here to sign in.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setPendingConfirmationEmail(null);
              setMode('sign-in');
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-circle-outline" size={36} color={Colors.accent} />
          </View>

          <Text style={styles.title}>{isSignUp ? 'Create your account' : 'Sign in'}</Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Save your topics, vocabulary, and article history across devices.'
              : 'Restore your SpeakEasy profile and learning progress.'}
          </Text>

          {!isSupabaseConfigured ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Supabase is not configured for this build yet.
              </Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.88}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? 'Create account' : 'Sign in'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeToggle}
            onPress={() => setMode(isSignUp ? 'sign-in' : 'sign-up')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeToggleText}>
              {isSignUp ? 'Already have an account? Sign in' : 'New to SpeakEasy? Create account'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  warningBox: {
    marginTop: 22,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    padding: 12,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9A3412',
  },
  form: {
    marginTop: 30,
    gap: 12,
  },
  input: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.text,
  },
  errorText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.error,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5C5A35',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButtonDisabled: {
    backgroundColor: '#B8B59A',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modeToggle: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  emailHighlight: {
    fontWeight: '700',
    color: Colors.text,
  },
  confirmInstructions: {
    marginTop: 20,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
  },
});
