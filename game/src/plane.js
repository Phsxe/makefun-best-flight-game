// Dawn Courier — the aircraft.
// A small single-prop courier plane built only from Three.js primitives:
// a rounded fuselage, a red wing, a tail, a glass canopy and a spinning
// propeller. It is a Group the flight model moves; the propeller and the
// control surfaces are kept as named children so the loop can animate them.

import * as THREE from 'three';

export class Plane {
  constructor() {
    this.group = new THREE.Group();
    this.propeller = null;
    this.aileronL = null;
    this.aileronR = null;
    this.elevator = null;
    this.rudder = null;
    this._build();
  }

  _build() {
    const cream = new THREE.MeshLambertMaterial({ color: 0xf2e6c8, flatShading: true });
    const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e, flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: 0x33302e, flatShading: true });
    const glass = new THREE.MeshLambertMaterial({
      color: 0x9ecfe8,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });

    // Fuselage: a tapered body, nose forward (-z is forward for the model).
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 10), cream);
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.2;
    this.group.add(body);
    // Nose cone.
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 10), red);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -3.4;
    this.group.add(nose);
    // Tail cone tapering to the back.
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 8), cream);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = 3.9;
    this.group.add(tail);

    // Main wing: one long red slab through the fuselage.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.22, 1.9), red);
    wing.position.set(0, 0.05, -0.4);
    this.group.add(wing);
    // Wing tips, slightly darker, for the low-poly read.
    for (const x of [-4.55, 4.55]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.9), dark);
      tip.position.set(x, 0.05, -0.4);
      this.group.add(tip);
    }
    // Ailerons on the trailing edge, so the roll reads in the air.
    const ailGeo = new THREE.BoxGeometry(2.6, 0.12, 0.55);
    this.aileronL = new THREE.Mesh(ailGeo, cream);
    this.aileronL.position.set(-3.1, 0.05, 0.62);
    this.group.add(this.aileronL);
    this.aileronR = new THREE.Mesh(ailGeo, cream);
    this.aileronR.position.set(3.1, 0.05, 0.62);
    this.group.add(this.aileronR);

    // Tailplane and fin.
    const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.1), red);
    tailplane.position.set(0, 0.25, 4.4);
    this.group.add(tailplane);
    this.elevator = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.45), cream);
    this.elevator.position.set(0, 0.25, 5.1);
    this.group.add(this.elevator);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.3), red);
    fin.position.set(0, 1.0, 4.4);
    this.group.add(fin);
    this.rudder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.6), cream);
    this.rudder.position.set(0, 1.0, 5.2);
    this.group.add(this.rudder);

    // Canopy: a glass half-dome over the cockpit.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      glass
    );
    canopy.scale.set(1, 0.85, 1.5);
    canopy.position.set(0, 0.55, -0.9);
    this.group.add(canopy);

    // Fixed landing gear: two wheels and a tail wheel.
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    for (const x of [-1.15, 1.15]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), dark);
      strut.position.set(x, -0.9, -0.6);
      this.group.add(strut);
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -1.35, -0.6);
      this.group.add(wheel);
    }
    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 8), dark);
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, -0.75, 4.3);
    this.group.add(tailWheel);

    // Propeller: a hub and two blades, spinning around the nose axis.
    this.propeller = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
    hub.rotation.x = Math.PI / 2;
    this.propeller.add(hub);
    const bladeGeo = new THREE.BoxGeometry(0.32, 2.9, 0.12);
    for (const a of [0, Math.PI]) {
      const blade = new THREE.Mesh(bladeGeo, dark);
      blade.rotation.z = a;
      blade.position.y = 0;
      this.propeller.add(blade);
    }
    // A spinner cone over the prop hub, so the nose reads finished.
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), red);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -0.5;
    this.propeller.add(spinner);
    // Offset the blades so they read as a two-blade prop, not a cross.
    this.propeller.children[1].position.y = 0;
    this.propeller.position.set(0, 0, -4.35);
    this.group.add(this.propeller);

    // A small white tail light, so the Courier reads at dawn from behind.
    const tailLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    tailLight.position.set(0, 0.4, 4.9);
    this.group.add(tailLight);

    // A small navigation light on each wingtip, glowing at dawn.
    const navL = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff4444 })
    );
    navL.position.set(-4.7, 0.05, -0.4);
    this.group.add(navL);
    const navR = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x44ff66 })
    );
    navR.position.set(4.7, 0.05, -0.4);
    this.group.add(navR);
  }

  // Animate the propeller and the control surfaces from the flight state.
  // spin: radians per second of prop speed; roll/pitch: -1..1 deflections.
  animate(dt, spin, roll, pitch) {
    if (this.propeller) this.propeller.rotation.z += spin * dt;
    if (this.aileronL) this.aileronL.rotation.x = -roll * 0.45;
    if (this.aileronR) this.aileronR.rotation.x = roll * 0.45;
    if (this.elevator) this.elevator.rotation.x = pitch * 0.4;
    if (this.rudder) this.rudder.rotation.y = -roll * 0.3;
  }
}
