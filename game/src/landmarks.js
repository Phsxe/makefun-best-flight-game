// Dawn Courier — the valley's landmarks.
// A lighthouse on the lake, a bridge over the river, a dam, a town with lit
// windows and a summit cairn, so the valley reads as a place, not a height
// map. Everything sits on terrainHeight, so the mesh and the physics agree,
// and everything keeps the dawn low-poly style.

import * as THREE from 'three';
import { terrainHeight, RIVER_X, LAKE, HELIPAD } from './world.js';
import { mulberry32 } from './random.js';

export const LIGHTHOUSE = { x: -40, z: -548 };
export const BRIDGE_Z = -100;
export const DAM_Z = -700;
// The summit cairn stands on the high west ridge.
export const SUMMIT = { x: -520, z: -650 };

export class Landmarks {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.seed = seed;
    this.beacon = null; // the lighthouse beam, which turns
    this.beaconLight = null;
    this.flag = null; // the summit flag, which waves
    this.rescueBeacon = null; // the hiker's flashing beacon on the helipad
    this.rescueLight = null;
    this._buildLighthouse();
    this._buildBridge();
    this._buildDam();
    this._buildTown();
    this._buildSummit();
    this._buildRescueBeacon();
  }

  // The rescue beacon: a flashing orange light and a smoke column on the
  // helipad, so the stranded hiker reads from across the valley. Only shown
  // during the Mountain Rescue mission.
  _buildRescueBeacon() {
    const g = new THREE.Group();
    const y = terrainHeight(HELIPAD.x, HELIPAD.z);
    // A small windbreak of stones and the hiker's pack.
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + i * 0.25, 0), rockMat);
      rock.position.set(-4 + i * 2.2, 0.5, 3);
      g.add(rock);
    }
    // The beacon pole and its flashing lamp.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 4.5, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    pole.position.set(0, 2.25, 0);
    g.add(pole);
    this.rescueLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff7a2a })
    );
    this.rescueLight.position.set(0, 4.9, 0);
    g.add(this.rescueLight);
    // A smoke column rising from the beacon, so it reads from far away.
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xdddddd, transparent: true, opacity: 0.35, depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + i * 0.9, 8, 6), smokeMat);
      puff.position.set((i % 2) * 1.2 - 0.6, 7 + i * 5, (i % 3) * 0.8 - 0.8);
      puff.scale.y = 0.8;
      g.add(puff);
    }
    // A painted H on the pad, marking the landing spot.
    const hMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85 });
    for (const [hx, hz, w, d] of [[-3.4, 0, 1.6, 9], [3.4, 0, 1.6, 9], [0, 0, 5.2, 1.6]]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, d), hMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(hx, 0.35, hz);
      g.add(bar);
    }
    g.position.set(HELIPAD.x, y, HELIPAD.z);
    g.visible = false;
    this.rescueBeacon = g;
    this.scene.add(g);
  }

  setRescueBeaconVisible(v) {
    if (this.rescueBeacon) this.rescueBeacon.visible = v;
  }

  // --- the lighthouse ------------------------------------------------------

  _buildLighthouse() {
    const g = new THREE.Group();
    const y = terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z);
    // A striped tower: white bands and red bands, stacked.
    const bandCols = [0xf2ead8, 0xc23b2e, 0xf2ead8, 0xc23b2e, 0xf2ead8];
    const segH = 4.4;
    bandCols.forEach((col, i) => {
      const r = 3.1 - i * 0.28;
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 0.28, segH, 10),
        new THREE.MeshLambertMaterial({ color: col, flatShading: true })
      );
      band.position.y = segH / 2 + i * segH;
      g.add(band);
    });
    // The lamp room and its cap.
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 2.6, 8),
      new THREE.MeshLambertMaterial({ color: 0x33302e })
    );
    lamp.position.y = bandCols.length * segH + 1.3;
    g.add(lamp);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    bulb.position.y = bandCols.length * segH + 1.3;
    g.add(bulb);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x33302e, flatShading: true })
    );
    cap.position.y = bandCols.length * segH + 3.6;
    g.add(cap);
    // The beam: a long pale cone that turns around the tower.
    this.beacon = new THREE.Group();
    const beamGeo = new THREE.ConeGeometry(3.2, 90, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe9a8,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.x = 45;
    this.beacon.add(beam);
    const beam2 = beam.clone();
    beam2.rotation.y = Math.PI;
    this.beacon.add(beam2);
    this.beacon.position.y = bandCols.length * segH + 1.3;
    g.add(this.beacon);
    // A small jetty of rocks at the water's edge.
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + i * 0.4, 0), rockMat);
      rock.position.set(-6 + i * 3.2, 0.6, 4 + (i % 2) * 2);
      g.add(rock);
    }
    g.position.set(LIGHTHOUSE.x, y, LIGHTHOUSE.z);
    this.scene.add(g);
  }

  // --- the bridge ----------------------------------------------------------

  _buildBridge() {
    const g = new THREE.Group();
    const deckY = 4.5;
    // The deck: a long slab across the river, with railings.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(72, 1.2, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a7a6a, flatShading: true })
    );
    deck.position.y = deckY;
    g.add(deck);
    const railMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    for (const z of [-3.2, 3.2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(72, 1.1, 0.4), railMat);
      rail.position.set(0, deckY + 1.1, z);
      g.add(rail);
    }
    // Two stone arches holding it up, one each side of the river.
    const archMat = new THREE.MeshLambertMaterial({ color: 0x7a6a5a, flatShading: true });
    for (const x of [-24, 24]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(4, deckY + 2, 6), archMat);
      pier.position.set(x, (deckY + 2) / 2 - 1, 0);
      g.add(pier);
    }
    // A lamp on each end, lit at dawn.
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (const x of [-34, 34]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), lampMat);
      lamp.position.set(x, deckY + 2.4, -3.2);
      g.add(lamp);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 1.8, 5),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
      );
      post.position.set(x, deckY + 1.5, -3.2);
      g.add(post);
    }
    const y = terrainHeight(RIVER_X, BRIDGE_Z);
    g.position.set(RIVER_X, y, BRIDGE_Z);
    this.scene.add(g);
  }

  // --- the dam -------------------------------------------------------------

  _buildDam() {
    const g = new THREE.Group();
    // A curved concrete wall across the river valley.
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(130, 130, 16, 24, 1, true, -0.55, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x9a9a92, flatShading: true, side: THREE.DoubleSide })
    );
    wall.position.y = 8;
    g.add(wall);
    // The crest walkway along the top.
    const crest = new THREE.Mesh(
      new THREE.CylinderGeometry(130, 130, 1.2, 24, 1, true, -0.55, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x7a7a72, side: THREE.DoubleSide })
    );
    crest.position.y = 16.4;
    g.add(crest);
    // A spillway notch: a darker gap in the middle of the wall.
    const spill = new THREE.Mesh(
      new THREE.BoxGeometry(14, 6, 2),
      new THREE.MeshLambertMaterial({ color: 0x4a86c8 })
    );
    spill.position.set(0, 13, -128);
    g.add(spill);
    // The still water held back behind the dam.
    const back = new THREE.Mesh(
      new THREE.CircleGeometry(60, 20),
      new THREE.MeshLambertMaterial({ color: 0x4a86c8, transparent: true, opacity: 0.85 })
    );
    back.rotation.x = -Math.PI / 2;
    back.position.set(0, 14.5, -40);
    g.add(back);
    const y = terrainHeight(RIVER_X, DAM_Z);
    g.position.set(RIVER_X, y, DAM_Z);
    g.rotation.y = Math.PI;
    this.scene.add(g);
  }

  // --- the town ------------------------------------------------------------

  _buildTown() {
    const g = new THREE.Group();
    const rand = mulberry32(this.seed * 41 + 7);
    const wallCols = [0xd8c49a, 0xcbb89a, 0xb8a888, 0xd8b89a];
    const roofCols = [0x9a4a3a, 0x7a3a2e, 0x6a4a3a];
    // Six more houses around the village, each with windows lit warm.
    const spots = [
      [-96, 352, 0.2], [-108, 396, 1.1], [-84, 428, -0.5],
      [-120, 350, 0.8], [-70, 404, 2.0], [-112, 436, 0.4],
    ];
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    spots.forEach(([x, z, rot], i) => {
      const y = terrainHeight(x, z);
      const house = new THREE.Group();
      const w = 8 + rand() * 3;
      const d = 7 + rand() * 2;
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(w, 5.5, d),
        new THREE.MeshLambertMaterial({ color: wallCols[i % wallCols.length] })
      );
      walls.position.y = 2.75;
      house.add(walls);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.8, 4),
        new THREE.MeshLambertMaterial({ color: roofCols[i % roofCols.length], flatShading: true })
      );
      roof.position.y = 7.4;
      roof.rotation.y = Math.PI / 4;
      house.add(roof);
      // Two lit windows on the front wall, glowing at dawn.
      for (const wx of [-w / 4, w / 4]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.8), winMat);
        win.position.set(wx, 3.0, d / 2 + 0.06);
        house.add(win);
      }
      house.position.set(x, y, z);
      house.rotation.y = rot;
      g.add(house);
    });
    this.scene.add(g);
  }

  // --- the summit ----------------------------------------------------------

  _buildSummit() {
    const g = new THREE.Group();
    const y = terrainHeight(SUMMIT.x, SUMMIT.z);
    // A cairn of stacked stones on the highest ridge.
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a, flatShading: true });
    const sizes = [2.6, 2.0, 1.5, 1.0];
    let cy = 0;
    sizes.forEach((s, i) => {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      stone.position.y = cy + s * 0.7;
      stone.rotation.y = i * 0.8;
      cy += s * 1.1;
      g.add(stone);
    });
    // A flag on a pole, so the summit reads from the air.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    pole.position.y = cy + 2.5;
    g.add(pole);
    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xff7a2a, side: THREE.DoubleSide })
    );
    this.flag.position.set(1.2, cy + 4.2, 0);
    g.add(this.flag);
    g.position.set(SUMMIT.x, y, SUMMIT.z);
    this.scene.add(g);
  }

  // The lighthouse beam turns; the summit flag waves; the rescue beacon
  // flashes; the town windows flicker almost imperceptibly.
  update(dt, time) {
    if (this.beacon) this.beacon.rotation.y = time * 0.35;
    if (this.flag) this.flag.rotation.y = Math.sin(time * 1.8) * 0.35;
    if (this.rescueLight) {
      const on = Math.sin(time * 4) > 0;
      this.rescueLight.material.color.setHex(on ? 0xff7a2a : 0x7a3a1a);
      this.rescueLight.scale.setScalar(on ? 1.25 : 1);
    }
  }
}
