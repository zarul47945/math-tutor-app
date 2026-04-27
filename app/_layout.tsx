import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/providers/auth-provider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#f7f8fc',
          },
          headerTintColor: '#182033',
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: '#f7f8fc',
          },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="teacher/auth" options={{ title: 'Teacher Access' }} />
        <Stack.Screen name="teacher/dashboard" options={{ title: 'Teacher Dashboard' }} />
        <Stack.Screen name="teacher/create-session" options={{ title: 'Create Session' }} />
        <Stack.Screen name="student/join" options={{ title: 'Student Join' }} />
        <Stack.Screen name="session/video-room" options={{ title: 'Video Room' }} />
        <Stack.Screen name="session/module" options={{ title: 'Learning Module' }} />
      </Stack>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
