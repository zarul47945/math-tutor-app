import type { SessionRoomState } from "@/lib/types";
import type {
  TherapyAnswerMap,
  TherapyInkStroke,
  TherapySubmittedSetMap,
} from "@/lib/therapy-demo";

export const ROOM_SIGNAL_TOPIC = "tutor-room";

export type WhiteboardPoint = {
  x: number;
  y: number;
};

export type WhiteboardTool = "ellipse" | "eraser" | "line" | "pen" | "rectangle";

export type WhiteboardStroke = {
  id: string;
  author: string;
  color: string;
  size: number;
  points: WhiteboardPoint[];
  tool: WhiteboardTool;
};

export type TimerSignalState = Pick<
  SessionRoomState,
  "elapsed_seconds" | "timer_running" | "timer_started_at"
>;

export type RoomSignal =
  | {
      type: "timer.state";
      state: TimerSignalState;
    }
  | {
      type: "therapy.snapshot";
      answers: TherapyAnswerMap;
      revision: number;
      strokes: TherapyInkStroke[];
      submittedSets: TherapySubmittedSetMap;
    }
  | {
      type: "whiteboard.stroke";
      stroke: WhiteboardStroke;
    }
  | {
      type: "whiteboard.clear";
      by: string;
    };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeRoomSignal(signal: RoomSignal) {
  return encoder.encode(JSON.stringify(signal));
}

export function decodeRoomSignal(payload: Uint8Array) {
  try {
    const parsed = JSON.parse(decoder.decode(payload)) as RoomSignal;

    if (
      parsed &&
      typeof parsed === "object" &&
      "type" in parsed &&
      typeof parsed.type === "string"
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
