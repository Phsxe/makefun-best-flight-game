// Dawn Courier — the game itself.
// Wires the world, the plane, the flight model, the rings, the HUD and the
// sound into one loop. States: menu (on the runway, title up), flying (the
// run), complete (landed after the last ring), crashed. The chase camera
// follows behind and above the plane and never rolls with it, so it never
// fights the pilot. ?shot=start|play|end sets up a fixed scene instead.

import * as THREE from 'three';
import { World, RUNWAY } from './world.js';
import { Plane } from './plane.js';
import { Rings } from './rings.js';
import { Flight } from './flight.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { readShotParams, applyShot } from './shots.js';

const PAR_TIME = 300; // seconds: finishing inside par earns a time bonus

export class Game {
  constructor() {
    this.state = 'menu';
    this.score = 0;
    this.elapsed = 0;
    this.timeBonus = 0;
    this.hasTakenOff = false;
    this.frozen = false; // screenshots (?shot=) hold the scene still
    this.lookYaw = 0;
    this.lookPitch = 0;
    this._camPos = new THREE.Vector3(0, 8, 395);
    this._camTarget = new THREE.Vector3(0, 2, 360);
    this._tmp = new THREE.Vector3();

    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);
    this.camera.position.copy(this._camPos);

    const { seed } = readShotParams();
    this.world = new World(this.scene, seed);
    this.plane = new Plane();
    this.scene.add(this.plane.group);
    this.rings = new Rings(this.scene);
    this.flight = new Flight();
    this.hud = new Hud(this.camera);
    this.sound = new Sound();
    this.input = new Input();
    this.input.attach();

