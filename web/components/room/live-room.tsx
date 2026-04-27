"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
  type LocalTrackPublication,
  type LocalVideoTrack,
} from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { RoomControls } from "@/components/room/room-controls";
import { LocalVideoPreview } from "@/components/room/local-video-preview";
import { RoomVideoTile } from "@/components/room/room-video-tile";
import { TherapyDemoSheet } from "@/components/room/therapy-demo-sheet";
import { WhiteboardOverlay } from "@/components/room/whiteboard-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ROOM_SIGNAL_TOPIC,
  decodeRoomSignal,
  encodeRoomSignal,
  type RoomSignal,
  type TimerSignalState,
  type WhiteboardStroke,
} from "@/lib/livekit/signals";
import type {
  TherapyAnswerMap,
  TherapyInkStroke,
} from "@/lib/therapy-demo";
import { fetchLiveKitToken } from "@/lib/livekit/token";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveSessionRoomState,
  listSessionParticipants,
  updateSessionTimer,
} from "@/lib/supabase/queries";
import type {
  LiveKitRole,
  LiveKitTokenResponse,
  SessionParticipant,
  SessionRoomState,
} from "@/lib/types";
import { formatDateTime, formatSeconds } from "@/lib/utils";

function backHrefForRole(role: LiveKitRole) {
  return role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
}

function calculateDisplayedSeconds(state: TimerSignalState, now = Date.now()) {
  if (!state.timer_running || !state.timer_started_at) {
    return state.elapsed_seconds;
  }

  const startedAt = Date.parse(state.timer_started_at);

  if (Number.isNaN(startedAt)) {
    return state.elapsed_seconds;
  }

  return state.elapsed_seconds + Math.max(0, Math.floor((now - startedAt) / 1000));
}

function normalizeTimerState(state: SessionRoomState | TimerSignalState): TimerSignalState {
  return {
    elapsed_seconds: state.elapsed_seconds,
    timer_running: state.timer_running,
    timer_started_at: state.timer_started_at,
  };
}

function hasAnyTherapyAnswer(answers: TherapyAnswerMap) {
  return Object.values(answers).some((value) => value.trim() !== "");
}

type DeviceKind = "camera" | "microphone";

function getMediaErrorMessage(error: unknown, kind: DeviceKind) {
  const deviceLabel = kind === "camera" ? "camera" : "microphone";

  if (!(error instanceof Error)) {
    return `Unable to access your ${deviceLabel} right now.`;
  }

  const errorName = "name" in error && typeof error.name === "string" ? error.name : "";

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return `Access to your ${deviceLabel} was blocked. Allow it in the browser permissions and try again.`;
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return `No ${deviceLabel} was found on this device.`;
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return `Your ${deviceLabel} is busy in another app or browser tab. Close the other app and try again.`;
  }

  if (errorName === "SecurityError") {
    return `Your browser blocked ${deviceLabel} access. Open the site in Chrome or Edge and try again.`;
  }

  if (error.message.toLowerCase().includes("could not start video source")) {
    return "The camera could not start. It is likely being used by another app, blocked by browser permissions, or unavailable in this embedded browser.";
  }

  if (error.message.toLowerCase().includes("permission")) {
    return `Access to your ${deviceLabel} was blocked. Allow it in the browser permissions and try again.`;
  }

  return error.message || `Unable to access your ${deviceLabel} right now.`;
}

function ensureDeviceAccessSupport() {
  if (typeof window === "undefined") {
    return;
  }

  if (!window.isSecureContext) {
    throw new Error("Camera and microphone access require localhost or HTTPS.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "This browser cannot access camera or microphone devices. Open the lesson in Chrome or Edge instead.",
    );
  }
}

async function createAndPublishCameraTrack(
  localParticipant: ReturnType<typeof useLocalParticipant>["localParticipant"],
  shouldPublish: boolean,
) {
  const videoTrack = await createLocalVideoTrack();
  let publication: LocalTrackPublication | null = null;

  if (shouldPublish) {
    publication = await localParticipant.publishTrack(videoTrack, {
      source: Track.Source.Camera,
    });
  }

  return {
    publication,
    videoTrack,
  };
}

