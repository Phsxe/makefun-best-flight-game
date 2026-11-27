// Dawn Courier — the cargo drop.
// A crate rides under the fuselage until the pilot releases it over the
// marked drop zone. It falls under gravity and lands on the terrain; the
// score is the distance from the centre of the zone. A clean drop on the
// target is worth 500; a wild one is worth 50.

import * as THREE from 'three';
import { terrainHeight } from './world.js';
import { clamp } from './random.js';

export const DROP_ZONE = { x: 140, z: -180, r: 22 };
const CRATE_GRAVITY = 9.8;

export class Cargo {
  constructor(scene) {
    this.scene = scene;
    this.state = 'hidden'; // hidden | loaded | falling | landed
    this.landedDist = null;
    this.vel = new THREE.Vector3();
    this._buildCrate();
    this._buildZone();
  }

  _buildCrate() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xb08a3e, flatShading: true })
    );
    g.add(box);
    // Straps around the crate, so it reads as cargo, not a box.
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
    for (const a of [0, Math.PI / 2]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 0.5), strapMat);
      strap.rotation.y = a;
      g.add(strap);
    }
    this.crate = g;
    this.crate.visible = false;
    this.scene.add(this.crate);
  }

  _buildZone() {
    const g = new THREE.Group();
    const y = terrainHeight(DROP_ZONE.x, DROP_ZONE.z);
    // A flat target ring on the field, glowing amber at dawn.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(DROP_ZONE.r - 2.5, DROP_ZONE.r, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y + 0.35;
    g.add(ring);
    // The centre dot.
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9 })
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = y + 0.35;
    g.add(dot);
    // A tall beacon column so the zone reads from the air.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffb020, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    beam.position.y = y + 30;
    g.add(beam);
    this.zone = g;
    this.zone.visible = false;
    this.scene.add(this.zone);
  }

  // Show the zone and load the crate for a cargo run.
  arm() {
    this.state = 'loaded';
    this.landedDist = null;
    this.zone.visible = true;
    this.crate.visible = true;
  }

  // Hide the crate and the zone (other missions).
  disarm() {
    this.state = 'hidden';
    this.zone.visible = false;
    this.crate.visible = false;
  }

  // While loaded, the crate rides under the fuselage.
  follow(planePos) {
    if (this.state !== 'loaded') return;
    this.crate.position.copy(planePos).add(new THREE.Vector3(0, -1.9, 0.4));
  }

  // Let the crate go: it keeps the plane's forward speed and then falls.
  release(planePos, forward, speed) {
    if (this.state !== 'loaded') return false;
    this.state = 'falling';
    this.crate.position.copy(planePos).add(new THREE.Vector3(0, -1.9, 0.4));
    this.vel.copy(forward).multiplyScalar(speed);
    this.vel.y = 0;
    return true;
  }

  update(dt) {
    if (this.state !== 'falling') return;
    this.vel.y -= CRATE_GRAVITY * dt;
    this.crate.position.addScaledVector(this.vel, dt);
    const g = terrainHeight(this.crate.position.x, this.crate.position.z);
    if (this.crate.position.y <= g + 1.1) {
      this.crate.position.y = g + 1.1;
      this.state = 'landed';
      const dx = this.crate.position.x - DROP_ZONE.x;
      const dz = this.crate.position.z - DROP_ZONE.z;
      this.landedDist = Math.hypot(dx, dz);
    }
  }

  // Points for the drop: 500 dead on, falling to 50 for a wild miss.
  get accuracyScore() {
    if (this.landedDist == null) return 0;
    return Math.max(50, Math.round(500 - this.landedDist * 4));
  }

  get dropped() {
    return this.state === 'falling' || this.state === 'landed';
  }

  get landed() {
    return this.state === 'landed';
  }

  reset() {
    this.state = 'hidden';
    this.landedDist = null;
    this.zone.visible = false;
    this.crate.visible = false;
  }
}
