// Dawn Courier — weather and wind.
// A dawn valley wind that breathes: a slow base wind plus gusts that push
// the plane sideways and ruffle the clouds. The HUD shows where it blows
// from and how hard, so the pilot can crab into it on approach. The wind is
// noticeable but never unfair: a few metres a second against a 60 m/s plane.

import * as THREE from 'three';

export class Weather {
  constructor() {
    this.time = 0;
    this.wind = new THREE.Vector3(2.5, 0, 1.2); // m/s, world space
    this.gust = 0; // 0 calm to 1 a strong gust
    this.baseDir = 0.6; // radians: the direction the wind blows toward
    this.baseSpeed = 2.8; // m/s
  }

  update(dt) {
    this.time += dt;
    // The base wind wanders slowly; gusts pulse every few seconds.
    const wander = Math.sin(this.time * 0.05) * 0.4;
    const gustWave =
      Math.sin(this.time * 0.35) * Math.sin(this.time * 0.13 + 2);
    this.gust = Math.max(0, gustWave);
    const gustSpeed = this.gust * 4.5;
    const speed = this.baseSpeed + gustSpeed;
    const dir = this.baseDir + wander;
    this.wind.set(Math.sin(dir), 0, Math.cos(dir)).multiplyScalar(speed);
  }

  // Wind speed in knots, for the HUD.
  get speedKts() {
    return this.wind.length() * 1.94384;
  }

  // The heading the wind blows toward, 0 north, for the HUD arrow.
  get toDeg() {
    const h = (Math.atan2(this.wind.x, -this.wind.z) * 180) / Math.PI;
    return (h + 360) % 360;
  }

  // How rough the air is right now, 0 smooth to 1 a strong gust. The
  // flight model wobbles the plane a little by this much.
  get turbulence() {
    return this.gust;
  }

  reset() {
    this.time = 0;
    this.update(0);
  }
}
