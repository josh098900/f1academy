import { COMPOUNDS } from "./tyres";
import type { RaceResult } from "./types";

// Why you won, or why you didn't.
//
// This is the loop. A result screen that only says "P5" teaches nothing and
// nobody plays twice; a result screen that says "your softs went off on lap 9
// while she was still on mediums" sends you straight back to the strategy
// board. So the report reads the race back and explains it in terms of the
// decisions the player actually made — the tyres they chose, the lap they
// boxed, the rules they committed to.
//
// Pure: it takes a finished race and says what happened. No DOM, no DB.

export type RaceReport = {
  position: number;
  gridPosition: number;
  placesGained: number; // negative = lost places
  gapToLeader: number;
  won: boolean;
  headline: string;
  notes: string[]; // the "why", most important first
};

function ordinal(n: number): string {
  return `P${n}`;
}

export function buildRaceReport(input: {
  result: RaceResult;
  playerId: string;
  gridOrder: string[]; // entrant ids, pole first
}): RaceReport {
  const { result, playerId, gridOrder } = input;

  const me = result.classification.find((c) => c.id === playerId);
  const winner = result.classification[0];
  if (!me) {
    return {
      position: 0,
      gridPosition: 0,
      placesGained: 0,
      gapToLeader: 0,
      won: false,
      headline: "No result",
      notes: [],
    };
  }

  const gridPosition = gridOrder.indexOf(playerId) + 1;
  const placesGained = gridPosition > 0 ? gridPosition - me.position : 0;
  const won = me.position === 1;

  // A retirement is the most important thing that can happen to you, so it
  // leads — and it says WHY, because the point of the report is that you can do
  // something about it next time.
  const retirement = result.events.find(
    (e) => e.type === "retirement" && e.carId === playerId
  );

  const headline = retirement
    ? retirement.type === "retirement" && retirement.cause === "crash"
      ? "Out. Into the barrier."
      : "Out. The car let you down."
    : won
      ? "Winner."
      : me.position <= 3
        ? `${ordinal(me.position)} — on the podium.`
        : `${ordinal(me.position)}.`;

  const notes: string[] = [];

  if (retirement?.type === "retirement") {
    if (retirement.cause === "crash") {
      const cliffed = result.events.some(
        (e) => e.type === "cliff" && e.carId === playerId && e.lap <= retirement.lap
      );
      notes.push(
        cliffed
          ? `You went off at ${retirement.zone} on lap ${retirement.lap} — and your tyres were already gone. A dead tyre has no grip under braking; that's how you end up in the gravel. Box before the cliff, not after it.`
          : `You went off at ${retirement.zone} on lap ${retirement.lap}. Racing on the limit is how races are won, and occasionally how they end.`
      );
    } else {
      notes.push(
        `The car failed on lap ${retirement.lap}. Nothing you did — but a better-built car fails less often.`
      );
    }
  }

  // Did the drive itself gain or lose ground? Meaningless if you're in the
  // barrier — you didn't lose two places, you lost the race.
  if (gridPosition > 0 && !retirement) {
    if (placesGained > 0) {
      notes.push(
        `Started ${ordinal(gridPosition)} and gained ${placesGained} place${
          placesGained === 1 ? "" : "s"
        }.`
      );
    } else if (placesGained < 0) {
      notes.push(
        `Started ${ordinal(gridPosition)} and lost ${-placesGained} place${
          placesGained === -1 ? "" : "s"
        }.`
      );
    } else {
      notes.push(`Started ${ordinal(gridPosition)} and held it.`);
    }
  }

  // The tyre story — the decision that most often decides the race.
  const myCliff = result.events.find(
    (e) => e.type === "cliff" && e.carId === playerId
  );
  const myPits = result.events.filter(
    (e) => e.type === "pit" && e.carId === playerId
  );
  const winnerPits = result.events.filter(
    (e) => e.type === "pit" && e.carId === winner.id
  );

  if (myCliff) {
    notes.push(
      `Your tyres went off on lap ${myCliff.lap} — past that point you were losing seconds a lap. Box earlier, or start on something harder.`
    );
  }

  if (myPits.length === 0) {
    notes.push("You never boxed. A no-stop only pays if the tyres last.");
  } else if (winnerPits.length > 0 && playerId !== winner.id) {
    const mine = myPits[0];
    const theirs = winnerPits[0];
    const diff = mine.lap - theirs.lap;
    if (diff <= -2) {
      notes.push(
        `You boxed on lap ${mine.lap}; the winner stayed out until lap ${theirs.lap}. Stopping early hands over track position — it only pays if the fresh rubber is quick enough to take it back.`
      );
    } else if (diff >= 2) {
      notes.push(
        `You boxed on lap ${mine.lap}; the winner had already been in on lap ${theirs.lap} and was on new tyres while you were nursing old ones.`
      );
    }
    if (mine.type === "pit" && theirs.type === "pit" && mine.to !== theirs.to) {
      notes.push(
        `You fitted the ${COMPOUNDS[mine.to].label}; the winner went to the ${
          COMPOUNDS[theirs.to].label
        }.`
      );
    }
  }

  // Moments — a lock-up costs you seconds AND flat-spots the tyre, so it keeps
  // costing after the corner.
  const lockups = result.events.filter(
    (e) => e.type === "lockup" && e.carId === playerId
  );
  if (lockups.length === 1 && lockups[0].type === "lockup") {
    notes.push(
      `You locked up at ${lockups[0].zone} on lap ${lockups[0].lap} and lost ${lockups[0].timeLost.toFixed(1)}s — and flat-spotted the tyre, which kept costing you afterwards.`
    );
  } else if (lockups.length > 1) {
    const lost = lockups.reduce(
      (sum, e) => sum + (e.type === "lockup" ? e.timeLost : 0),
      0
    );
    notes.push(
      `You locked up ${lockups.length} times, throwing away ${lost.toFixed(1)}s. Pushing on worn tyres is how that happens.`
    );
  }

  // Wheel-to-wheel.
  const passesMade = result.events.filter(
    (e) => e.type === "overtake" && e.carId === playerId
  ).length;
  const passedBy = result.events.filter(
    (e) => e.type === "overtake" && e.onCarId === playerId
  ).length;

  if (passesMade > 0 || passedBy > 0) {
    const parts: string[] = [];
    if (passesMade > 0) {
      parts.push(`made ${passesMade} pass${passesMade === 1 ? "" : "es"}`);
    }
    if (passedBy > 0) {
      parts.push(`were passed ${passedBy} time${passedBy === 1 ? "" : "s"}`);
    }
    notes.push(`You ${parts.join(" and ")}.`);
  }

  if (!won && !retirement) {
    notes.push(
      `${winner.name} won it, ${me.gapToLeader.toFixed(1)}s up the road.`
    );
  } else if (retirement) {
    notes.push(`${winner.name} won it.`);
  }

  return {
    position: me.position,
    gridPosition,
    placesGained,
    gapToLeader: me.gapToLeader,
    won,
    headline,
    notes,
  };
}
