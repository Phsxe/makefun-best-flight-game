// Dawn Courier — fuel.
// A gauge that drains with throttle and refills on the runway or through a
// glowing fuel ring. Running dry means engine out: the prop stops and the
// plane glides, so throttle discipline is a real decision. A full tank lasts
// about four minutes at cruise; the two fuel rings and the runway are the
// lifelines.

import * as THREE from 'three';
import { clamp } from './random.js';

export const FUEL_MAX = 100;
const DRAIN_BASE = 0.12; // per second, engine idling
const DRAIN_THROTTLE = 0.43; // extra per second at full throttle
const DRAIN_GROUND = 0.4; // the ground sip is a fraction of the air rate
const REFUEL_RUNWAY = 25; // per second while parked on the runway
const REFUEL_RING = 50; // one fuel ring tops the tank up by this much
const RING_RADIUS = 13;
const RING_PASS_DIST = 12.5;

// Two fuel rings, set off the main course: a detour for fuel, not a freebie.
// One west of the valley early on, one east on the way north.
const FUEL_RING_SPOTS = [
  [-92, 62, 40],
  [96, 82, -350],
];

export class Fuel {
  constructor(scene) {
    this.scene = scene;
    this.level = FUEL_MAX;
    this.rings = [];
    this._buildRings();
  }

  _buildRings() {
    const geo = new THREE.TorusGeometry(RING_RADIUS, 1.0, 10, 36);
    const glowGeo = new THREE.TorusGeometry(RING_RADIUS, 2.2, 8, 36);
    for (const [x, y, z] of FUEL_RING_SPOTS) {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x2fd4c4 });
      const ring = new THREE.Mesh(geo, mat);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x2fd4c4,
        transparent: true,
        opacity: 0.2,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(ring);
      group.add(glow);
      group.position.set(x, y, z);
      // Face across the valley, so the pilot sees the ring coming.
      group.lookAt(x + 40, y, z - 80);
      this.scene.add(group);
      this.rings.push({
        group,
        glowMat,
        pos: new THREE.Vector3(x, y, z),
        used: false,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  get empty() {
    return this.level <= 0;
  }

  get low() {
    return this.level < 22;
  }

  get pct() {
    return this.level;
  }

  // Drain for one frame. In the air the engine drinks with the throttle;
  // on the ground it only sips.
  drain(throttle, dt, grounded) {
    const rate = grounded
      ? DRAIN_BASE * DRAIN_GROUND
      : DRAIN_BASE + throttle * DRAIN_THROTTLE;
    this.level = clamp(this.level - rate * dt, 0, FUEL_MAX);
  }

  // Top the tank up while parked on the runway.
  refuelOnRunway(dt) {
    this.level = clamp(this.level + REFUEL_RUNWAY * dt, 0, FUEL_MAX);
  }

  // A fuel ring counts when the plane comes within its heart. Returns the
  // ring that was just flown, or null.
  checkRing(planePos) {
    for (const r of this.rings) {
      if (r.used) continue;
      if (planePos.distanceTo(r.pos) < RING_PASS_DIST) {
        r.used = true;
        this.level = clamp(this.level + REFUEL_RING, 0, FUEL_MAX);
        r.group.visible = false;
        return r;
      }
    }
    return null;
  }

  // The unused rings breathe so the eye finds them at dawn.
  update(dt, time) {
    for (const r of this.rings) {
      if (r.used) continue;
      const pulse = Math.sin(time * 2.0 + r.pulse);
      r.glowMat.opacity = 0.18 + pulse * 0.08;
    }
  }

  reset() {
    this.level = FUEL_MAX;
    for (const r of this.rings) {
      r.used = false;
      r.group.visible = true;
    }
  }
}
