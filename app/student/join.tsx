import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { FormInput } from '@/components/form-input';
import { palette } from '@/constants/app-theme';
import { joinSessionAsStudent } from '@/lib/sessions';

export default function StudentJoinScreen() {
  const [studentName, setStudentName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const trimmedStudentName = studentName.trim();
    const normalizedSessionCode = sessionCode.trim().toUpperCase();

    if (!trimmedStudentName || !normalizedSessionCode) {
      Alert.alert('Missing details', 'Please enter your name and session code to continue.');
      return;
    }

    try {
      setIsJoining(true);
      const result = await joinSessionAsStudent({
        joinCode: normalizedSessionCode,
        displayName: trimmedStudentName,
      });

      if (!result) {
        Alert.alert('Session not found', 'We could not find an active session with that join code.');
        return;
      }

      router.push({
        pathname: '/session/video-room',
        params: {
          sessionId: result.session.id,
          participantId: result.participant.id,
          joinCode: result.session.join_code,
          role: 'student',
          sessionTitle: result.session.title,
          studentName: result.participant.display_name,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to join the session right now.';
      Alert.alert('Join failed', message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Join as a guest student</Text>
        <Text style={styles.subtitle}>
          Enter the details your teacher shared, then continue into the lesson room.
        </Text>
      </View>

      <View style={styles.formCard}>
        <FormInput
          label="Student name"
          value={studentName}
          onChangeText={setStudentName}
          placeholder="e.g. Aisha"
          autoCapitalize="words"
          returnKeyType="next"
        />

        <FormInput
          label="Session code"
          value={sessionCode}
          onChangeText={(value) => setSessionCode(value.toUpperCase())}
          placeholder="Enter session code"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
        />

        <AppButton label={isJoining ? 'Joining...' : 'Join Session'} onPress={handleJoin} disabled={isJoining} />
      </View>
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
  formCard: {
    gap: 18,
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
