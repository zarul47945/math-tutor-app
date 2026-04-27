"use client";

import { Button } from "@/components/ui/button";

type RoomControlsProps = {
  cameraEnabled: boolean;
  isBusy?: boolean;
  microphoneEnabled: boolean;
  onLeave: () => void;
  onResetTimer?: () => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onToggleTimer?: () => void;
  onToggleWhiteboard: () => void;
  timerRunning: boolean;
  whiteboardEnabled: boolean;
};

export function RoomControls({
  cameraEnabled,
  isBusy = false,
  microphoneEnabled,
  onLeave,
  onResetTimer,
  onToggleCamera,
  onToggleMicrophone,
  onToggleTimer,
  onToggleWhiteboard,
  timerRunning,
  whiteboardEnabled,
}: RoomControlsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        disabled={isBusy}
        onClick={onToggleMicrophone}
        variant={microphoneEnabled ? "secondary" : "danger"}
      >
        {microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
      </Button>
      <Button
        disabled={isBusy}
        onClick={onToggleCamera}
        variant={cameraEnabled ? "secondary" : "danger"}
      >
        {cameraEnabled ? "Turn camera off" : "Turn camera on"}
      </Button>
      <Button
        disabled={isBusy}
        onClick={onToggleWhiteboard}
        variant={whiteboardEnabled ? "primary" : "secondary"}
      >
        {whiteboardEnabled ? "Hide whiteboard" : "Show whiteboard"}
      </Button>
      {onToggleTimer ? (
        <Button
          disabled={isBusy}
          onClick={onToggleTimer}
          variant={timerRunning ? "danger" : "primary"}
        >
          {timerRunning ? "Stop timer" : "Start timer"}
        </Button>
      ) : null}
      {onResetTimer ? (
        <Button
          disabled={isBusy}
          onClick={onResetTimer}
          variant="secondary"
        >
          Reset timer
        </Button>
      ) : null}
      <Button disabled={isBusy} onClick={onLeave} variant="ghost">
        Leave room
      </Button>
    </div>
  );
}
