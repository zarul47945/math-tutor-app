import { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { palette } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

export function TeacherGuard({ children }: PropsWithChildren) {
  const { isReady, profile, session } = useAuth();

  if (!isReady) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <Text style={styles.message}>Checking your teacher session...</Text>
      </AppScreen>
    );
  }

  if (!session || profile?.role !== 'teacher') {
    return <Redirect href="/teacher/auth" />;
  }

  return children;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});
