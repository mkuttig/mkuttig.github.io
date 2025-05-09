// Importiere notwendige Module aus Three.js
import * as THREE from './libs/three/three.module.js';
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { BoxLineGeometry } from './libs/three/jsm/BoxLineGeometry.js';
import { VRButton } from './libs/three/jsm/VRButton.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App {
    constructor() {
        this.gravity = -9.81;

        // Physikalischer Zustand
        this.heliPos = new THREE.Vector3(0, 2, -2);
        this.heliVel = new THREE.Vector3(0, 0, 0);
        this.heliQuat = new THREE.Quaternion(); // Orientierung als Quaternion
        this.angularVel = new THREE.Vector3(0, 0, 0); // Rotationsgeschwindigkeit (rad/s)

        // Eingaben
        this.pitch = 0;
        this.roll = 0;
        this.yaw = 0;
        this.throttle = 0;

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

        this.setEnvironment();
        new OrbitControls(this.camera, this.renderer.domElement);
        this.setupVR();

        this.renderer.setAnimationLoop(this.render.bind(this));
        window.addEventListener('resize', this.resize.bind(this));
    }

    setEnvironment() {
        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight();
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

        this.room = new THREE.LineSegments(
            new BoxLineGeometry(20, 20, 20, 20, 20, 20),
            new THREE.LineBasicMaterial({ color: 0x202020 })
        );
        this.room.position.set(0, 10, 0);
        this.scene.add(this.room);

        const loader = new GLTFLoader().setPath('./assets/');
        loader.load(
            'bell.glb',
            gltf => {
                this.bell = gltf.scene;
                this.bell.scale.set(0.1, 0.1, 0.1);
                this.scene.add(this.bell);
            },
            undefined,
            err => console.error('Fehler beim Laden von bell.glb', err)
        );
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
        this.handleControllerInput();
        const dt = this.clock.getDelta();

        if (this.bell) {
            const maxAngularRate = Math.PI; // rad/s
            const maxThrottle = 20.0;

            // Ziel-Rotationsgeschwindigkeit anhand der Steuerung
            const targetAngularVel = new THREE.Vector3(
                this.pitch * maxAngularRate,
                this.yaw * maxAngularRate,
                -this.roll * maxAngularRate
            );

            // Glätten der Rotationsgeschwindigkeit
            const smoothing = 5.0;
            this.angularVel.lerp(targetAngularVel, smoothing * dt);

            // Delta-Quaternion berechnen
            const deltaQuat = new THREE.Quaternion();
            const axis = this.angularVel.clone().normalize();
            const angle = this.angularVel.length() * dt;
            if (angle > 0.0001) {
                deltaQuat.setFromAxisAngle(axis, angle);
                this.heliQuat.multiply(deltaQuat);
            }

            this.heliQuat.normalize();
            this.bell.quaternion.copy(this.heliQuat);

            // Auftriebsrichtung = "oben" in Körperkoordinaten
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.heliQuat);
            const lift = up.multiplyScalar(this.throttle * maxThrottle);
            const gravity = new THREE.Vector3(0, this.gravity, 0);
            const acc = lift.add(gravity);

            this.heliVel.add(acc.multiplyScalar(dt));
            this.heliVel.multiplyScalar(0.99);
            this.heliPos.add(this.heliVel.clone().multiplyScalar(dt));

            if (this.heliPos.y < 0.5) {
                this.heliPos.y = 0.5;
                this.heliVel.y = 0;
            }

            this.bell.position.copy(this.heliPos);
        }

        this.renderer.render(this.scene, this.camera);
    }

    handleControllerInput() {
        const inputSensitivity = 0.2;

        const session = this.renderer.xr.getSession();
        if (session) {
            const inputSources = session.inputSources;
            for (const inputSource of inputSources) {
                if (inputSource.gamepad) {
                    const axes = inputSource.gamepad.axes;

                    if (inputSource.handedness === 'left') {
                        this.throttle = ((-axes[3] + 1) / 2) * (inputSensitivity*2);
                        this.yaw = axes[2] * inputSensitivity;
                    }

                    if (inputSource.handedness === 'right') {
                        this.pitch = -axes[3] * inputSensitivity;
                        this.roll = axes[2] * inputSensitivity;
                    }
                }
            }
        }
    }
}

export { App };