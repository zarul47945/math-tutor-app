import { StyleSheet, Text, View } from 'react-native';

import { TrackReferenceOrPlaceholder, VideoTrack, isTrackReference } from '@livekit/react-native';

import { palette } from '@/constants/app-theme';

type LiveKitVideoTileProps = {
  localIdentity?: string;
  trackRef: TrackReferenceOrPlaceholder;
};

export function LiveKitVideoTile({ localIdentity, trackRef }: LiveKitVideoTileProps) {
  if (!isTrackReference(trackRef)) {
    return (
      <View style={[styles.card, styles.placeholder]}>
        <Text style={styles.placeholderText}>Waiting for camera...</Text>
      </View>
    );
  }

  const participantName = trackRef.participant.name || trackRef.participant.identity;
  const isLocalTrack = trackRef.participant.identity === localIdentity;

  return (
    <View style={styles.card}>
      <VideoTrack
        trackRef={trackRef}
        style={styles.video}
        mirror={isLocalTrack}
        objectFit="cover"
        zOrder={isLocalTrack ? 1 : 0}
      />
      <View style={styles.caption}>
        <Text style={styles.captionText}>
          {participantName}
          {isLocalTrack ? ' (You)' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#0f172a',
  },
  video: {
    width: '100%',
    aspectRatio: 0.78,
    backgroundColor: '#0f172a',
  },
  caption: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  captionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
  },
  placeholderText: {
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});
