import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthScreen() {
  const [mode, setMode] = React.useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { error, isLoading, user, signInWithEmail, signUpWithEmail } = useAuthStore();

  const isSignUp = mode === 'sign-up';
  const canSubmit = email.trim().length > 3 && password.length >= 6 && !isLoading;

  React.useEffect(() => {
    if (user) {
      router.replace('/(tabs)/settings');
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (isSignUp) {
      await signUpWithEmail(email.trim(), password);
      return;
    }

    await signInWithEmail(email.trim(), password);
  };

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
});