async function createAndPublishMicrophoneTrack(
  localParticipant: ReturnType<typeof useLocalParticipant>["localParticipant"],
  shouldPublish: boolean,
) {
  const audioTrack = await createLocalAudioTrack();
  let publication: LocalTrackPublication | null = null;

  if (shouldPublish) {
    publication = await localParticipant.publishTrack(audioTrack, {
      source: Track.Source.Microphone,
    });
  }

  return {
    audioTrack,
    publication,
  };
}

export function LiveRoom({
  joinCode,
  participantId,
  role,
  sessionId,
  sessionTitle,
  studentName,
}: {
  joinCode: string;
  participantId?: string;
  role: LiveKitRole;
  sessionId: string;
  sessionTitle?: string;
  studentName?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomState, setRoomState] = useState<SessionRoomState | null>(null);
  const [tokenResponse, setTokenResponse] = useState<LiveKitTokenResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      setError(null);
      setIsLoading(true);

      if (role === "student" && !participantId) {
        if (isMounted) {
          setError("The student account participant could not be verified for this session.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const [resolvedRoomState, resolvedToken] = await Promise.all([
          getActiveSessionRoomState(supabase, sessionId, joinCode),
          fetchLiveKitToken(
            role === "teacher"
              ? {
                  role,
                  joinCode,
                  sessionId,
                }
              : {
                  role,
                  joinCode,
                  participantId: participantId ?? "",
                  sessionId,
                },
          ),
        ]);

        if (!resolvedRoomState) {
          throw new Error("This session is no longer active.");
        }

        if (!isMounted) {
          return;
        }

        setRoomState(resolvedRoomState);
        setTokenResponse(resolvedToken);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to prepare the lesson room right now.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRoom();

    return () => {
      isMounted = false;
    };
  }, [joinCode, participantId, role, sessionId, supabase]);

  if (isLoading || !roomState || !tokenResponse) {
    return (
      <main className="min-h-screen px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <Card className="space-y-5 p-8">
            <Badge>Preparing lesson room</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
                {sessionTitle ?? "Loading session"}
              </h1>
              <p className="text-sm leading-6 text-[var(--color-text-soft)]">
                {error
                  ? error
                  : "Connecting your browser to Supabase and LiveKit so the lesson room is ready."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={backHrefForRole(role)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
              >
                {role === "teacher" ? "Back to dashboard" : "Back to student dashboard"}
              </Link>
              {error ? (
                <Button onClick={() => window.location.reload()} variant="primary">
                  Retry room setup
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-8">
      <LiveKitRoom
        audio={false}
        className="mx-auto max-w-[1600px]"
        connect
        connectOptions={{
          autoSubscribe: true,
        }}
        onError={(liveKitError) => setError(liveKitError.message)}
        onMediaDeviceFailure={(_, deviceKind) =>
          setError(
            deviceKind
              ? `The browser could not access your ${deviceKind}. Please allow permissions and try again.`
              : "The browser could not access your camera or microphone.",
          )
        }
        serverUrl={tokenResponse.url}
        token={tokenResponse.token}
        video={false}
      >
        <RoomExperience
          initialRoomState={roomState}
          joinCode={tokenResponse.roomName}
          participantId={participantId}
          role={role}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          studentName={studentName}
          supabase={supabase}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}

function RoomExperience({
  initialRoomState,
  joinCode,
  participantId,
  role,
  sessionId,
  sessionTitle,
  studentName,
  supabase,
}: {
  initialRoomState: SessionRoomState;
  joinCode: string;
  participantId?: string;
  role: LiveKitRole;
  sessionId: string;
  sessionTitle?: string;
  studentName?: string;
  supabase: SupabaseClient;
}) {
  const router = useRouter();
  const room = useRoomContext();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const { cameraTrack, isCameraEnabled, isMicrophoneEnabled, localParticipant } =
    useLocalParticipant();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isTimerPending, setIsTimerPending] = useState(false);
  const [joinedStudents, setJoinedStudents] = useState<SessionParticipant[]>([]);
  const [localCameraPublication, setLocalCameraPublication] =
    useState<LocalTrackPublication | null>(null);
  const [localCameraTrack, setLocalCameraTrack] = useState<LocalVideoTrack | null>(null);
  const [localMicrophonePublication, setLocalMicrophonePublication] =
    useState<LocalTrackPublication | null>(null);
  const [localMicrophoneTrack, setLocalMicrophoneTrack] =
    useState<LocalAudioTrack | null>(null);
  const [sessionState, setSessionState] = useState(initialRoomState);
  const [therapyAnswers, setTherapyAnswers] = useState<TherapyAnswerMap>({});
  const [therapySubmitted, setTherapySubmitted] = useState(false);
  const [therapyInkStrokes, setTherapyInkStrokes] = useState<TherapyInkStroke[]>(
    [],
  );
  const [whiteboardEnabled, setWhiteboardEnabled] = useState(false);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [timerNow, setTimerNow] = useState(0);
  const skipNextTherapyBroadcastRef = useRef(false);
  const remoteParticipants = useMemo(
    () =>
      [...participants]
        .filter((participant) => !participant.isLocal)
        .sort((leftParticipant, rightParticipant) =>
          leftParticipant.identity.localeCompare(rightParticipant.identity),
        ),
    [participants],
  );
  const remoteCameraTrackByIdentity = useMemo(
    () =>
      new Map(
        tracks
          .filter((trackRef) => !trackRef.participant.isLocal)
          .map((trackRef) => [trackRef.participant.identity, trackRef]),
      ),
    [tracks],
  );
  const localParticipantLabel =
    localParticipant.name?.trim() || localParticipant.identity || "You";
  const effectiveLocalVideoTrack = localCameraTrack ?? cameraTrack?.videoTrack ?? null;
  const isLocalCameraActive = Boolean(effectiveLocalVideoTrack);
  const isLocalMicrophoneActive = Boolean(localMicrophoneTrack) || isMicrophoneEnabled;

  const displayedElapsedSeconds = useMemo(
    () => calculateDisplayedSeconds(sessionState, timerNow),
    [sessionState, timerNow],
  );

  const { send } = useDataChannel(ROOM_SIGNAL_TOPIC, (message) => {
    const signal = decodeRoomSignal(message.payload);

    if (!signal) {
      return;
    }

    if (signal.type === "timer.state") {
      setTimerNow(Date.now());
      setSessionState((currentState) => ({
        ...currentState,
        ...signal.state,
      }));
      return;
    }

    if (signal.type === "therapy.snapshot") {
      skipNextTherapyBroadcastRef.current = true;
      setTherapyAnswers(signal.answers);
      setTherapyInkStrokes(signal.strokes);
      setTherapySubmitted(signal.submitted);
      return;
    }

    if (signal.type === "whiteboard.clear") {
      setWhiteboardStrokes([]);
      return;
    }

    setWhiteboardStrokes((currentStrokes) => {
      if (currentStrokes.some((stroke) => stroke.id === signal.stroke.id)) {
        return currentStrokes;
      }

      return [...currentStrokes, signal.stroke];
    });
  });

  useEffect(() => {
    if (!sessionState.timer_running) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [sessionState.timer_running]);

  useEffect(() => {
    if (connectionState !== "connected" || participants.length < 2) {
      return;
    }

    if (skipNextTherapyBroadcastRef.current) {
      skipNextTherapyBroadcastRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void send(
        encodeRoomSignal({
          type: "therapy.snapshot",
          answers: therapyAnswers,
          strokes: therapyInkStrokes,
          submitted: therapySubmitted,
        }),
        {
          reliable: true,
          topic: ROOM_SIGNAL_TOPIC,
        },
      ).catch((signalError) => {
        setFeedback(
          signalError instanceof Error
            ? signalError.message
            : "Unable to sync the therapy worksheet right now.",
        );
      });
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [
    connectionState,
    participants.length,
    send,
    therapyAnswers,
    therapyInkStrokes,
    therapySubmitted,
  ]);

  useEffect(() => {
    return () => {
      if (localCameraTrack) {
        localCameraTrack.stop();
        localCameraTrack.detach();
      }
    };
  }, [localCameraTrack]);

  useEffect(() => {
    return () => {
      if (localMicrophoneTrack) {
        localMicrophoneTrack.stop();
      }
    };
  }, [localMicrophoneTrack]);

  useEffect(() => {
    if (
      !localCameraTrack ||
      localCameraPublication ||
      connectionState !== "connected"
    ) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const publication = await localParticipant.publishTrack(localCameraTrack, {
          source: Track.Source.Camera,
        });

        if (!isCancelled) {
          setLocalCameraPublication(publication);
        }
      } catch (publishError) {
        if (!isCancelled) {
          setFeedback(
            publishError instanceof Error
              ? publishError.message
              : "Your camera preview is on, but the lesson room could not publish it yet.",
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [connectionState, localCameraPublication, localCameraTrack, localParticipant]);

  useEffect(() => {
    if (
      !localMicrophoneTrack ||
      localMicrophonePublication ||
      connectionState !== "connected"
    ) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const publication = await localParticipant.publishTrack(localMicrophoneTrack, {
          source: Track.Source.Microphone,
        });

        if (!isCancelled) {
          setLocalMicrophonePublication(publication);
        }
      } catch (publishError) {
        if (!isCancelled) {
          setFeedback(
            publishError instanceof Error
              ? publishError.message
              : "Your microphone is on, but the lesson room could not publish it yet.",
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    connectionState,
    localMicrophonePublication,
    localMicrophoneTrack,
    localParticipant,
  ]);

  useEffect(() => {
    let isMounted = true;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const refreshedState = await getActiveSessionRoomState(
            supabase,
            sessionId,
            joinCode,
          );

          if (!isMounted || !refreshedState) {
            return;
          }

          setSessionState((currentState) => {
            const hasTimerChanged =
              currentState.elapsed_seconds !== refreshedState.elapsed_seconds ||
              currentState.timer_running !== refreshedState.timer_running ||
              currentState.timer_started_at !== refreshedState.timer_started_at;

            return hasTimerChanged ? refreshedState : currentState;
          });
          setTimerNow(Date.now());
        } catch {
          // Keep the room usable even if polling misses intermittently.
        }
      })();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [joinCode, sessionId, supabase]);

  useEffect(() => {
    let isMounted = true;

    if (role !== "teacher") {
      return;
    }

    async function loadParticipants() {
      try {
        const roster = await listSessionParticipants(supabase, sessionId);

        if (isMounted) {
          setJoinedStudents(roster);
        }
      } catch (participantError) {
        if (isMounted) {
          setFeedback(
            participantError instanceof Error
              ? participantError.message
              : "Unable to load the joined students for this session.",
          );
        }
      }
    }

    void loadParticipants();
    const intervalId = window.setInterval(() => {
      void loadParticipants();
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [role, sessionId, supabase]);

  const syncRoomSignal = async (signal: RoomSignal) => {
    if (connectionState !== "connected") {
      return;
    }

    try {
      await send(encodeRoomSignal(signal), {
        reliable: true,
        topic: ROOM_SIGNAL_TOPIC,
      });
    } catch (signalError) {
      setFeedback(
        signalError instanceof Error
          ? signalError.message
          : "Unable to sync this room action to the other participant.",
      );
    }
  };

  const refreshSessionRoomState = async () => {
    const refreshedState = await getActiveSessionRoomState(
      supabase,
      sessionId,
      joinCode,
    );

    if (refreshedState) {
      setSessionState(refreshedState);
      return refreshedState;
    }

    return null;
  };

  const persistTimerState = async (nextState: TimerSignalState) => {
    const previousState = sessionState;
    setTimerNow(Date.now());
    setSessionState((currentState) => ({
      ...currentState,
      ...nextState,
    }));
    setIsTimerPending(true);

    try {
      const savedState = await updateSessionTimer(
        supabase,
        sessionId,
        joinCode,
        nextState,
        participantId,
      );
      setSessionState(savedState);
      setTimerNow(Date.now());
      await syncRoomSignal({
        type: "timer.state",
        state: normalizeTimerState(savedState),
      });
      return savedState;
    } catch (timerError) {
      setSessionState(previousState);
      await refreshSessionRoomState();
      setFeedback(
        timerError instanceof Error
          ? timerError.message
          : "Unable to update the lesson timer right now.",
      );
      return null;
    } finally {
      setIsTimerPending(false);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);

    try {
      if (sessionState.timer_running) {
        await persistTimerState({
          elapsed_seconds: calculateDisplayedSeconds(sessionState, Date.now()),
          timer_running: false,
          timer_started_at: null,
        });
      }

      await room.disconnect();
    } finally {
      router.replace(backHrefForRole(role));
    }
  };

  const handleToggleMicrophone = async () => {
    setFeedback(null);

    try {
      ensureDeviceAccessSupport();

      if (!isLocalMicrophoneActive) {
        const { audioTrack, publication } = await createAndPublishMicrophoneTrack(
          localParticipant,
          connectionState === "connected",
        );
        setLocalMicrophoneTrack(audioTrack);
        setLocalMicrophonePublication(publication);
        return;
      }

      if (localMicrophonePublication && localMicrophoneTrack) {
        try {
          await localParticipant.unpublishTrack(localMicrophoneTrack);
        } catch {
          // Keep the local UI responsive even if the room publish state is stale.
        }
      } else if (isMicrophoneEnabled) {
        try {
          await localParticipant.setMicrophoneEnabled(false);
        } catch {
          // The direct local track below is still stopped either way.
        }
      }

      if (localMicrophoneTrack) {
        localMicrophoneTrack.stop();
      }

      setLocalMicrophonePublication(null);
      setLocalMicrophoneTrack(null);
    } catch (microphoneError) {
      setFeedback(getMediaErrorMessage(microphoneError, "microphone"));
    }
  };

  const handleToggleCamera = async () => {
    setFeedback(null);

    try {
      ensureDeviceAccessSupport();

      if (!isLocalCameraActive) {
        const { publication, videoTrack } = await createAndPublishCameraTrack(
          localParticipant,
          connectionState === "connected",
        );
        setLocalCameraTrack(videoTrack);
        setLocalCameraPublication(publication);
        return;
      }

      if (localCameraPublication && localCameraTrack) {
        try {
          await localParticipant.unpublishTrack(localCameraTrack);
        } catch {
          // Keep the local UI responsive even if the room publish state is stale.
        }
      } else if (isCameraEnabled) {
        try {
          await localParticipant.setCameraEnabled(false);
        } catch {
          // The direct local track below is still stopped either way.
        }
      }

      if (localCameraTrack) {
        localCameraTrack.stop();
        localCameraTrack.detach();
      }

      setLocalCameraPublication(null);
      setLocalCameraTrack(null);
    } catch (cameraError) {
      setFeedback(getMediaErrorMessage(cameraError, "camera"));
    }
  };

  const handleStrokeComplete = (stroke: WhiteboardStroke) => {
    setWhiteboardStrokes((currentStrokes) => [...currentStrokes, stroke]);
    void syncRoomSignal({
      type: "whiteboard.stroke",
      stroke,
    });
  };

  const handleClearWhiteboard = () => {
    setWhiteboardStrokes([]);
    void syncRoomSignal({
      by: role,
      type: "whiteboard.clear",
    });
  };

  const handleTherapyAnswerChange = (questionId: string, value: string) => {
    const shouldStartTimer =
      role === "student" &&
      !therapySubmitted &&
      !sessionState.timer_running &&
      !isTimerPending &&
      !hasAnyTherapyAnswer(therapyAnswers) &&
      value.trim() !== "";

    setTherapyAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: value,
    }));

    if (shouldStartTimer) {
      void persistTimerState({
        elapsed_seconds: sessionState.elapsed_seconds,
        timer_running: true,
        timer_started_at: new Date().toISOString(),
      });
    }
  };

  const handleTherapyStrokeComplete = (stroke: TherapyInkStroke) => {
    const shouldStartTimer =
      role === "student" &&
      !therapySubmitted &&
      !sessionState.timer_running &&
      !isTimerPending &&
      !hasAnyTherapyAnswer(therapyAnswers) &&
      therapyInkStrokes.length === 0;

    setTherapyInkStrokes((currentStrokes) => [...currentStrokes, stroke]);

    if (shouldStartTimer) {
      void persistTimerState({
        elapsed_seconds: sessionState.elapsed_seconds,
        timer_running: true,
        timer_started_at: new Date().toISOString(),
      });
    }
  };

  const handleClearTherapyInk = () => {
    setTherapyInkStrokes([]);
  };

  const resetTherapyAttemptState = () => {
    setTherapySubmitted(false);
    setTherapyAnswers({});
    setTherapyInkStrokes([]);
  };

  const handleResetTherapyWorksheet = () => {
    resetTherapyAttemptState();
    if (sessionState.elapsed_seconds !== 0 || sessionState.timer_running) {
      void persistTimerState({
        elapsed_seconds: 0,
        timer_running: false,
        timer_started_at: null,
      });
    }
  };

  const handleSubmitTherapyWorksheet = async () => {
    if (role !== "student" || therapySubmitted || isTimerPending) {
      return;
    }

    setTherapySubmitted(true);

    if (!sessionState.timer_running) {
      return;
    }

    await persistTimerState({
      elapsed_seconds: calculateDisplayedSeconds(sessionState, Date.now()),
      timer_running: false,
      timer_started_at: null,
    });
  };

  const handleTeacherResetTimer = async () => {
    if (role !== "teacher" || isTimerPending) {
      return;
    }

    resetTherapyAttemptState();

    await persistTimerState({
      elapsed_seconds: 0,
      timer_running: false,
      timer_started_at: null,
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-6">
        <Card className="space-y-5 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{role === "teacher" ? "Teacher room" : "Student room"}</Badge>
                <Badge className="bg-[var(--color-surface-soft)] text-[var(--color-text-soft)]">
                  {connectionState}
                </Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
                  {sessionTitle ?? sessionState.title}
                </h1>
                <p className="font-mono text-lg text-[var(--color-primary-strong)]">
                  Room code: {joinCode}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] bg-[var(--color-surface-soft)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Timer
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold text-[var(--color-text)]">
                  {formatSeconds(displayedElapsedSeconds)}
                </p>
              </div>
              <div className="rounded-[24px] bg-[var(--color-surface-soft)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Participants
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                  {participants.length}
                </p>
              </div>
              <div className="rounded-[24px] bg-[var(--color-surface-soft)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Created
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text)]">
                  {formatDateTime(sessionState.created_at)}
                </p>
              </div>
            </div>
          </div>

          <RoomControls
            cameraEnabled={isLocalCameraActive}
            isBusy={isLeaving || isTimerPending}
            microphoneEnabled={isLocalMicrophoneActive}
            onLeave={handleLeave}
            onToggleCamera={handleToggleCamera}
            onToggleMicrophone={handleToggleMicrophone}
            onToggleWhiteboard={() => setWhiteboardEnabled((current) => !current)}
            timerRunning={sessionState.timer_running}
            whiteboardEnabled={whiteboardEnabled}
          />

          {feedback ? (
            <div className="rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
              {feedback}
            </div>
          ) : null}
        </Card>

        <div className="relative overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 shadow-[var(--shadow-card)]">
          <div className="grid gap-4 lg:grid-cols-2">
            <LocalVideoPreview
              cameraEnabled={isLocalCameraActive}
              microphoneEnabled={isLocalMicrophoneActive}
              participantLabel={localParticipantLabel}
              track={effectiveLocalVideoTrack}
            />
            {remoteParticipants.length > 0 ? (
              remoteParticipants.map((participant, index) => (
                <RoomVideoTile
                  key={participant.identity}
                  participant={participant}
                  priority={index === 0}
                  trackRef={
                    remoteCameraTrackByIdentity.get(participant.identity) ?? null
                  }
                />
              ))
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 text-center text-sm leading-6 text-[var(--color-text-soft)]">
                Waiting for the other person to join the lesson room and turn on
                their camera.
              </div>
            )}
          </div>
          {whiteboardEnabled ? (
            <WhiteboardOverlay
              enabled={whiteboardEnabled}
              onClear={handleClearWhiteboard}
              onStrokeComplete={handleStrokeComplete}
              role={role}
              strokes={whiteboardStrokes}
            />
          ) : null}
        </div>

        <TherapyDemoSheet
          answers={therapyAnswers}
          elapsedSeconds={displayedElapsedSeconds}
          inkStrokes={therapyInkStrokes}
          isSubmitting={isTimerPending}
          isTimerRunning={sessionState.timer_running}
          onAnswerChange={handleTherapyAnswerChange}
          onClearInk={handleClearTherapyInk}
          onResetWorksheet={handleResetTherapyWorksheet}
          onStrokeComplete={handleTherapyStrokeComplete}
          onSubmitWorksheet={handleSubmitTherapyWorksheet}
          role={role}
          submitted={therapySubmitted}
        />

        <StartAudio
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
          label="Enable lesson audio"
        />
      </section>

      <aside className="space-y-6">
        <Card className="space-y-4">
          <Badge>Session details</Badge>
          <div className="space-y-3 text-sm text-[var(--color-text-soft)]">
            <p>
              <span className="font-semibold text-[var(--color-text)]">Role:</span>{" "}
              {role}
            </p>
            <p>
              <span className="font-semibold text-[var(--color-text)]">Join code:</span>{" "}
              {joinCode}
            </p>
            {studentName ? (
              <p>
                <span className="font-semibold text-[var(--color-text)]">
                  Student name:
                </span>{" "}
                {studentName}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-[var(--color-text)]">
                Whiteboard:
              </span>{" "}
              Shared live overlay
            </p>
            <p>
              <span className="font-semibold text-[var(--color-text)]">
                Therapy demo:
              </span>{" "}
              Keyboard answers plus writing pad worksheet
            </p>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[var(--color-text)]">
                Connected now
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                LiveKit participants currently in the room.
              </p>
            </div>
            <Badge>{participants.length}</Badge>
          </div>

          <div className="space-y-3">
            {participants.map((participant) => (
              <div
                key={participant.identity}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {participant.name?.trim() || participant.identity}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                    {participant.isLocal ? "You" : "Remote"}
                  </p>
                </div>
                <Badge className="bg-[var(--color-surface-soft)] text-[var(--color-text-soft)]">
                  {participant.isLocal
                    ? isLocalCameraActive
                      ? "Cam on"
                      : "Cam off"
                    : participant.isCameraEnabled
                      ? "Cam on"
                      : "Cam off"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {role === "teacher" ? (
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[var(--color-text)]">
                  Joined students
                </p>
                <p className="text-sm text-[var(--color-text-soft)]">
                  Supabase session participant records for this lesson.
                </p>
              </div>
              <Badge>{joinedStudents.length}</Badge>
            </div>

            <div className="space-y-3">
              {joinedStudents.length > 0 ? (
                joinedStudents.map((participant) => (
                  <div
                    key={participant.id}
                    className="rounded-2xl border border-[var(--color-border)] px-4 py-3"
                  >
                    <p className="font-semibold text-[var(--color-text)]">
                      {participant.display_name}
                    </p>
                    <p className="text-sm text-[var(--color-text-soft)]">
                      Joined: {formatDateTime(participant.joined_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-soft)]">
                  No students have joined this session yet.
                </div>
              )}
            </div>
          </Card>
        ) : null}

        <Card className="space-y-4">
          <p className="text-lg font-semibold text-[var(--color-text)]">
            Lesson actions
          </p>
          <div className="flex flex-col gap-3">
            {role === "teacher" ? (
              <Button
                disabled={isTimerPending}
                onClick={handleTeacherResetTimer}
                variant="secondary"
              >
                Reset attempt
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setWhiteboardEnabled(true);
                setFeedback(null);
              }}
              variant="secondary"
            >
              Reopen whiteboard
            </Button>
            <Button onClick={handleLeave} variant="secondary">
              {role === "teacher"
                ? "Leave to dashboard"
                : "Leave to student dashboard"}
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}