    this._wireOverlays();
    window.addEventListener('resize', () => this._resize());
  }

  // --- overlays ------------------------------------------------------------

  _wireOverlays() {
    const $ = (id) => document.getElementById(id);
    const start = () => this.startRun();
    const again = () => this.restart();
    if ($('btn-start')) $('btn-start').addEventListener('click', () => { this.sound.ensure(); start(); });
    if ($('btn-again')) $('btn-again').addEventListener('click', () => { this.sound.ensure(); again(); });
    if ($('btn-crash')) $('btn-crash').addEventListener('click', () => { this.sound.ensure(); again(); });
    if ($('btn-mute')) $('btn-mute').addEventListener('click', () => this.toggleMute());
  }

  showOverlay(id) {
    for (const o of ['overlay-menu', 'overlay-complete', 'overlay-crash']) {
      const el = document.getElementById(o);
      if (el) el.classList.toggle('hidden', o !== id);
    }
  }

  hideOverlays() {
    this.showOverlay('');
  }

  toggleMute() {
    this.sound.ensure();
    this.sound.setMuted(!this.sound.muted);
    const b = document.getElementById('btn-mute');
    if (b) b.textContent = this.sound.muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  // --- run control ---------------------------------------------------------

  startRun() {
    this.sound.ensure();
    this.flight.reset();
    this.rings.reset();
    this.score = 0;
    this.elapsed = 0;
    this.timeBonus = 0;
    this.hasTakenOff = false;
    this.flight.throttle = 0.55;
    this.state = 'flying';
    this.hideOverlays();
    this.hud.message('DAWN COURIER — FLY THE GOLD RINGS, THEN LAND', 3);
    this.hud.hint('HOLD SHIFT FOR THROTTLE · PULL UP (W) TO TAKE OFF');
    this.positionCamera(true);
  }

  restart() {
    this.startRun();
  }

  showComplete(elapsed, score, bonus) {
    this.state = 'complete';
    const total = score + bonus;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('final-time', this._fmtTime(elapsed));
    set('final-rings', `8 / 8 rings`);
    set('final-score', `${score}`);
    set('final-bonus', `+${bonus} time bonus`);
    set('final-total', `${total}`);
    this.showOverlay('overlay-complete');
  }

  showCrashed() {
    this.state = 'crashed';
    this.showOverlay('overlay-crash');
  }

  _fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // --- camera --------------------------------------------------------------

  // Chase camera: behind and above the plane, level with the horizon (it
  // follows yaw and pitch but never rolls, so it never fights the pilot).
  // snap puts it exactly there at once (used by the screenshots).
  positionCamera(snap = false) {
    const f = this.flight;
    const back = this._tmp.copy(f.forward).multiplyScalar(-1);
    back.y = 0;
    back.normalize();
    const desired = new THREE.Vector3()
      .copy(f.pos)
      .addScaledVector(back, 11.5)
      .add(new THREE.Vector3(0, 4.2, 0));
    const look = new THREE.Vector3()
      .copy(f.pos)
      .addScaledVector(f.forward, 24)
      .add(new THREE.Vector3(0, 1.2, 0));
    // Mouse drag looks around a little without moving the plane.
    const side = new THREE.Vector3().crossVectors(f.forward, new THREE.Vector3(0, 1, 0)).normalize();
    look.addScaledVector(side, this.lookYaw * 14);
    look.y += this.lookPitch * 8;
    if (snap) {
      this._camPos.copy(desired);
      this._camTarget.copy(look);
    } else {
      const k = 1 - Math.exp(-5.5 * this._dt);
      this._camPos.lerp(desired, k);
      this._camTarget.lerp(look, 1 - Math.exp(-8 * this._dt));
    }
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camTarget);
    // Keep the camera out of the ground on the valley floor.
    if (this.camera.position.y < 2.2) this.camera.position.y = 2.2;
  }

  // --- the loop ------------------------------------------------------------

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  run() {
    const clock = new THREE.Clock();
    const { shot } = readShotParams();
    const shotApplied = applyShot(this, shot);
    if (!shotApplied) {
      this.showOverlay('overlay-menu');
      this.positionCamera(true);
    }
    window.__ready = false;
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      this._dt = dt;
      this._step(dt);
      this.renderer.render(this.scene, this.camera);
      window.__ready = true;
    };
    tick();
  }

  _step(dt) {
    const input = this.input;
    // Mouse drag looks around.
    this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - input.mouseDX * 0.0035, -0.6, 0.6);
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - input.mouseDY * 0.003, -0.35, 0.35);
    if (!input.dragging) {
      this.lookYaw *= 1 - Math.min(1, dt * 2.5);
      this.lookPitch *= 1 - Math.min(1, dt * 2.5);
    }
    if (input.wasPressed('KeyM')) this.toggleMute();

    if (this.state === 'menu') {
      if (input.wasPressed('Enter') || input.wasPressed('Space')) this.startRun();
      this.world.update(dt);
      this.positionCamera(false);
      this._syncPlaneVisual(dt);
      this._updateHud();
      input.endFrame();
      return;
    }

    if (this.state === 'complete' || this.state === 'crashed') {
      if (input.wasPressed('Enter') || input.wasPressed('KeyR') || input.wasPressed('Space')) {
        this.restart();
      }
      this.world.update(dt);
      this._syncPlaneVisual(dt);
      this._updateHud();
      input.endFrame();
      return;
    }

    // --- flying ------------------------------------------------------------
    // Screenshots hold the scene still: no flight, no rings, no clock.
    if (!this.frozen) {
      this.elapsed += dt;
      const axes = {
        pitch: input.pitchAxis(),
        roll: input.rollAxis(),
        throttle: input.throttleAxis(),
      };
      const event = this.flight.update(dt, axes);

      if (event === 'takeoff') {
        this.hasTakenOff = true;
        this.hud.message('AIRBORNE — FLY THE GOLD RING', 2);
        this.sound.thud(0.5);
      } else if (event === 'landed-runway') {
        this.sound.thud(1);
        if (this.rings.done) {
          this.timeBonus = Math.max(0, Math.round((PAR_TIME - this.elapsed) * 2));
          this.sound.fanfare();
          this.showComplete(this.elapsed, this.score, this.timeBonus);
        } else {
          this.hud.message('LANDED — HOLD SHIFT AND PULL UP TO TAKE OFF AGAIN', 2.5);
        }
      } else if (event === 'landed-field') {
        this.sound.thud(0.8);
        this.hud.message('FIELD LANDING — HOLD SHIFT AND PULL UP TO TAKE OFF AGAIN', 2.5);
      } else if (event === 'crashed') {
        this.sound.crash();
        this.showCrashed();
      }

      // Rings, in order.
      const passed = this.rings.checkPass(this.flight.pos);
      if (passed) {
        this.score += 100;
        this.sound.chime();
        if (this.rings.done) {
          this.hud.message('FINAL RING — LAND ON THE RUNWAY', 3);
          this.hud.hint('ALL RINGS FLOWN — LAND ON THE RUNWAY');
        } else {
          this.hud.message(`RING ${passed.index + 1} / 8  ·  +100`, 1.6);
        }
      }
    }

    // Hints while flying.
    if (this.state === 'flying') {
      if (!this.hasTakenOff && this.flight.grounded) {
        this.hud.hint('HOLD SHIFT FOR THROTTLE · PULL UP (W) TO TAKE OFF');
      } else if (this.flight.grounded) {
        this.hud.hint('ON THE GROUND — HOLD SHIFT AND PULL UP TO TAKE OFF AGAIN');
      } else if (this.rings.done) {
        this.hud.hint('ALL RINGS FLOWN — LAND ON THE RUNWAY');
      } else {
        this.hud.hint('FLY THROUGH THE GOLD RING');
      }
    }

    this.rings.update(dt, this.elapsed);
    this.world.update(dt);
    this.sound.update(this.flight.throttle, this.flight.speed, !this.flight.grounded);
    this._syncPlaneVisual(dt);
    this.positionCamera(false);
    this._updateHud();
    input.endFrame();
  }

  _syncPlaneVisual(dt) {
    const f = this.flight;
    this.plane.group.position.copy(f.pos);
    this.plane.group.rotation.set(f.pitch, f.yaw, -f.roll, 'YXZ');
    const spin = f.grounded && f.throttle < 0.05 ? 0 : 10 + f.throttle * 60;
    this.plane.animate(dt, spin, f.roll, f.pitch);
  }

  _updateHud() {
    const f = this.flight;
    const next = this.rings.next;
    this.hud.update({
      altFt: f.altitudeFt(),
      speedKts: f.speedKts(),
      headingDeg: f.headingDeg(),
      throttle: f.throttle,
      score: this.score,
      ringsFlown: this.rings.items.length - this.rings.remaining,
      ringsTotal: this.rings.items.length,
      timeSec: this.elapsed,
      pitch: f.pitch,
      roll: f.roll,
      ringPos: next ? next.pos : null,
      ringDist: next ? this.rings.nextDistance(f.pos) : 0,
      flying: !f.grounded,
      grounded: f.grounded,
    });
  }
}

// Boot when the page loads.
const game = new Game();
window.__game = game;
game.run();
