// Dawn Courier — effects: dust, smoke, sparks and debris.
// A tiny pooled particle system. Touchdowns kick up dust, a damaged engine
// trails smoke, a scrape throws sparks, and a crash throws debris. All cheap
// spheres, no textures, and the pool caps itself so the frame rate never pays.

import * as THREE from 'three';

const MAX_PARTICLES = 140;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = []; // { mesh, vel, life, maxLife, grow, fade }
    this._geo = new THREE.SphereGeometry(0.5, 6, 5);
    this._mats = new Map(); // colour -> material, shared
  }

  _mat(color) {
    if (!this._mats.has(color)) {
      this._mats.set(
        color,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
      );
    }
    return this._mats.get(color);
  }

  _spawn(pos, vel, life, color, size, grow = 0) {
    if (this.pool.length >= MAX_PARTICLES) return;
    const mesh = new THREE.Mesh(this._geo, this._mat(color));
    mesh.position.copy(pos);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    this.pool.push({ mesh, vel: vel.clone(), life, maxLife: life, grow, size });
  }

  // A puff of tan dust at a touchdown, drifting up and out.
  dust(pos, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 3;
      const vel = new THREE.Vector3(Math.cos(a) * r, 0.8 + Math.random() * 1.6, Math.sin(a) * r);
      this._spawn(pos, vel, 0.9 + Math.random() * 0.7, 0xcbb89a, 0.8 + Math.random() * 0.9, 1.6);
    }
  }

  // One dark smoke puff, for the engine trail of a damaged plane.
  smoke(pos) {
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.2,
      1.2 + Math.random(),
      (Math.random() - 0.5) * 1.2
    );
    this._spawn(pos, vel, 1.6 + Math.random() * 0.6, 0x3a3a3a, 0.9 + Math.random() * 0.5, 2.2);
  }

  // A burst of orange sparks, for a terrain scrape.
  sparks(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        2 + Math.random() * 6,
        (Math.random() - 0.5) * 14
      );
      this._spawn(pos, vel, 0.4 + Math.random() * 0.3, 0xffa020, 0.35 + Math.random() * 0.25, 0);
    }
  }

  // Debris on a crash: dark chunks flying out, then smoke.
  debris(pos, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 12;
      const vel = new THREE.Vector3(Math.cos(a) * r, 3 + Math.random() * 9, Math.sin(a) * r);
      this._spawn(pos, vel, 1.1 + Math.random() * 0.8, 0x2a2a2a, 0.5 + Math.random() * 0.8, 0);
    }
    this.dust(pos, 14);
  }

  update(dt) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pool.splice(i, 1);
        continue;
      }
      p.vel.y -= 1.2 * dt; // a little gravity on the heavy bits
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = 1 + p.grow * dt;
      p.mesh.scale.multiplyScalar(k);
      const mat = p.mesh.material;
      mat.opacity = 0.8 * (p.life / p.maxLife);
    }
  }

  clear() {
    for (const p of this.pool) this.scene.remove(p.mesh);
    this.pool.length = 0;
  }
}
