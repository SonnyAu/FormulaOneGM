import {
  CommentaryImportance,
  CommentaryMessage,
  RaceEvent,
  SessionPhase,
} from "@/lib/sim/raceweekend/raceTypes";
import { COMPOUND_INFO } from "@/lib/sim/raceweekend/pace";

export type CommentaryContext = {
  /** driverId -> short display name (used in messages). */
  names: Record<string, string>;
  phase: SessionPhase;
};

function name(ctx: CommentaryContext, driverId?: string): string {
  if (!driverId) return "A driver";
  return ctx.names[driverId] ?? driverId;
}

let commentaryCounter = 0;

function message(lap: number, phase: SessionPhase, text: string, importance: CommentaryImportance): CommentaryMessage {
  commentaryCounter += 1;
  return { id: `c-${lap}-${commentaryCounter}`, lap, phase, text, importance };
}

function issueLabel(issueKind: RaceEvent["issueKind"]): string {
  switch (issueKind) {
    case "power-loss":
      return "power loss";
    case "cooling":
      return "cooling issue";
    case "gearbox":
      return "gearbox issue";
    case "lock-up":
      return "lock-up";
    case "wide-moment":
      return "wide moment";
    default:
      return "issue";
  }
}

function penaltyLabel(penaltyKind: RaceEvent["penaltyKind"]): string {
  switch (penaltyKind) {
    case "track-limits":
      return "track limits";
    case "unsafe-defending":
      return "unsafe defending";
    case "pit-lane-speeding":
      return "pit lane speeding";
    default:
      return "race infringement";
  }
}

/** Turn a single race event into zero or more readable play-by-play lines. */
export function eventToCommentary(event: RaceEvent, ctx: CommentaryContext): CommentaryMessage[] {
  const lap = event.lap;
  const subject = name(ctx, event.driverId);
  const rival = name(ctx, event.rivalId);
  const lapPrefix = `Lap ${lap}`;

  switch (event.type) {
    case "race-start":
      return [message(lap, ctx.phase, "Lights out and away we go!", "high")];

    case "drs-range":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} is closing on ${rival} and now sits within DRS range.`, "medium")];

    case "overtake":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} makes the move and passes ${rival}!`, "high")];

    case "lead-change":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} takes the lead of the race!`, "high")];

    case "race-issue":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} has a ${issueLabel(event.issueKind)}${event.detail ? ` - ${event.detail}` : ""}.`, "medium")];

    case "issue-resolved":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} has the ${issueLabel(event.issueKind)} under control.`, "low")];

    case "penalty": {
      const seconds = event.penaltySeconds ? `${event.penaltySeconds}s` : "time";
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} receives a ${seconds} penalty for ${penaltyLabel(event.penaltyKind)}${event.detail ? ` (${event.detail})` : ""}.`, "high")];
    }

    case "pit": {
      const compound = event.compound ? COMPOUND_INFO[event.compound].label : "fresh tires";
      const stop = event.stopTimeSeconds ? ` Stop time: ${event.stopTimeSeconds.toFixed(1)}s.` : "";
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} pits for ${compound}.${stop}`, "medium")];
    }

    case "undercut":
      return [message(lap, ctx.phase, `${lapPrefix}: The undercut works. ${subject} jumps ${rival} after the pit cycle.`, "high")];

    case "tire-fading":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject}'s tires are fading badly.`, "medium")];

    case "safety-car":
      return [message(lap, ctx.phase, `${lapPrefix}: Safety Car deployed${event.detail ? ` after ${event.detail}` : ""}.`, "high")];

    case "safety-car-end":
      return [message(lap, ctx.phase, `${lapPrefix}: The Safety Car peels into the pits - racing resumes.`, "medium")];

    case "fastest-lap": {
      const t = event.timeSeconds ? ` (${event.timeSeconds.toFixed(3)}s)` : "";
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} sets the fastest lap of the race${t}.`, "low")];
    }

    case "dnf":
      return [message(lap, ctx.phase, `${lapPrefix}: ${subject} is out${event.detail ? ` - ${event.detail}` : ""}.`, "high")];

    case "race-end":
      return [message(lap, ctx.phase, `${subject} takes the win!`, "high")];

    default:
      return [];
  }
}

/** Convenience: convert a batch of events into commentary in order. */
export function eventsToCommentary(events: RaceEvent[], ctx: CommentaryContext): CommentaryMessage[] {
  return events.flatMap((event) => eventToCommentary(event, ctx));
}
