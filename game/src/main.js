// Dawn Courier — the game itself, v2.
// Wires the world, the plane, the flight model, the rings, the HUD and the
// sound into one loop, plus the v2 systems: fuel, damage, three missions,
// weather, cargo, landmarks and effects. States: menu (on the runway, title
// up), flying (the run), complete (landed after the mission), crashed. The
// chase camera follows behind and above the plane and never rolls with it,
// so it never fights the pilot. ?shot=start|play|end sets up a fixed scene.

import * as THREE from 'three';
import { World, RUNWAY, HELIPAD, isOnRunway, terrainHeight } from './world.js';
import { Plane } from './plane.js';
import { Rings } from './rings.js';
import { Flight } from './flight.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Fuel } from './fuel.js';
import { Damage, impactDamage } from './damage.js';
import { Missions, MISSION_ORDER } from './missions.js';
import { Landmarks } from './landmarks.js';
import { Weather } from './weather.js';
import { Cargo } from './cargo.js';
import { Effects } from './effects.js';
import { Cockpit } from './cockpit.js';
import { Campaign, TOUR_LEGS } from './campaign.js';
import { landingScore, landingLine } from './landing.js';
import { readShotParams, applyShot } from './shots.js';

const COMBO_WINDOW = 20; // seconds between rings to keep the streak alive

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
    this.selectedMission = 'ring';
    this.combo = 1;
    this.lastRingTime = -999;
    this.fuelWarnAt = -999;
    this.dropQueued = false;
    this.landBounceT = 0;
    this.smokeAcc = 0;
    this.scrapeAcc = 0;
    this.campaign = new Campaign();
    this.lastLanding = null; // the last precision-landing score, for the end screen
    this.turnTimer = 0; // seconds spent on the runway between tour legs
    this._propSpin = 0;
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
    this.landmarks = new Landmarks(this.scene, seed);
    this.plane = new Plane();
    this.scene.add(this.plane.group);
    this.rings = new Rings(this.scene);
    this.fuel = new Fuel(this.scene);
    this.cargo = new Cargo(this.scene);
    this.flight = new Flight();
    this.damage = new Damage();
    this.missions = new Missions();
    this.weather = new Weather();
    this.effects = new Effects(this.scene);
    this.hud = new Hud(this.camera);
    this.cockpit = new Cockpit(this.scene, this.camera);
    this.sound = new Sound();
    this.input = new Input();
    this.input.attach();

    this._wireOverlays();
    window.addEventListener('resize', () => this._resize());
  }

  // --- overlays ------------------------------------------------------------

  _wireOverlays() {
    const $ = (id) => document.getElementById(id);
    const start = (missionId) => this.startRun(missionId);
    const again = () => this.restart();
    if ($('btn-start')) $('btn-start').addEventListener('click', () => { this.sound.ensure(); start(this.selectedMission); });
    for (const id of MISSION_ORDER) {
      const b = $(`btn-mission-${id}`);
      if (b) b.addEventListener('click', () => { this.sound.ensure(); this.selectMission(id); start(id); });
    }
    const tourBtn = $('btn-mission-tour');
    if (tourBtn) tourBtn.addEventListener('click', () => { this.sound.ensure(); this.selectMission('tour'); start('tour'); });
    if ($('btn-again')) $('btn-again').addEventListener('click', () => { this.sound.ensure(); again(); });
    if ($('btn-crash')) $('btn-crash').addEventListener('click', () => { this.sound.ensure(); again(); });
    if ($('btn-turn')) $('btn-turn').addEventListener('click', () => { this.sound.ensure(); this._nextTourLeg(); });
    if ($('btn-mute')) $('btn-mute').addEventListener('click', () => this.toggleMute());
    if ($('btn-cockpit')) $('btn-cockpit').addEventListener('click', () => { this.sound.ensure(); this.toggleCockpit(); });
    if ($('btn-drop')) $('btn-drop').addEventListener('click', () => { this.dropQueued = true; });
  }

  selectMission(id) {
    this.selectedMission = id;
    for (const m of [...MISSION_ORDER, 'tour']) {
      const b = document.getElementById(`btn-mission-${m}`);
      if (b) b.classList.toggle('selected', m === id);
    }
  }

  // The cockpit view: first person from the pilot's seat, live instruments
  // along the bottom, the plane itself hidden so the fuselage never blocks
  // the windscreen. The chase camera is the other view.
  toggleCockpit() {
    const on = this.cockpit.toggle();
    this.hud.setCockpit(on);
    this.plane.group.visible = !on;
    const b = document.getElementById('btn-cockpit');
    if (b) b.textContent = on ? 'CHASE VIEW (V)' : 'COCKPIT (V)';
    this.positionCamera(true);
    return on;
  }

  setCockpitView(on) {
    if (this.cockpit.enabled !== on) this.toggleCockpit();
  }

  showOverlay(id) {
    for (const o of ['overlay-menu', 'overlay-complete', 'overlay-crash', 'overlay-turnaround']) {
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

  // Start a run. opts.keepFuelDamage keeps the tank and the airframe as
  // they are — a tour leg carries both over from the leg before it.
  startRun(missionId = this.selectedMission, opts = {}) {
    // The tour is a mode, not a mission: it runs its legs in order.
    if (missionId === 'tour') {
      this.startCampaign(0);
      return;
    }
    this.sound.ensure();
    this.campaign.end();
    this.missions.select(missionId);
    this.selectedMission = missionId;
    this.flight.reset();
    this.rings.reset();
    if (!opts.keepFuelDamage) {
      this.fuel.reset();
      this.damage.reset();
    }
    this.cargo.reset();
    this.weather.reset();
    this.effects.clear();
    this.score = 0;
    this.elapsed = 0;
    this.timeBonus = 0;
    this.hasTakenOff = false;
    this.combo = 1;
    this.lastRingTime = -999;
    this.fuelWarnAt = -999;
    this.dropQueued = false;
    this.landBounceT = 0;
    this.lastLanding = null;
    this.flight.throttle = 0.55;
    this.state = 'flying';
    this.hideOverlays();
    // Mission-specific setup: only the ring mission shows the gold rings;
    // cargo arms its crate and zone; rescue lights the beacon.
    const ringsVisible = missionId === 'ring';
    for (const it of this.rings.items) it.group.visible = ringsVisible;
    if (missionId === 'cargo') this.cargo.arm();
    this.landmarks.setRescueBeaconVisible(missionId === 'rescue');
    const def = this.missions.def;
    this.hud.message(def.name, 2);
    this.hud.hint(this.missions.objectiveText());
    this.positionCamera(true);
  }

  // Start the tour (Fly the Tour), optionally at a later leg — the
  // screenshots jump straight to a leg to frame it.
  startCampaign(legIndex = 0) {
    this.sound.ensure();
    this.campaign.start(legIndex);
    this.selectedMission = 'tour';
    // A fresh tour starts with a full tank and a clean airframe; a later
    // leg keeps whatever the tour has left.
    const keep = legIndex > 0;
    if (!keep) {
      this.fuel.reset();
      this.damage.reset();
    }
    this._startTourLeg();
  }

  // One leg of the tour: the leg's mission, with the tour's fuel and
  // damage carried over.
  _startTourLeg() {
    const missionId = this.campaign.legMission;
    this.missions.select(missionId);
    this.flight.reset();
    this.rings.reset();
    this.cargo.reset();
    this.weather.reset();
    this.effects.clear();
    this.score = 0;
    this.elapsed = 0;
    this.timeBonus = 0;
    this.hasTakenOff = false;
    this.combo = 1;
    this.lastRingTime = -999;
    this.fuelWarnAt = -999;
    this.dropQueued = false;
    this.landBounceT = 0;
    this.lastLanding = null;
    this.flight.throttle = 0.55;
    this.state = 'flying';
    this.hideOverlays();
    const ringsVisible = missionId === 'ring';
    for (const it of this.rings.items) it.group.visible = ringsVisible;
    if (missionId === 'cargo') this.cargo.arm();
    this.landmarks.setRescueBeaconVisible(missionId === 'rescue');
    this.hud.message(`FLY THE TOUR — ${this.campaign.legLabel} · ${this.missions.name}`, 2.5);
    this.hud.hint(this.missions.objectiveText());
    this.positionCamera(true);
  }

  // The tour's next leg, from the turnaround on the runway.
  _nextTourLeg() {
    this.campaign.advance();
    if (this.campaign.finished) {
      this._finishCampaign();
      return;
    }
    this._startTourLeg();
  }

  // Between tour legs the Courier sits on the runway: the tank refills and
  // the ground crew mends the airframe while the pilot waits. The leg
  // advances on Enter, on the button, or after a few seconds on its own.
  _enterTurnaround(legScore, legBonus, legTime) {
    this.campaign.recordLeg(legScore, legBonus, legTime);
    this.state = 'turnaround';
    this.turnTimer = 0;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const nextMission = this.campaign.legIndex + 1 < TOUR_LEGS.length
      ? TOUR_LEGS[this.campaign.legIndex + 1] : null;
    const nextName = nextMission === 'cargo' ? 'CARGO DROP' : nextMission === 'rescue' ? 'MOUNTAIN RESCUE' : 'RING RUN';
    set('turn-title', `${this.campaign.legLabel} COMPLETE ✈`);
    set('turn-sub', 'The Courier is on the runway — the tank is refilling and the ground crew is mending the airframe.');
    set('turn-score', `${this.campaign.legLabel} · ${this.missions.name} — ${legScore} points + ${legBonus} time bonus`);
    set('turn-next', nextMission ? `NEXT LEG: ${nextName}` : 'TOUR COMPLETE');
    this.showOverlay('overlay-turnaround');
  }

  // The whole tour is home: the final screen breaks it down leg by leg,
  // with the tour bonus for bringing all three home.
  _finishCampaign() {
    const total = this.campaign.grandTotal;
    this.sound.fanfare();
    this.showComplete({
      title: 'TOUR COMPLETE ✈',
      sub: 'Three legs, one dawn, one Courier home. The valley is flown.',
      time: this.campaign.totalTime,
      detailLine: this.campaign.breakdownLine(),
      score: this.campaign.totalScore,
      bonus: this.campaign.totalBonus + 500,
      landingLine: landingLine(this.lastLanding),
    });
    this.campaign.end();
  }

  restart() {
    if (this.selectedMission === 'tour') {
      this.startCampaign(0);
    } else {
      this.startRun(this.missions.current);
    }
  }

  showComplete(detail) {
    // detail: { title, sub, time, detailLine, score, bonus, landingLine }
    this.state = 'complete';
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('final-title', detail.title);
    set('final-sub', detail.sub);
    set('final-time', this._fmtTime(detail.time));
    set('final-rings', detail.detailLine);
    set('final-score', `${detail.score}`);
    set('final-bonus', `+${detail.bonus} time bonus`);
    set('final-landing', detail.landingLine || landingLine(this.lastLanding));
    set('final-total', `${detail.score + detail.bonus}`);
    this.showOverlay('overlay-complete');
  }

  showCrashed(reason = 'impact') {
    // A crash ends the tour as well as the run.
    this.campaign.end();
    this.state = 'crashed';
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    if (reason === 'fuel') {
      set('crash-title', 'OUT OF FUEL');
      set('crash-sub', 'The tank ran dry away from the runway and the Courier is stranded. Watch the fuel gauge — the runway refuels, and the teal rings top the tank up.');
    } else if (reason === 'damage') {
      set('crash-title', 'AIRFRAME WRECKED');
      set('crash-sub', 'Too many hard arrivals wore the Courier out. Come in slow, level, and on the strip — the damage meter is the price of every rough landing.');
    } else {
      set('crash-title', 'CRASHED');
      set('crash-sub', 'The Courier came down hard. The dawn valley is unforgiving — come in slow, level, and on the strip.');
    }
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
  // Cockpit camera: from the pilot's seat, rolling with the plane, the
  // mouse drag looking around a little.
  positionCamera(snap = false) {
    const f = this.flight;
    if (this.cockpit.enabled) {
      const seat = this.cockpit.seatPosition(f, this._tmp);
      this.camera.position.copy(seat);
      this.camera.rotation.set(
        f.pitch + this.lookPitch * 0.35,
        f.yaw + this.lookYaw * 0.6,
        -f.roll,
        'YXZ'
      );
      return;
    }
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
      this.selectMission('ring');
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
    if (input.wasPressed('KeyV')) this.toggleCockpit();

    if (this.state === 'menu') {
      // Pick a mission with 1/2/3/4, start the selected one with Enter.
      if (input.wasPressed('Digit1')) this.selectMission('ring');
      if (input.wasPressed('Digit2')) this.selectMission('cargo');
      if (input.wasPressed('Digit3')) this.selectMission('rescue');
      if (input.wasPressed('Digit4')) this.selectMission('tour');
      if (input.wasPressed('Enter') || input.wasPressed('Space')) this.startRun(this.selectedMission);
      this.world.update(dt);
      this.landmarks.update(dt, this.elapsed);
      this.positionCamera(false);
      this._syncPlaneVisual(dt);
      this._updateHud();
      input.endFrame();
      return;
    }

    // Between tour legs: the Courier sits on the runway, the tank refills
    // and the ground crew mends the airframe. Enter, the button, or a few
    // seconds on its own moves on to the next leg.
    if (this.state === 'turnaround') {
      this.turnTimer += dt;
      this.fuel.refuelOnRunway(dt);
      this.damage.level = Math.max(0, this.damage.level - 8 * dt);
      if (input.wasPressed('Enter') || input.wasPressed('Space') || this.turnTimer > 4) {
        this._nextTourLeg();
      }
      this.world.update(dt);
      this.landmarks.update(dt, this.elapsed);
      this.effects.update(dt);
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
      this.landmarks.update(dt, this.elapsed);
      this.effects.update(dt);
      this._syncPlaneVisual(dt);
      this._updateHud();
      input.endFrame();
      return;
    }

    // --- flying ------------------------------------------------------------
    // Screenshots hold the scene still: no flight, no rings, no clock.
    if (!this.frozen) {
      this.elapsed += dt;

      // Weather: the wind pushes the plane and ruffles the air.
      this.weather.update(dt);
      this.flight.wind.copy(this.weather.wind);
      this.flight.turbulence = this.weather.turbulence;

      // Fuel: it drains with the throttle, refills on the runway, and a dry
      // tank means engine out — the prop stops and the plane glides.
      this.fuel.drain(this.flight.throttle, dt, this.flight.grounded);
      if (this.fuel.empty) {
        if (!this.flight.engineOut) {
          this.flight.engineOut = true;
          this.hud.message('ENGINE OUT — FUEL EMPTY · GLIDE TO THE RUNWAY', 3);
          this.sound.fuelWarning();
        }
      } else if (this.fuel.level > 8) {
        this.flight.engineOut = false;
      }
      if (this.fuel.low && this.elapsed - this.fuelWarnAt > 3) {
        this.fuelWarnAt = this.elapsed;
        this.sound.fuelWarning();
      }
      if (this.flight.grounded && isOnRunway(this.flight.pos.x, this.flight.pos.z)) {
        this.fuel.refuelOnRunway(dt);
      }
      const fuelRing = this.fuel.checkRing(this.flight.pos);
      if (fuelRing) {
        this.sound.chime();
        this.hud.message('FUEL RING — +50', 1.8);
      }

      // Cargo: release the crate with C or the DROP button.
      if (this.missions.current === 'cargo' && this.missions.phase === 'go') {
        if (input.wasPressed('KeyC') || this.dropQueued) {
          this.dropQueued = false;
          if (this.cargo.release(this.flight.pos, this.flight.forward, this.flight.speed)) {
            this.missions.dropped = true;
            this.missions.phase = 'dropped';
            this.sound.drop();
            this.hud.message('CRATE AWAY — WATCH WHERE IT LANDS', 2.5);
          }
        }
      }
      this.cargo.update(dt);
      if (this.missions.current === 'cargo' && this.missions.phase === 'dropped' && this.cargo.landed) {
        const pts = this.cargo.accuracyScore;
        this.score += pts;
        this.missions.phase = 'return';
        this.sound.chime();
        this.hud.message(`CRATE DOWN — ${Math.round(this.cargo.landedDist)} m FROM CENTRE · +${pts}`, 3);
      }
      if (this.cargo.state === 'loaded') this.cargo.follow(this.flight.pos);

      // Rescue: land on the helipad (or creep in slow and low) to pick up
      // the hiker, then bring them home.
      if (this.missions.current === 'rescue' && this.missions.phase === 'go') {
        const dx = this.flight.pos.x - HELIPAD.x;
        const dz = this.flight.pos.z - HELIPAD.z;
        const near = Math.hypot(dx, dz) < 22;
        if (near && (this.flight.grounded || this.flight.speed < 10)) {
          this.missions.pickedUp = true;
          this.missions.phase = 'aboard';
          this.score += 600; // the rescue itself is worth 600 points
          this.sound.pickup();
          this.hud.message('HIKER ABOARD — RETURN TO THE RUNWAY', 3);
        }
      }

      const axes = {
        pitch: input.pitchAxis(),
        roll: input.rollAxis(),
        throttle: input.throttleAxis(),
      };
      const event = this.flight.update(dt, axes);

      if (event === 'takeoff') {
        this.hasTakenOff = true;
        this.hud.message('AIRBORNE — ' + this.missions.objectiveText(), 2);
        this.sound.thud(0.5);
      } else if (event === 'landed-runway' || event === 'landed-field') {
        // A touchdown wears the airframe by how hard it was.
        const impact = this.flight.lastImpact;
        let dmg = 0;
        if (impact && impact.severity > 0) {
          dmg = impactDamage(impact.severity);
          this.damage.add(dmg, 'landing');
          this.landBounceT = Math.min(0.5, impact.severity * 0.5);
        }
        // Precision landing: a centred, gentle touchdown on the strip
        // pays, and the grade shows on the end screen.
        if (event === 'landed-runway') {
          const land = landingScore(impact, this.flight.pos.x);
          this.lastLanding = land;
          if (land.points > 0) {
            this.score += land.points;
            this.hud.message(`TOUCHDOWN ${land.grade} · +${land.points}`, 2.5);
          }
        }
        this.effects.dust(this.flight.pos, impact ? 8 + Math.round(impact.severity * 10) : 8);
        this.sound.thud(0.6 + (impact ? impact.severity * 0.8 : 0));
        if (this.damage.wrecked) {
          this.effects.debris(this.flight.pos, 18);
          this.sound.crash();
          this.showCrashed('damage');
        } else if (this.fuel.empty && event === 'landed-field') {
          // Stranded away from the runway with a dry tank: the run is over.
          this.showCrashed('fuel');
        } else if (this._missionDoneOnLanding()) {
          this._finishMission();
        } else {
          this.hud.message('LANDED — HOLD SHIFT AND PULL UP TO TAKE OFF AGAIN', 2.5);
        }
      } else if (event === 'crashed') {
        this.effects.debris(this.flight.pos, 18);
        this.sound.crash();
        this.showCrashed('impact');
      }

      // Terrain scrape: the ground ahead is rising into the flight path.
      if (this.flight.scraping) {
        this.scrapeAcc += dt;
        this.damage.add(6 * dt, 'scrape');
        const belly = this._tmp.copy(this.flight.pos).add(new THREE.Vector3(0, -1, 0));
        this.effects.sparks(belly, 2);
        if (this.damage.wrecked) {
          this.effects.debris(this.flight.pos, 18);
          this.sound.crash();
          this.showCrashed('damage');
        }
      }

      // Rings, in order — only the Ring Run flies them. A streak kept alive
      // multiplies the points: the second ring in a row is worth 200, the
      // third 300, and so on.
      if (this.missions.current === 'ring') {
        const passed = this.rings.checkPass(this.flight.pos);
        if (passed) {
          this.combo = this.elapsed - this.lastRingTime < COMBO_WINDOW ? this.combo + 1 : 1;
          this.lastRingTime = this.elapsed;
          const pts = 100 * this.combo;
          this.score += pts;
          this.sound.chime();
          if (this.rings.done) {
            this.missions.phase = 'done';
            this.hud.message('FINAL RING — LAND ON THE RUNWAY', 3);
            this.hud.hint('ALL RINGS FLOWN — LAND ON THE RUNWAY');
          } else {
            this.hud.message(
              `RING ${passed.index + 1} / 8  ·  +${pts}${this.combo > 1 ? `  ·  COMBO ×${this.combo}` : ''}`,
              1.6
            );
          }
        }
        if (this.combo > 1 && this.elapsed - this.lastRingTime > COMBO_WINDOW) this.combo = 1;
      }
    }

    // Hints while flying.
    if (this.state === 'flying') {
      if (!this.hasTakenOff && this.flight.grounded) {
        this.hud.hint('HOLD SHIFT FOR THROTTLE · PULL UP (W) TO TAKE OFF');
      } else if (this.flight.grounded) {
        this.hud.hint('ON THE GROUND — HOLD SHIFT AND PULL UP TO TAKE OFF AGAIN');
      } else {
        this.hud.hint(this.missions.objectiveText());
      }
    }

    // A damaged engine trails smoke; the worse it is, the thicker it gets.
    const smokeLevel = this.damage.smokeLevel;
    if (smokeLevel > 0 && !this.flight.grounded && this.state === 'flying') {
      this.smokeAcc += dt;
      const interval = smokeLevel === 1 ? 0.14 : 0.07;
      if (this.smokeAcc >= interval) {
        this.smokeAcc = 0;
        const p = this._tmp.copy(this.flight.pos).add(new THREE.Vector3(0, 0.4, 2.5));
        this.effects.smoke(p);
      }
    }

    this.rings.update(dt, this.elapsed);
    this.fuel.update(dt, this.elapsed);
    this.world.update(dt);
    this.landmarks.update(dt, this.elapsed);
    this.effects.update(dt);
    this.sound.update(this.flight.throttle, this.flight.speed, !this.flight.grounded);
    this._syncPlaneVisual(dt);
    this.positionCamera(false);
    this._updateHud();
    input.endFrame();
  }

  // True when the plane has just landed and the current mission is finished.
  _missionDoneOnLanding() {
    if (this.missions.current === 'ring') return this.rings.done;
    if (this.missions.current === 'cargo') return this.missions.phase === 'return';
    if (this.missions.current === 'rescue') return this.missions.phase === 'aboard';
    return false;
  }

  // Score the finished mission and show the complete screen. On a tour
  // leg, the leg is recorded and the run turns around on the runway for
  // the next leg instead of ending.
  _finishMission() {
    const def = this.missions.def;
    const par = def.par;
    this.timeBonus = Math.max(0, Math.round((par - this.elapsed) * 2));
    this.sound.fanfare();
    if (this.campaign.active) {
      this._enterTurnaround(this.score, this.timeBonus, this.elapsed);
      return;
    }
    if (this.missions.current === 'ring') {
      this.showComplete({
        title: 'COURSE COMPLETE ✈',
        sub: 'The mail is delivered and the Courier is home on the runway. Well flown, pilot.',
        time: this.elapsed,
        detailLine: '8 / 8 rings',
        score: this.score,
        bonus: this.timeBonus,
        landingLine: landingLine(this.lastLanding),
      });
    } else if (this.missions.current === 'cargo') {
      this.showComplete({
        title: 'CARGO DELIVERED ✈',
        sub: 'The crate is on the ground and the Courier is home. A clean drop, pilot.',
        time: this.elapsed,
        detailLine: `DROP: ${Math.round(this.cargo.landedDist)} m from centre · +${this.cargo.accuracyScore}`,
        score: this.score,
        bonus: this.timeBonus,
        landingLine: landingLine(this.lastLanding),
      });
    } else {
      this.showComplete({
        title: 'RESCUE COMPLETE ✈',
        sub: 'The hiker is safe on the runway and the Courier brought them home. Well flown, pilot.',
        time: this.elapsed,
        detailLine: 'HIKER SAFE · RIDGE PICKUP',
        score: this.score,
        bonus: this.timeBonus,
        landingLine: landingLine(this.lastLanding),
      });
    }
  }

  _syncPlaneVisual(dt) {
    const f = this.flight;
    this.plane.group.position.copy(f.pos);
    // A firm touchdown bounces the airframe a little, visually.
    if (this.landBounceT > 0) {
      this.landBounceT = Math.max(0, this.landBounceT - dt);
      this.plane.group.position.y += Math.sin((this.landBounceT / 0.5) * Math.PI) * 0.9;
    }
    this.plane.group.rotation.set(f.pitch, f.yaw, -f.roll, 'YXZ');
    const spin = (f.grounded && f.throttle < 0.05) || f.engineOut ? 0 : 10 + f.throttle * 60;
    this._propSpin = spin;
    // In the cockpit the plane itself is hidden — the fuselage would
    // block the windscreen — and the cockpit cowl frames the view instead.
    this.plane.group.visible = !this.cockpit.enabled;
    this.plane.animate(dt, spin, f.roll, f.pitch);
  }

  _updateHud() {
    const f = this.flight;
    const next = this.missions.current === 'ring' ? this.rings.next : null;
    // The HUD arrow points at whatever the pilot is chasing: the next ring,
    // the drop zone, or the rescue beacon.
    let target = null;
    let targetDist = 0;
    if (next) {
      target = next.pos;
      targetDist = this.rings.nextDistance(f.pos);
    } else if (this.missions.current === 'cargo' && this.missions.phase === 'go') {
      target = new THREE.Vector3(140, 0, -180);
      targetDist = Math.hypot(f.pos.x - 140, f.pos.z + 180);
    } else if (this.missions.current === 'rescue' && this.missions.phase === 'go') {
      target = new THREE.Vector3(HELIPAD.x, 0, HELIPAD.z);
      targetDist = Math.hypot(f.pos.x - HELIPAD.x, f.pos.z - HELIPAD.z);
    }
    this.hud.update({
      altFt: f.altitudeFt(),
      speedKts: f.speedKts(),
      headingDeg: f.headingDeg(),
      throttle: f.throttle,
      score: this.score,
      ringsFlown: this.rings.items.length - this.rings.remaining,
      ringsTotal: this.rings.items.length,
      ringsText: this._ringsText(),
      timeSec: this.elapsed,
      pitch: f.pitch,
      roll: f.roll,
      ringPos: target,
      ringDist: targetDist,
      flying: !f.grounded,
      grounded: f.grounded,
      fuel: this.fuel.level,
      damage: this.damage.level,
      windToDeg: this.weather.toDeg,
      windKts: this.weather.speedKts,
      combo: this.combo,
      missionName: this.campaign.active
        ? `FLY THE TOUR — ${this.campaign.legLabel} · ${this.missions.name}`
        : this.missions.name,
      objective: this.missions.objectiveText(),
      showDrop: this.missions.current === 'cargo' && this.missions.phase === 'go',
    });
    // The cockpit instruments read the same flight state, live.
    this.cockpit.update(this._dt || 0, {
      pitch: f.pitch,
      roll: f.roll,
      altFt: f.altitudeFt(),
      speedKts: f.speedKts(),
      headingDeg: f.headingDeg(),
      fuel: this.fuel.level,
      damage: this.damage.level,
      throttle: f.throttle,
      propSpin: this._propSpin,
    });
  }

  // The small RINGS readout on the HUD is mission-aware: a ring count for
  // the Ring Run, the drop state for Cargo, the pickup state for Rescue.
  _ringsText() {
    if (this.missions.current === 'ring') {
      return `${this.rings.items.length - this.rings.remaining}/${this.rings.items.length}`;
    }
    if (this.missions.current === 'cargo') {
      if (this.missions.phase === 'return') return `DROP +${this.cargo.accuracyScore}`;
      if (this.missions.phase === 'dropped') return 'CRATE FALLING';
      return 'CARRYING CRATE';
    }
    if (this.missions.current === 'rescue') {
      return this.missions.phase === 'aboard' ? 'HIKER ABOARD' : 'FIND BEACON';
    }
    return '';
  }
}

// Boot when the page loads.
const game = new Game();
window.__game = game;
// Test hook: the ground height at (x, z), so the tests can place the plane
// precisely (for example just above the rescue helipad).
window.__terrainHeight = terrainHeight;
game.run();
