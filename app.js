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
        this.heliPos = new THREE.Vector3(0, 2, -2);
        this.heliVel = new THREE.Vector3(0, 0, 0);

        // Steuerungseingaben (aktualisiert durch VR-Controller)
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
                this.bell.rotation.y = Math.PI; // Modell um 180° drehen, damit Nase nach -Z zeigt
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
        this.handelControllerInput();
        const dt = this.clock.getDelta();

        if (this.bell) {
            const maxTilt = Math.PI / 6;
            const maxYawRate = 1.5;
            const maxThrottle = 20.0;

            const q = this.bell.quaternion.clone();
            const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch * maxTilt);
            const qRoll  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.roll * maxTilt);
            const qYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw * maxYawRate * dt);

            const qSteering = new THREE.Quaternion().multiply(qYaw).multiply(q);
            qSteering.multiply(qPitch).multiply(qRoll);

            this.bell.quaternion.copy(qSteering);

            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.bell.quaternion);
            const lift = up.clone().multiplyScalar(this.throttle * maxThrottle);
            const gravity = new THREE.Vector3(0, this.gravity, 0);

            const acc = new THREE.Vector3().add(lift).add(gravity);
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

    handelControllerInput() {
        const session = this.renderer.xr.getSession();
        if (session) {
            const inputSources = session.inputSources;
            for (const inputSource of inputSources) {
                if (inputSource.gamepad) {
                    const axes = inputSource.gamepad.axes;

                    if (inputSource.handedness === 'left') {
                        this.throttle = (-axes[3] + 1) / 2;
                        this.yaw = axes[2];
                    }

                    if (inputSource.handedness === 'right') {
                        this.pitch = -axes[3];
                        this.roll = axes[2];
                    }
                }
            }
        }
    }
}

export { App };
