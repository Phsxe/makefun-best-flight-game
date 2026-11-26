// Dawn Courier — the flight model.
// An arcade-forgiving model: the plane banks to turn, climbs and descends on
// the elevator, and the throttle sets the target speed. It auto-levels gently
// so letting go never means falling out of the sky, it sinks when it gets
// slow, and it only lands when it comes down gently and slowly — anything
// harder, faster, or onto a steep slope is a crash.
//
// Orientation uses a YXZ Euler: rotation.x = pitch (positive climbs),
// rotation.y = yaw (positive turns left), rotation.z = -roll (roll positive
// banks right). The plane model faces -Z.

import * as THREE from 'three';
import { terrainHeight, isOnRunway } from './world.js';
import { clamp } from './random.js';

const WHEEL_HEIGHT = 1.3; // how high the wheels sit above the ground
const MIN_FLY_SPEED = 30; // below this the plane mushes and sinks
const TAKEOFF_SPEED = 34; // speed at which the plane can lift off
const MAX_SPEED = 78;

export class Flight {
  constructor() {
    this.pos = new THREE.Vector3(0, WHEEL_HEIGHT, 380);
    this.yaw = 0; // facing north (-z), down the valley and the runway
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.grounded = true;
    this.crashed = false;
    this.verticalSpeed = 0; // m/s, positive climbing (for the HUD + landings)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.forward = new THREE.Vector3(0, 0, -1);
  }

  // Recompute the Euler and the forward vector from the current angles.
  // Call after setting yaw/pitch/roll directly (reset, screenshots), since
  // update() is the only other place they are recomputed.
  sync() {
    this.euler.set(this.pitch, this.yaw, -this.roll, 'YXZ');
    this.forward.set(0, 0, -1).applyEuler(this.euler);
  }

  // Put the plane back on the runway, ready for another run.
  reset() {
    this.pos.set(0, WHEEL_HEIGHT, 380);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.grounded = true;
    this.crashed = false;
    this.verticalSpeed = 0;
    this.sync();
  }

  // Heading in degrees: 0 north (-z), 90 east (+x), 180 south, 270 west.
  headingDeg() {
    const h = (Math.atan2(this.forward.x, -this.forward.z) * 180) / Math.PI;
    return (h + 360) % 360;
  }

  altitudeFt() {
    return this.pos.y * 3.28084;
  }

  speedKts() {
    return this.speed * 1.94384;
  }

  // Slope of the ground under the plane, 0 flat to ~1 steep.
  groundSlope() {
    const x = this.pos.x;
    const z = this.pos.z;
    const hx = terrainHeight(x + 6, z) - terrainHeight(x - 6, z);
    const hz = terrainHeight(x, z + 6) - terrainHeight(x, z - 6);
    return Math.min(1, Math.hypot(hx, hz) / 12);
  }

  // One step. input: { pitch: -1..1 (up positive), roll: -1..1 (right
  // positive), throttle: -1..1 } plus dt seconds. Returns an event string:
  // 'takeoff' | 'landed' | 'crashed' | null.
  update(dt, input) {
    if (this.crashed) return null;
    dt = Math.min(dt, 0.1);

    // --- throttle ------------------------------------------------------
    this.throttle = clamp(this.throttle + input.throttle * 0.45 * dt, 0, 1);

    // --- speed -----------------------------------------------------------
    // Climbing costs speed, descending gives it back: throttle discipline.
    const target = clamp(18 + this.throttle * 58 - Math.sin(this.pitch) * 10, 12, 85);
    const rate = target > this.speed ? 20 : 28;
    this.speed += clamp(target - this.speed, -rate * dt, rate * dt);

    if (this.grounded) {
      // --- on the ground -------------------------------------------------
      // Wings level, rolling along the heading; steer gently with A/D.
      this.pitch = 0;
      this.roll = 0;
      this.yaw -= input.roll * 0.45 * dt;
      this.euler.set(this.pitch, this.yaw, -this.roll, 'YXZ');
      this.forward.set(0, 0, -1).applyEuler(this.euler);
      const step = this.forward.clone();
      step.y = 0;
      step.normalize().multiplyScalar(this.speed * dt);
      this.pos.add(step);
      this.pos.y = terrainHeight(this.pos.x, this.pos.z) + WHEEL_HEIGHT;
      this.verticalSpeed = 0;
      // Lift off once fast enough: pull up, or it lifts by itself at speed.
      if (this.speed > TAKEOFF_SPEED && (input.pitch > 0 || this.speed > 42)) {
        this.grounded = false;
        this.pitch = 0.1;
        return 'takeoff';
      }
      return null;
    }

    // --- in the air ------------------------------------------------------
    // Elevator: pitch follows the stick, then eases back toward level.
    const pitchRate = 0.75;
    if (input.pitch !== 0) {
      this.pitch = clamp(this.pitch + input.pitch * pitchRate * dt, -0.5, 0.5);
    } else {
      this.pitch += clamp(0 - this.pitch, -0.22 * dt, 0.22 * dt);
    }
    // Ailerons: roll follows the stick, then levels itself.
    const rollRate = 1.7;
    if (input.roll !== 0) {
      this.roll = clamp(this.roll + input.roll * rollRate * dt, -1.15, 1.15);
    } else {
      this.roll += clamp(0 - this.roll, -1.0 * dt, 1.0 * dt);
    }
    // A banked turn: the heading follows the bank.
    this.yaw -= this.roll * (0.3 + this.speed * 0.005) * dt;

    this.euler.set(this.pitch, this.yaw, -this.roll, 'YXZ');
    this.forward.set(0, 0, -1).applyEuler(this.euler);

    // Sink when slow: the wing stops flying below the minimum speed.
    let sink = 0;
    if (this.speed < MIN_FLY_SPEED) sink = (MIN_FLY_SPEED - this.speed) * 0.45;

    this.verticalSpeed = this.forward.y * this.speed - sink;
    this.pos.addScaledVector(this.forward, this.speed * dt);
    this.pos.y -= sink * dt;

    // --- the ground ------------------------------------------------------
    const ground = terrainHeight(this.pos.x, this.pos.z) + WHEEL_HEIGHT;
    if (this.pos.y <= ground) {
      const descent = -this.verticalSpeed; // positive when coming down
      const slope = this.groundSlope();
      const onRunway = isOnRunway(this.pos.x, this.pos.z);
      if (descent > 8 || this.speed > 58 || slope > 0.4) {
        this.crashed = true;
        this.pos.y = ground;
        return 'crashed';
      }
      // A gentle touchdown: roll out on the ground.
      this.pos.y = ground;
      this.grounded = true;
      this.pitch = 0;
      this.roll = 0;
      this.verticalSpeed = 0;
      return onRunway ? 'landed-runway' : 'landed-field';
    }
    return null;
  }
}
