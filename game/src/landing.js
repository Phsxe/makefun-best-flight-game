// Dawn Courier — precision landing.
// Every touchdown on the runway is scored: how close to the centreline the
// wheels touched, and how gently. A dead-centre kiss is worth +200; a firm
// or off-centre arrival earns little, and a landing off the strip earns
// nothing. The grade shows on the end screen, so a careful pilot can see
// the landing paid — and a rough one can see what it cost.

import { clamp } from './random.js';
import { RUNWAY } from './world.js';

const MAX_POINTS = 200; // a perfect touchdown: centred and gentle

// impact: the flight model's lastImpact { descent, speed, slope, onRunway }.
// x: the plane's x at touchdown (the runway centreline is x = RUNWAY.x).
// Returns { points, grade, align, soft }.
export function landingScore(impact, x) {
  const none = { points: 0, grade: 'OFF STRIP', align: 0, soft: 0 };
  if (!impact || !impact.onRunway) return none;
  // Centreline: 1 dead on the line, 0 at the strip's edge.
  const align = clamp(1 - Math.abs(x - RUNWAY.x) / RUNWAY.halfWidth, 0, 1);
  // Softness: a descent of 1 m/s or less is a kiss, 7 m/s or more is a slam.
  const soft = clamp(1 - (impact.descent - 1) / 6, 0, 1);
  const points = Math.round((MAX_POINTS / 2) * align + (MAX_POINTS / 2) * soft);
  const grade =
    points >= 170 ? 'PERFECT' : points >= 120 ? 'GOOD' : points >= 60 ? 'FIRM' : 'ROUGH';
  return { points, grade, align, soft };
}

// One line for the end screen, from a landingScore result.
export function landingLine(result) {
  if (!result) return 'LANDING: —';
  if (result.points <= 0) return 'LANDING: OFF STRIP · +0';
  return `LANDING: ${result.grade} · +${result.points}`;
}
