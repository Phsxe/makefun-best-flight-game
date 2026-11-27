// Dawn Courier — the three missions.
// One valley, three sorties. Each mission names its objective, its par time
// and its finish, and the game runs whichever the pilot picked on the menu.
// The Ring Run is the v1 course; Cargo Drop and Mountain Rescue are new.

export const MISSIONS = {
  ring: {
    id: 'ring',
    name: 'RING RUN',
    tag: 'Fly the eight gold rings in order, then land on the runway.',
    par: 300, // seconds: finishing inside par earns a time bonus
  },
  cargo: {
    id: 'cargo',
    name: 'CARGO DROP',
    tag: 'Carry the crate to the drop zone and put it on the target.',
    par: 240,
  },
  rescue: {
    id: 'rescue',
    name: 'MOUNTAIN RESCUE',
    tag: 'Pick up the stranded hiker on the high ridge and bring them home.',
    par: 360,
  },
};

export const MISSION_ORDER = ['ring', 'cargo', 'rescue'];

export class Missions {
  constructor() {
    this.current = 'ring';
    this.phase = 'go'; // ring: go | done; cargo: go | dropped | return; rescue: go | aboard | return
    this.pickedUp = false; // rescue: the hiker is aboard
    this.dropped = false; // cargo: the crate is away
  }

  get def() {
    return MISSIONS[this.current];
  }

  get name() {
    return this.def.name;
  }

  get tag() {
    return this.def.tag;
  }

  get par() {
    return this.def.par;
  }

  select(id) {
    if (!MISSIONS[id]) return;
    this.current = id;
    this.reset();
  }

  reset() {
    this.phase = 'go';
    this.pickedUp = false;
    this.dropped = false;
  }

  // One line for the HUD: what the pilot is supposed to be doing now.
  objectiveText() {
    if (this.current === 'ring') {
      return this.phase === 'done' ? 'ALL RINGS FLOWN — LAND ON THE RUNWAY' : 'FLY THROUGH THE GOLD RING';
    }
    if (this.current === 'cargo') {
      if (this.phase === 'go') return 'CARRY THE CRATE TO THE DROP ZONE — PRESS C TO RELEASE';
      if (this.phase === 'dropped') return 'CRATE AWAY — WATCH WHERE IT LANDS';
      return 'DROP COMPLETE — LAND ON THE RUNWAY';
    }
    // rescue
    if (this.phase === 'go') return 'FLY TO THE BEACON ON THE HIGH RIDGE';
    if (this.phase === 'aboard') return 'HIKER ABOARD — RETURN TO THE RUNWAY';
    return 'RESCUE COMPLETE — LAND ON THE RUNWAY';
  }
}
