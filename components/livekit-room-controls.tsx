import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/app-theme';

type LiveKitRoomControlsProps = {
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isWorking: boolean;
  onLeave: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
};

type ControlButtonProps = {
  label: string;
  muted?: boolean;
  onPress: () => void;
};

function ControlButton({ label, muted = false, onPress }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        muted ? styles.controlButtonMuted : styles.controlButtonActive,
        pressed && styles.controlPressed,
      ]}>
      <Text style={[styles.controlText, muted ? styles.controlTextMuted : styles.controlTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LiveKitRoomControls({
  isCameraEnabled,
  isMicEnabled,
  isWorking,
  onLeave,
  onToggleCamera,
  onToggleMic,
}: LiveKitRoomControlsProps) {
  return (
    <View style={styles.container}>
      <ControlButton
        label={isWorking ? 'Working...' : isMicEnabled ? 'Mute Mic' : 'Unmute Mic'}
        muted={!isMicEnabled}
        onPress={onToggleMic}
      />
      <ControlButton
        label={isWorking ? 'Working...' : isCameraEnabled ? 'Camera Off' : 'Camera On'}
        muted={!isCameraEnabled}
        onPress={onToggleCamera}
      />
      <ControlButton label="Leave Room" muted onPress={onLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  controlButtonActive: {
    backgroundColor: palette.primary,
  },
  controlButtonMuted: {
    backgroundColor: '#fff1f1',
    borderWidth: 1,
    borderColor: '#f0c4c4',
  },
  controlText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  controlTextActive: {
    color: '#ffffff',
  },
  controlTextMuted: {
    color: '#9d2f2f',
  },
  controlPressed: {
    opacity: 0.9,
  },
});
