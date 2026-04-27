import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { FormInput } from '@/components/form-input';
import { palette } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'login' | 'signup';

export default function TeacherAuthScreen() {
  const { isReady, profile, signInTeacher, signUpTeacher } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isReady && profile?.role === 'teacher') {
    return <Redirect href="/teacher/dashboard" />;
  }

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedFullName = fullName.trim();

    if (mode === 'signup' && !trimmedFullName) {
      Alert.alert('Missing full name', 'Please enter your full name to create a teacher account.');
      return;
    }

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === 'login') {
        await signInTeacher({
          email: trimmedEmail,
          password: trimmedPassword,
        });
      } else {
        const result = await signUpTeacher({
          fullName: trimmedFullName,
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (result.requiresEmailVerification) {
          Alert.alert(
            'Check your inbox',
            'Your account was created. Verify your email, then log in to continue.',
          );
          setMode('login');
          return;
        }
      }

      router.replace('/teacher/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      Alert.alert(mode === 'login' ? 'Login failed' : 'Signup failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{mode === 'login' ? 'Teacher login' : 'Teacher signup'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to reach your teacher dashboard.'
            : 'Create your teacher account. Student accounts are not part of this app yet.'}
        </Text>
      </View>

      <View style={styles.formCard}>
        {mode === 'signup' ? (
          <FormInput
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Maria Santos"
            autoCapitalize="words"
            returnKeyType="next"
          />
        ) : null}
        <FormInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="teacher@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <AppButton
          label={
            isSubmitting
              ? mode === 'login'
                ? 'Logging In...'
                : 'Creating Account...'
              : mode === 'login'
                ? 'Login'
                : 'Create Account'
          }
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
        <AppButton
          label={mode === 'login' ? 'Switch to Signup' : 'Switch to Login'}
          variant="secondary"
          onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          disabled={isSubmitting}
        />
      </View>

      <Pressable disabled={isSubmitting} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.helperText}>
          {mode === 'login'
            ? 'Need a teacher account? Switch to signup.'
            : 'Already have a teacher account? Switch to login.'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingVertical: 20,
  },
  header: {
    gap: 10,
  },
  formCard: {
    gap: 16,
    borderRadius: 28,
    backgroundColor: palette.surface,
    padding: 20,
    shadowColor: '#182033',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
