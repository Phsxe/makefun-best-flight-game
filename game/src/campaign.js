// Dawn Courier — campaign mode ("Fly the Tour").
// One sortie, three legs: the Ring Run, then the Cargo Drop, then the
// Mountain Rescue, flown back to back. Fuel and damage carry across the
// legs — the tank only refills and the airframe only mends while the
// Courier sits on the runway between legs — so a rough first leg costs
// the whole tour. Each leg scores on its own; finishing all three earns
// a tour bonus, and the final screen breaks the tour down leg by leg.

export const TOUR_LEGS = ['ring', 'cargo', 'rescue'];
export const TOUR_NAME = 'FLY THE TOUR';
export const TOUR_BONUS = 500; // for bringing all three legs home
export const TOUR_PAR = 900; // 15:00 for the whole tour, for the menu card

export class Campaign {
  constructor() {
    this.active = false;
    this.legIndex = 0;
    this.legScores = []; // mission points per leg, in leg order
    this.legBonuses = []; // time bonus per leg, in leg order
    this.legTimes = []; // seconds per leg, in leg order
  }

  get legMission() {
    return TOUR_LEGS[this.legIndex];
  }

  get legLabel() {
    return `LEG ${this.legIndex + 1}/3`;
  }

  get legsLeft() {
    return TOUR_LEGS.length - this.legIndex - 1;
  }

  get totalTime() {
    return this.legTimes.reduce((a, b) => a + b, 0);
  }

  get totalScore() {
    return this.legScores.reduce((a, b) => a + b, 0);
  }

  get totalBonus() {
    return this.legBonuses.reduce((a, b) => a + b, 0);
  }

  // Start (or restart) the tour, optionally at a later leg — the
  // screenshots jump straight to a leg to frame it.
  start(legIndex = 0) {
    this.active = true;
    this.legIndex = legIndex;
    this.legScores = [];
    this.legBonuses = [];
    this.legTimes = [];
  }

  // Record a finished leg's score and time bonus, then step on.
  recordLeg(score, bonus, time) {
    this.legScores.push(score);
    this.legBonuses.push(bonus);
    this.legTimes.push(time);
  }

  advance() {
    this.legIndex += 1;
  }

  get finished() {
    return this.legIndex >= TOUR_LEGS.length;
  }

  // The tour is over: the whole score, with the bonus for bringing all
  // three legs home.
  get grandTotal() {
    return this.totalScore + this.totalBonus + TOUR_BONUS;
  }

  // One line per leg for the final screen: "RING +3600 · CARGO +450 ·
  // RESCUE +600".
  breakdownLine() {
    const names = ['RING', 'CARGO', 'RESCUE'];
    return this.legScores
      .map((s, i) => `${names[i]} +${s}`)
      .join(' · ');
  }

  end() {
    this.active = false;
  }
}
