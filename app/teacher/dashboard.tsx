import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { InfoCard } from '@/components/info-card';
import { TeacherGuard } from '@/components/teacher-guard';
import { palette } from '@/constants/app-theme';
import { listTeacherActiveSessions } from '@/lib/sessions';
import { useAuth } from '@/providers/auth-provider';
import { TeacherSession } from '@/types/session';

export default function TeacherDashboardScreen() {
  const { profile, signOutTeacher } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!profile?.id) {
      setSessions([]);
      setIsLoadingSessions(false);
      return;
    }

    try {
      setIsLoadingSessions(true);
      const nextSessions = await listTeacherActiveSessions(profile.id);
      setSessions(nextSessions);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load your sessions right now.';
      Alert.alert('Session load failed', message);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions]),
  );

  const handleLogout = async () => {
    try {
      setIsSigningOut(true);
      await signOutTeacher();
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out right now.';
      Alert.alert('Logout failed', message);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <TeacherGuard>
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Teacher dashboard</Text>
          <Text style={styles.subtitle}>
            Signed in as {profile?.full_name || 'Teacher'}. You can create a new tutoring session
            from here.
          </Text>
        </View>

        <InfoCard
          title="Teacher profile"
          description={`${profile?.email ?? ''}\nRole: ${profile?.role ?? 'teacher'}`}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active sessions</Text>
          {isLoadingSessions ? (
            <InfoCard title="Loading sessions" description="Fetching your active tutoring sessions from Supabase." />
          ) : sessions.length > 0 ? (
            sessions.map((session) => (
              <View
                key={session.id}
                style={styles.sessionCard}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <Text style={styles.sessionMeta}>Join code: {session.join_code}</Text>
                <Text style={styles.sessionMeta}>Status: {session.status}</Text>
                <Text style={styles.sessionMeta}>
                  Created: {new Date(session.created_at).toLocaleString()}
                </Text>
                <AppButton
                  label="Enter Video Room"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/session/video-room',
                      params: {
                        sessionId: session.id,
                        joinCode: session.join_code,
                        role: 'teacher',
                        sessionTitle: session.title,
                      },
                    })
                  }
                />
              </View>
            ))
          ) : (
            <InfoCard
              title="No active sessions yet"
              description="Create a session to generate a join code for your student."
            />
          )}
        </View>

        <View style={styles.actions}>
          <AppButton label="Create Session" onPress={() => router.push('/teacher/create-session')} />
          <AppButton
            label={isSigningOut ? 'Logging Out...' : 'Logout'}
            variant="secondary"
            onPress={handleLogout}
            disabled={isSigningOut}
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
  actions: {
    gap: 14,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sessionCard: {
    gap: 10,
    borderRadius: 24,
    backgroundColor: palette.surface,
    padding: 18,
    shadowColor: '#182033',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  sessionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sessionMeta: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
