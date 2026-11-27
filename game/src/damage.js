// Dawn Courier — damage.
// Hard landings, steep impacts and terrain scrapes wear the airframe. At
// 100% the Courier is a wreck and the flight ends. The HUD shows the meter;
// the plane trails smoke and sparks as the damage climbs, so a rough pilot
// can see the cost of every hard arrival.

import { clamp } from './random.js';

export const DAMAGE_MAX = 100;

export class Damage {
  constructor() {
    this.level = 0;
  }

  get wrecked() {
    return this.level >= DAMAGE_MAX;
  }

  // 0 no smoke, 1 a thin trail, 2 heavy smoke and sparks.
  get smokeLevel() {
    if (this.level < 40) return 0;
    if (this.level < 70) return 1;
    return 2;
  }

  // Add damage and return the new level. reason is a short label for the log.
  add(amount, reason) {
    this.level = clamp(this.level + amount, 0, DAMAGE_MAX);
    return this.level;
  }

  reset() {
    this.level = 0;
  }
}

// Severity of a touchdown, 0 gentle to 1 a wrecking arrival, from the
// impact the flight model reports: how fast it came down, how fast it was
// going, and how steep the ground was. A gentle arrival scores 0.
export function impactSeverity(descent, speed, slope) {
  const descentF = clamp((descent - 3) / 8, 0, 1);
  const speedF = clamp((speed - 45) / 25, 0, 1);
  const slopeF = clamp((slope - 0.2) / 0.4, 0, 1);
  return Math.max(descentF, speedF, slopeF);
}

// Damage from one touchdown, in points. A firm arrival costs a little, a
// hard one costs a lot; three hard ones will wreck the Courier.
export function impactDamage(severity) {
  return severity * 35;
}
