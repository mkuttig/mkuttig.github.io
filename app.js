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
        this.heliQuat = new THREE.Quaternion();
        this.angularVel = new THREE.Vector3();

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

        this.menuVisible = true;
        this.create3DMenu();

        new OrbitControls(this.camera, this.renderer.domElement);
        this.setupVR();

    }

    create3DMenu() {
        const menuWidth = 64;
        const menuHeight = 64;

        // 2D-Canvas für Menüinhalte
        this.menuCanvas = document.createElement('canvas');
        this.menuCanvas.width = menuWidth;
        this.menuCanvas.height = menuHeight;
        this.menuContext = this.menuCanvas.getContext('2d');

        // 2D-Inhalt initialisieren
        this.updateMenuCanvas();

        // Canvas als Textur verwenden
        const menuTexture = new THREE.CanvasTexture(this.menuCanvas);
        const menuMaterial = new THREE.MeshBasicMaterial({ map: menuTexture, side: THREE.DoubleSide });
        const menuGeometry = new THREE.PlaneGeometry(1.0, 0.5);
        this.menuMesh = new THREE.Mesh(menuGeometry, menuMaterial);

        // Position direkt vor der Kamera oder Heli
        this.menuMesh.position.set(0, 1.6, -5); // z. B. 2 m vor dem Spieler
        this.menuMesh.rotation.y = 0;
        this.menuMesh.visible = true;

        // Füge Menü der Szene hinzu
        this.scene.add(this.menuMesh);

        // Zustand merken
        this.menuVisible = true;
    }


    updateMenuCanvas() {
        const ctx = this.menuContext;
        const width = this.menuCanvas.width;
        const height = this.menuCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Hintergrund
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);

        // Titel
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('Heli Menü', 30, 50);

        // Optionen
        ctx.font = '24px sans-serif';
        ctx.fillText('• Start', 30, 100);
        ctx.fillText('• Landen', 30, 140);
        ctx.fillText('• Reset', 30, 180);

        // Textur aktualisieren
        if (this.menuMesh && this.menuMesh.material.map) {
            this.menuMesh.material.map.needsUpdate = true;
        }
    }




    setEnvironment() {
        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight();
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

        this.room = new THREE.LineSegments(
            new BoxLineGeometry(40, 20, 40, 20, 20, 20),
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

    setMenuVisible(visible) {
        this.menuVisible = visible;
        this.menuMesh.visible = visible;

        if (visible) {
            // Menü vor der Kamera positionieren
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            camDir.normalize();

            const offset = camDir.multiplyScalar(2.0);
            const menuPos = this.camera.position.clone().add(offset);
            this.menuMesh.position.copy(menuPos);

            // Zum Benutzer ausrichten
            this.menuMesh.lookAt(this.camera.position);
            this.updateMenuCanvas();
        }
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

        if (this.menuVisible && this.menuMesh) {
            this.menuMesh.visible = true;
            this.updateMenuCanvas();
        }


        
        if (this.bell) {
            const maxAngularRate = Math.PI; // rad/s
            const maxThrottle = 20.0;

            // Ziel-Rotationsgeschwindigkeit aus Steuerung
            const targetAngularVel = new THREE.Vector3(
                this.pitch * maxAngularRate,
                this.yaw * maxAngularRate,
                -this.roll * maxAngularRate
            );

            // Glätten der Rotationsgeschwindigkeit
            const smoothing = 5.0;
            this.angularVel.lerp(targetAngularVel, smoothing * dt);

            // Quaternion berechnen
            const deltaQuat = new THREE.Quaternion();
            const axis = this.angularVel.clone().normalize();
            const angle = this.angularVel.length() * dt;
            if (angle > 0.0001) {
                deltaQuat.setFromAxisAngle(axis, angle);
                this.heliQuat.multiply(deltaQuat);
            }

            this.heliQuat.normalize();
            this.bell.quaternion.copy(this.heliQuat);

            // Auftrieb entlang "oben"-Achse des Helikopters
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.heliQuat);
            const lift = up.multiplyScalar(this.throttle * maxThrottle);

            // Stabiler Anteil entlang Welt-Y-Achse (simuliert Collective)
            const verticalLift = new THREE.Vector3(0, this.throttle * maxThrottle * 0.3, 0);

            const gravity = new THREE.Vector3(0, this.gravity, 0);
            const acc = lift.add(verticalLift).add(gravity);

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
                    const buttons = inputSource.gamepad.buttons;

                    // Reduzierte Stick-Empfindlichkeit
                    const scale = 0.4;

                    if (inputSource.handedness === 'left') {
                        this.throttle = -axes[3]; //(-axes[3] + 1) / 2;
                        this.yaw = -axes[2] * scale;

                        // Menü-Taste: meist Button[3] oder Button[4]
                        const menuButtonIndex = 3;
                        const pressed = buttons[menuButtonIndex]?.pressed;
                        const prevPressed = this.prevButtonState[inputSource.handedness] || false;
                        
                        if (pressed && !prevPressed) {
                            this.setMenuVisible(!this.menuVisible); // toggle
                        }
                        this.prevButtonState[inputSource.handedness] = pressed;
                    }

                    if (inputSource.handedness === 'right') {
                        this.pitch = -axes[3] * scale;
                        this.roll = -axes[2] * scale;
                    }
                }
            }
        }
    }
}

export { App };
