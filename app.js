// Importiere notwendige Module aus Three.js
import * as THREE from './libs/three/three.module.js';
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { BoxLineGeometry } from './libs/three/jsm/BoxLineGeometry.js';
import { VRButton } from './libs/three/jsm/VRButton.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App {
    constructor() {
        // Gravitationskonstante (m/s²)
        this.gravity = -9.81;

        // Physikalische Zustände des Helikopters
        this.heliPos = new THREE.Vector3(0, 2, -2); // Startposition
        this.heliVel = new THREE.Vector3(0, 0, 0);  // Anfangsgeschwindigkeit
        this.heliRot = new THREE.Euler(0, 0, 0, 'YXZ'); // Ausrichtung (Pitch, Yaw, Roll)

        // Steuerungseingaben (aktualisiert durch VR-Controller)
        this.pitch = 0;    // Nickbewegung (vor/zurück)
        this.roll = 0;     // Rollbewegung (links/rechts)
        this.yaw = 0;      // Gierbewegung (Drehung)
        this.throttle = 0; // Schubkraft (Auftrieb)

        // Erzeuge ein Container-Element für das Canvas
        const container = document.createElement('div');
        document.body.appendChild(container);

        // Initialisiere Zeitsteuerung
        this.clock = new THREE.Clock();

        // WebGL-Renderer vorbereiten
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.physicallyCorrectLights = true;
        container.appendChild(this.renderer.domElement);

        // Kamera konfigurieren (Sichtfeld, Seitenverhältnis, Nah-/Fernbereich)
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 2.0); // Position der Kamera auf Augenhöhe

        // Erstelle Szene und Hintergrundfarbe
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xaaaaaa);

        this.setEnvironment(); // Beleuchtung, Raum, Modell
        new OrbitControls(this.camera, this.renderer.domElement); // Maussteuerung für Debug

        this.setupVR(); // VR aktivieren

        // Haupt-Animations-Loop starten
        this.renderer.setAnimationLoop(this.render.bind(this));

        window.addEventListener('resize', this.resize.bind(this)); // Fensteranpassung
    }

    setEnvironment() {
        // Umgebungslicht (diffuses Licht von oben/unten)
        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
        this.scene.add(ambient);

        // Direktionales Sonnenlicht
        const light = new THREE.DirectionalLight();
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

        // Drahtgitter-Raum zur Orientierung
        this.room = new THREE.LineSegments(
            new BoxLineGeometry(20, 20, 20, 20, 20, 20),
            new THREE.LineBasicMaterial({ color: 0x202020 })
        );
        this.room.position.set(0, 10, 0);
        this.scene.add(this.room);

        // Lade Helikopter-Modell (GLTF)
        const loader = new GLTFLoader().setPath('./assets/');
        loader.load(
            'bell.glb',
            gltf => {
                this.bell = gltf.scene;
                this.bell.scale.set(0.1, 0.1, 0.1); // Skalierung anpassen
                this.scene.add(this.bell);
            },
            undefined,
            err => console.error('Fehler beim Laden von bell.glb', err)
        );
    }

    setupVR() {
        // VR-Modus aktivieren
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));

        // VR-Controller-Modelle hinzufügen
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
        // Kamera- und Renderer-Größe aktualisieren
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        // Eingabe der VR-Controller lesen
        this.handelControllerInput();

        // Zeit seit letztem Frame
        const dt = this.clock.getDelta();

        if (this.bell) {
            // Steuerbereiche definieren
            const maxTilt = Math.PI / 6; // Max. Neigungswinkel (±30°)
            const maxYawRate = 1.5;      // Max. Drehgeschwindigkeit (rad/s)
            const maxThrottle = 20.0;    // Max. Auftriebskraft

            // Euler-Winkel aus Steuerung berechnen
            this.heliRot.x = this.pitch * maxTilt;
            this.heliRot.z = -this.roll * maxTilt;
            this.heliRot.y += this.yaw * maxYawRate * dt;

            // Rotation am Modell anwenden
            this.bell.rotation.copy(this.heliRot);

            // Richtungsvektoren relativ zum Modell
            const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.heliRot);
            const right = new THREE.Vector3(1, 0, 0).applyEuler(this.heliRot);
            const up = new THREE.Vector3(0, 1, 0).applyEuler(this.heliRot);

            // Auftriebskraft entlang "oben"-Vektor des Modells
            const lift = up.clone().multiplyScalar(this.throttle * maxThrottle);

            // Gewichtskraft nach unten
            const gravity = new THREE.Vector3(0, this.gravity, 0);

            // Gesamtkraft = Auftrieb + Gravitation
            const acc = new THREE.Vector3().add(lift).add(gravity);

            // Geschwindigkeit mit Beschleunigung integrieren
            this.heliVel.add(acc.multiplyScalar(dt));

            // Luftwiderstand (einfache Dämpfung)
            this.heliVel.multiplyScalar(0.99);

            // Position mit Geschwindigkeit integrieren
            this.heliPos.add(this.heliVel.clone().multiplyScalar(dt));

            // Auf Bodenhöhe stoppen
            if (this.heliPos.y < 0.5) {
                this.heliPos.y = 0.5;
                this.heliVel.y = 0;
            }

            // Aktuelle Position ans Modell übergeben
            this.bell.position.copy(this.heliPos);
        }

        // Szene rendern
        this.renderer.render(this.scene, this.camera);
    }

    handelControllerInput() {
        // Gamepad-Achsen der VR-Controller auslesen (Mode 2)
        const session = this.renderer.xr.getSession();
        if (session) {
            const inputSources = session.inputSources;
            for (const inputSource of inputSources) {
                if (inputSource.gamepad) {
                    const axes = inputSource.gamepad.axes;

                    // Linker Stick → Throttle & Yaw (Mode 2)
                    if (inputSource.handedness === 'left') {
                        this.throttle = (-axes[3] + 1) / 2; // von 0 (unten) bis 1 (oben)
                        this.yaw = axes[2];                // Drehen links/rechts
                    }

                    // Rechter Stick → Pitch & Roll
                    if (inputSource.handedness === 'right') {
                        this.pitch = -axes[3]; // Nick vor/zurück
                        this.roll = axes[2];   // Rollen links/rechts
                    }
                }
            }
        }
    }
}

export { App };