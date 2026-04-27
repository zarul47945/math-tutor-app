import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AudioSession,
  LiveKitRoom,
  TrackReferenceOrPlaceholder,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/react-native';
import { RoomAudioRenderer } from '@livekit/components-react';
import { Track } from 'livekit-client';

import { AppScreen } from '@/components/app-screen';
import { InfoCard } from '@/components/info-card';
import { LiveKitRoomControls } from '@/components/livekit-room-controls';
import { LiveKitVideoTile } from '@/components/livekit-video-tile';
import { palette } from '@/constants/app-theme';
import { ensureLiveKitGlobals } from '@/lib/livekit';
import { fetchLiveKitToken } from '@/lib/livekit-token';
import { LiveKitParticipantRole, LiveKitTokenResponse } from '@/types/session';

ensureLiveKitGlobals();

type VideoRoomParams = {
  joinCode?: string;
  participantId?: string;
  role?: string;
  sessionId?: string;
  sessionTitle?: string;
  studentName?: string;
};

function normalizeParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

type ParticipantGridProps = {
  participantName?: string;
  role: LiveKitParticipantRole;
  sessionTitle?: string;
};

function ParticipantGrid({ participantName, role, sessionTitle }: ParticipantGridProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  const [isUpdatingTrack, setIsUpdatingTrack] = useState(false);

  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  }) as TrackReferenceOrPlaceholder[];

  const handleToggleMic = async () => {
    try {
      setIsUpdatingTrack(true);
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change microphone state.';
      Alert.alert('Microphone error', message);
    } finally {
      setIsUpdatingTrack(false);
    }
  };

  const handleToggleCamera = async () => {
    try {
      setIsUpdatingTrack(true);
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change camera state.';
      Alert.alert('Camera error', message);
    } finally {
      setIsUpdatingTrack(false);
    }
  };

  const handleLeave = async () => {
    await room.disconnect(true);
    router.replace(role === 'teacher' ? '/teacher/dashboard' : '/student/join');
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Live lesson room</Text>
        <Text style={styles.subtitle}>
          Connected to {sessionTitle || 'your session'} with room status {connectionState}.
        </Text>
      </View>

      <InfoCard
        title="Session details"
        description={`Session title: ${sessionTitle || 'Untitled session'}\nStudent name: ${participantName || 'Waiting for student'}\nJoin code: ${room.name || 'Unavailable'}`}
      />

      <RoomAudioRenderer />

      <ScrollView
        contentContainerStyle={styles.videoGrid}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {cameraTracks.map((trackRef, index) => (
          <View key={`${trackRef.participant.identity}-${index}`} style={styles.tileWrap}>
            <LiveKitVideoTile localIdentity={localParticipant.identity} trackRef={trackRef} />
          </View>
        ))}
      </ScrollView>

      <LiveKitRoomControls
        isCameraEnabled={isCameraEnabled}
        isMicEnabled={isMicrophoneEnabled}
        isWorking={isUpdatingTrack}
        onLeave={handleLeave}
        onToggleCamera={handleToggleCamera}
        onToggleMic={handleToggleMic}
      />
    </AppScreen>
  );
}

export default function VideoRoomScreen() {
  const params = useLocalSearchParams<VideoRoomParams>();
  const joinCode = normalizeParam(params.joinCode);
  const participantId = normalizeParam(params.participantId);
  const role = (normalizeParam(params.role) as LiveKitParticipantRole | undefined) ?? 'student';
  const sessionId = normalizeParam(params.sessionId);
  const sessionTitle = normalizeParam(params.sessionTitle);
  const studentName = normalizeParam(params.studentName);

  const [tokenDetails, setTokenDetails] = useState<LiveKitTokenResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tokenRequest = useMemo(() => {
    if (!sessionId || !joinCode) {
      return null;
    }

    if (role === 'teacher') {
      return {
        role: 'teacher' as const,
        sessionId,
        joinCode,
      };
    }

    if (!participantId) {
      return null;
    }

    return {
      role: 'student' as const,
      sessionId,
      joinCode,
      participantId,
    };
  }, [joinCode, participantId, role, sessionId]);

  useEffect(() => {
    const startAudio = async () => {
      await AudioSession.startAudioSession();
    };

    startAudio().catch((error) => {
      console.error('Failed to start LiveKit audio session.', error);
    });

    return () => {
      AudioSession.stopAudioSession().catch((error) => {
        console.error('Failed to stop LiveKit audio session.', error);
      });
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadToken = async () => {
      if (!tokenRequest) {
        setErrorMessage('Missing room details. Please rejoin the session.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const nextToken = await fetchLiveKitToken(tokenRequest);

        if (!isMounted) {
          return;
        }

        setTokenDetails(nextToken);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to join the LiveKit room right now.';
        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadToken();

    return () => {
      isMounted = false;
    };
  }, [tokenRequest]);

  if (isLoading) {
    return (
      <AppScreen contentContainerStyle={styles.loadingState}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>Joining video room...</Text>
      </AppScreen>
    );
  }

  if (!tokenDetails || errorMessage) {
    return (
      <AppScreen contentContainerStyle={styles.loadingState}>
        <Text style={styles.errorTitle}>Unable to join video room</Text>
        <Text style={styles.errorText}>{errorMessage || 'The LiveKit token could not be created.'}</Text>
      </AppScreen>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={tokenDetails.url}
      token={tokenDetails.token}
      connect
      audio
      video
      onDisconnected={() => {
        router.replace(role === 'teacher' ? '/teacher/dashboard' : '/student/join');
      }}
      onError={(error) => {
        Alert.alert('LiveKit error', error.message);
      }}>
      <ParticipantGrid
        participantName={role === 'student' ? studentName : tokenDetails.participantName}
        role={role}
        sessionTitle={sessionTitle}
      />
    </LiveKitRoom>
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
  videoGrid: {
    gap: 14,
    paddingRight: 20,
  },
  tileWrap: {
    width: 250,
  },
  loadingState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  errorTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
