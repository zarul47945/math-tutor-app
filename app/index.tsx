import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { useAuth } from '@/providers/auth-provider';
import { palette } from '@/constants/app-theme';

export default function LandingScreen() {
  const { profile } = useAuth();
  const isTeacherSignedIn = profile?.role === 'teacher';

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Math Tutor</Text>
        <Text style={styles.title}>Run live lessons with a simple teacher and student flow.</Text>
        <Text style={styles.subtitle}>
          This foundation keeps onboarding clear for both sides while we leave auth, video, and
          whiteboard features for the next phase.
        </Text>
      </View>

      <View style={styles.card}>
        <AppButton
          label={isTeacherSignedIn ? 'Teacher Dashboard' : 'Teacher Login'}
          onPress={() => router.push(isTeacherSignedIn ? '/teacher/dashboard' : '/teacher/auth')}
        />
        <AppButton
          label="Student Join as Guest"
          variant="secondary"
          onPress={() => router.push('/student/join')}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: 28,
  },
  hero: {
    gap: 16,
    paddingTop: 28,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: palette.primarySoft,
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 25,
  },
  card: {
    gap: 14,
    borderRadius: 28,
    backgroundColor: palette.surface,
    padding: 20,
    shadowColor: '#182033',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
});
