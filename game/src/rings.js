// Dawn Courier — the ring course.
// Eight glowing torus rings mark the courier run down the valley. The pilot
// flies them in order; the next ring is lit gold and pulses, passed rings go
// green and dim, and the ones after wait grey. A ring counts when the plane
// comes within its heart.

import * as THREE from 'three';
import { clamp } from './random.js';

// The course: a weaving run down the valley and back toward the runway.
// Each ring is [x, y, z]; the plane starts on the runway at z ~ 380 heading
// north (-z), so the rings lead it away and then swing it home.
export const COURSE = [
  [18, 42, 240],
  [-52, 58, 90],
  [62, 74, -70],
  [-68, 92, -230],
  [48, 108, -390],
  [-38, 96, -540],
  [78, 78, -430],
  [-8, 48, -260],
];

export const RING_RADIUS = 14;
export const RING_PASS_DIST = 12.5;

export class Rings {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.nextIndex = 0;
    this._build();
  }

  _build() {
    const geo = new THREE.TorusGeometry(RING_RADIUS, 1.15, 10, 36);
    const glowGeo = new THREE.TorusGeometry(RING_RADIUS, 2.4, 8, 36);
    COURSE.forEach(([x, y, z], i) => {
      const group = new THREE.Group();
      // The ring faces along the course: its plane is across the flight path.
      // Neighbour rings give the facing; the last faces back toward the runway.
      const from = COURSE[Math.max(0, i - 1)];
      const to = COURSE[Math.min(COURSE.length - 1, i + 1)];
      const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
      const mat = new THREE.MeshBasicMaterial({ color: 0x888888 });
      const ring = new THREE.Mesh(geo, mat);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0.0,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(ring);
      group.add(glow);
      group.position.set(x, y, z);
      // Face the ring across the direction of travel.
      group.lookAt(x + dir.x, y + dir.y, z + dir.z);
      this.scene.add(group);
      this.items.push({
        index: i,
        group,
        ring,
        glow,
        mat,
        glowMat,
        pos: new THREE.Vector3(x, y, z),
        passed: false,
        pulse: Math.random() * Math.PI * 2,
      });
    });
    this._paint();
  }

  _paint() {
    for (const it of this.items) {
      if (it.passed) {
        it.mat.color.setHex(0x37c978); // flown: green
        it.glowMat.opacity = 0.0;
      } else if (it.index === this.nextIndex) {
        it.mat.color.setHex(0xffb020); // next: gold
        it.glowMat.opacity = 0.22;
      } else {
        it.mat.color.setHex(0x9a9a9a); // waiting: grey
        it.glowMat.opacity = 0.0;
      }
    }
  }

  get next() {
    return this.items[this.nextIndex] ?? null;
  }

  get remaining() {
    return this.items.length - this.nextIndex;
  }

  get passedCount() {
    return this.nextIndex;
  }

  get done() {
    return this.nextIndex >= this.items.length;
  }

  reset() {
    this.nextIndex = 0;
    for (const it of this.items) {
      it.passed = false;
      it.group.scale.set(1, 1, 1);
    }
    this._paint();
  }

  // The next ring counts when the plane comes within its heart.
  // Returns the ring that was just passed, or null.
  checkPass(planePos) {
    const it = this.next;
    if (!it) return null;
    if (planePos.distanceTo(it.pos) < RING_PASS_DIST) {
      it.passed = true;
      this.nextIndex++;
      this._paint();
      return it;
    }
    return null;
  }

  // The next ring breathes gently so the eye finds it at dawn, and its glow
  // pulses with it; the scale and the glow move together.
  update(dt, time) {
    const it = this.next;
    if (!it) return;
    const pulse = Math.sin(time * 2.4 + it.pulse);
    const s = 1 + pulse * 0.045;
    it.group.scale.set(s, s, 1);
    it.glowMat.opacity = 0.2 + pulse * 0.09;
  }

  // Distance from the plane to the next ring, for the HUD.
  nextDistance(planePos) {
    const it = this.next;
    return it ? planePos.distanceTo(it.pos) : 0;
  }
}
