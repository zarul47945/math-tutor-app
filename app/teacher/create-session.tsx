import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { FormInput } from '@/components/form-input';
import { TeacherGuard } from '@/components/teacher-guard';
import { palette } from '@/constants/app-theme';
import { createTeacherSession } from '@/lib/sessions';
import { useAuth } from '@/providers/auth-provider';
import { TeacherSession } from '@/types/session';

export default function CreateSessionScreen() {
  const { profile } = useAuth();
  const [sessionName, setSessionName] = useState('');
  const [createdSession, setCreatedSession] = useState<TeacherSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateSession = async () => {
    const trimmedSessionName = sessionName.trim();

    if (!profile?.id) {
      Alert.alert('Missing teacher account', 'Please sign in again before creating a session.');
      return;
    }

    if (!trimmedSessionName) {
      Alert.alert('Missing session name', 'Please enter a session name.');
      return;
    }

    try {
      setIsSaving(true);
      const nextSession = await createTeacherSession({
        teacherId: profile.id,
        title: trimmedSessionName,
      });

      setCreatedSession(nextSession);
      setSessionName(nextSession.title);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create a session right now.';
      Alert.alert('Session creation failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TeacherGuard>
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
        <Text style={styles.title}>Create session</Text>
        <Text style={styles.subtitle}>
            Create a real session in Supabase and share the generated join code with your student.
        </Text>
      </View>

        <View style={styles.formCard}>
          <FormInput
            label="Session name"
            value={sessionName}
            onChangeText={setSessionName}
            placeholder="e.g. Algebra Revision"
            autoCapitalize="sentences"
          />

          <AppButton
            label={isSaving ? 'Creating Session...' : 'Create Session'}
            onPress={handleCreateSession}
            disabled={isSaving}
          />

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Session code</Text>
            <Text style={styles.codeValue}>{createdSession?.join_code || 'MATH-----'}</Text>
            <Text style={styles.codeHint}>
              {createdSession
                ? 'This code is saved and ready for a guest student to use.'
                : 'The code will appear here after the session is created.'}
            </Text>
          </View>

          {createdSession ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Session created</Text>
              <Text style={styles.resultText}>{createdSession.title}</Text>
              <Text style={styles.resultText}>Status: {createdSession.status}</Text>
            </View>
          ) : null}

          <AppButton
            label="Open Video Room Placeholder"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/session/video-room',
                params: {
                  sessionId: createdSession?.id ?? '',
                  joinCode: createdSession?.join_code ?? '',
                  role: 'teacher',
                  sessionTitle: createdSession?.title ?? sessionName.trim(),
                },
              })
            }
            disabled={!createdSession}
          />
        </View>
      </AppScreen>
    </TeacherGuard>
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
  codeCard: {
    gap: 8,
    borderRadius: 20,
    backgroundColor: palette.surfaceMuted,
    padding: 18,
  },
  codeLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  codeValue: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 2,
  },
  codeHint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  resultCard: {
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  resultTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  resultText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
