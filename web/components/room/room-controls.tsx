"use client";

import {
  Camera,
  CameraOff,
  Clock3,
  LogOut,
  Mic,
  MicOff,
  RotateCcw,
  Square,
  Presentation,
} from "lucide-react";

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
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <Button
        className="min-w-0 px-3 sm:px-5"
        disabled={isBusy}
        onClick={onToggleMicrophone}
        variant={microphoneEnabled ? "secondary" : "danger"}
      >
        {microphoneEnabled ? (
          <MicOff className="mr-2 shrink-0" size={18} />
        ) : (
          <Mic className="mr-2 shrink-0" size={18} />
        )}
        {microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
      </Button>
      <Button
        className="min-w-0 px-3 sm:px-5"
        disabled={isBusy}
        onClick={onToggleCamera}
        variant={cameraEnabled ? "secondary" : "danger"}
      >
        {cameraEnabled ? (
          <CameraOff className="mr-2 shrink-0" size={18} />
        ) : (
          <Camera className="mr-2 shrink-0" size={18} />
        )}
        {cameraEnabled ? "Turn camera off" : "Turn camera on"}
      </Button>
      <Button
        className="min-w-0 px-3 sm:px-5"
        disabled={isBusy}
        onClick={onToggleWhiteboard}
        variant={whiteboardEnabled ? "primary" : "secondary"}
      >
        <Presentation className="mr-2 shrink-0" size={18} />
        {whiteboardEnabled ? "Whiteboard open" : "Open whiteboard"}
      </Button>
      {onToggleTimer ? (
        <Button
          className="min-w-0 px-3 sm:px-5"
          disabled={isBusy}
          onClick={onToggleTimer}
          variant={timerRunning ? "danger" : "primary"}
        >
          {timerRunning ? (
            <Square className="mr-2 shrink-0" size={17} />
          ) : (
            <Clock3 className="mr-2 shrink-0" size={18} />
          )}
          {timerRunning ? "Stop timer" : "Start timer"}
        </Button>
      ) : null}
      {onResetTimer ? (
        <Button
          className="min-w-0 px-3 sm:px-5"
          disabled={isBusy}
          onClick={onResetTimer}
          variant="secondary"
        >
          <RotateCcw className="mr-2 shrink-0" size={18} />
          Reset timer
        </Button>
      ) : null}
      <Button
        className="min-w-0 px-3 sm:px-5"
        disabled={isBusy}
        onClick={onLeave}
        variant="ghost"
      >
        <LogOut className="mr-2 shrink-0" size={18} />
        Leave lesson
      </Button>
    </div>
  );
}
