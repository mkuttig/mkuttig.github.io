// Importiere benötigte Module
import * as THREE from './libs/three/three.module.js';
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { VRButton } from './libs/three/jsm/VRButton.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App {
    constructor() {
        // Physikalische Parameter
        this.gravity = new THREE.Vector3(0, -9.81, 0); // Erdbeschleunigung
        this.mass = 1.5; // Masse des Hubschraubers in kg
        this.liftStrength = 15.0; // Stärke des Auftriebs
        this.torqueStrength = 0.5; // Stärke des Drehmoments

        // Initiale Zustände
        this.position = new THREE.Vector3(0, 2, -2); // Startposition
        this.velocity = new THREE.Vector3(); // Anfangsgeschwindigkeit
        this.acceleration = new THREE.Vector3(); // Anfangsbeschleunigung

        this.orientation = new THREE.Quaternion(); // Anfangsorientierung
        this.angularVelocity = new THREE.Vector3(); // Anfangsdrehgeschwindigkeit

        // Steuerungseingaben
        this.throttle = 0.0; // Kollektiver Pitch (Auftrieb)
        this.rollInput = 0.0; // Roll-Eingabe
        this.pitchInput = 0.0; // Pitch-Eingabe
        this.yawInput = 0.0; // Yaw-Eingabe

        // Setup der Szene
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.physicallyCorrectLights = true;
        container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 2.0);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xaaaaaa);

        const controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.setEnvironment();

        this.setupVR();

        this.renderer.setAnimationLoop(this.render.bind(this));

        window.addEventListener('resize', this.resize.bind(this));
    }

    setEnvironment() {
        // Beleuchtung
        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight();
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

        // Lade das Hubschraubermodell
        const loader = new GLTFLoader().setPath('./assets/');
        loader.load('bell.glb',
            (gltf) => {
                this.bell = gltf.scene;
                this.bell.scale.set(0.1, 0.1, 0.1);
                this.scene.add(this.bell);
                this.bell.position.copy(this.position);
                this.bell.quaternion.copy(this.orientation);
            },
            undefined,
            (err) => {
                console.error('Fehler beim Laden von bell.glb:', err);
            });
    }

    setupVR() {
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));
        this.controllers = this.buildControllers();
    }

    buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();
        const controllers = [];

        for (let i = 0; i <= 1; i++) {
            const controller = this.renderer.xr.getController(i);
            controllers.push(controller);
            this.scene.add(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            this.scene.add(grip);
        }

        return controllers;
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const dt = this.clock.getDelta();

        this.handleControllerInput();

        // Berechne lokale Achsen basierend auf der aktuellen Orientierung
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.orientation);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.orientation);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.orientation);

        // Berechne Auftriebskraft
        const liftForce = up.clone().multiplyScalar(this.throttle * this.liftStrength);

        // Gesamtkraft = Auftrieb + Gewicht
        const totalForce = new THREE.Vector3().addVectors(liftForce, this.gravity.clone().multiplyScalar(this.mass));

        // Beschleunigung = Kraft / Masse
        this.acceleration.copy(totalForce).divideScalar(this.mass);

        // Aktualisiere Geschwindigkeit und Position
        this.velocity.add(this.acceleration.clone().multiplyScalar(dt));
        this.position.add(this.velocity.clone().multiplyScalar(dt));

        // Berechne Drehmomente basierend auf Eingaben
        const torque = new THREE.Vector3(
            this.rollInput * this.torqueStrength,
            this.yawInput * this.torqueStrength,
            this.pitchInput * this.torqueStrength
        );

        // Aktualisiere Drehgeschwindigkeit
        this.angularVelocity.add(torque.clone().multiplyScalar(dt));

        // Dämpfe die Drehgeschwindigkeit
        this.angularVelocity.multiplyScalar(0.98);

        // Aktualisiere Orientierung basierend auf Drehgeschwindigkeit
        const angularVelocityQuat = new THREE.Quaternion(
            this.angularVelocity.x * dt,
            this.angularVelocity.y * dt,
            this.angularVelocity.z * dt,
            0
        );
        angularVelocityQuat.multiply(this.orientation);
        this.orientation.x += 0.5 * angularVelocityQuat.x;
        this.orientation.y += 0.5 * angularVelocityQuat.y;
        this.orientation.z += 0.5 * angularVelocityQuat.z;
        this.orientation.w += 0.5 * angularVelocityQuat.w;
        this.orientation.normalize();

        // Aktualisiere Position und Orientierung des Modells
        if (this.bell) {
            this.bell.position.copy(this.position);
            this.bell.quaternion.copy(this.orientation);
        }

        this.renderer.render(this.scene, this.camera);
    }

    handleControllerInput() {
        const session = this.renderer.xr.getSession();
        if (session) {
            const inputSources = session.inputSources;
            for (const inputSource of inputSources) {
                if (inputSource.gamepad) {
                    const axes = inputSource.gamepad.axes;
                    if (inputSource.handedness === 'left') {
                        // Linker Controller: Pitch (vor/zurück) und Throttle (hoch/runter)
                        this.pitchInput = -axes[3]; // Achse 3: vor/zurück
                        this.throttle = (1 - axes[1]) / 2; // Achse 1: hoch/runter (0 bis 1)
                    }
                    if (inputSource.handedness === 'right') {
                        // Rechter Controller: Roll (links/rechts) und Yaw (drehen)
                        this.rollInput = axes[2]; // Achse 2: links/rechts
                        this.yawInput = axes[0]; // Achse 0: drehen
                    }
                }
            }
        }
    }
}

export { App };