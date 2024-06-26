import * as THREE from './libs/three/three.module.js';

import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { BoxLineGeometry } from './libs/three/jsm/BoxLineGeometry.js';

import { VRButton } from './libs/three/jsm/VRButton.js'
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';


class App {

    constructor() {


        this.gravity = -1.0;

        this.heli_x = 0.0;
        this.heli_y = 2.0;
        this.heli_z = -2.0;

        this.joy1_x = 0.0;
        this.joy1_y = 0.0;
        this.joy2_x = 0.0;
        this.joy2_y = 0.0;

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

        const controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.setupVR();

        this.renderer.setAnimationLoop(this.render.bind(this));

        window.addEventListener('resize', this.resize.bind(this));

    }

    setEnvironment() {
        //const rgb_loader = new RGBELoader().setDataType( THREE.UnsignedByteType ); 

        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight();
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

        this.room = new THREE.LineSegments(new BoxLineGeometry(20, 20, 20, 20, 20, 20),
            new THREE.LineBasicMaterial({ color: 0x202020 }));
        this.room.position.set(0, 10, 0);
        this.scene.add(this.room);

        const self = this;
        const loader = new GLTFLoader().setPath('./assets/');
        loader.load('bell.glb',
            function (gltf) {
                self.bell = gltf.scene;
                self.bell.scale.set(0.1, 0.1, 0.1);
                self.scene.add(self.bell);
            },
            function (xhr) { },
            function (err) {
                console.log('Error loading bell.glb');
                console.log(err);
            });

        // Initiale Werte
        let position = new THREE.Vector3(0, 0, 0); // Aktuelle Position des Hubschraubers
        let orientation = new THREE.Vector3(0, 1, 0); // Aktuelle Ausrichtung des Hubschraubers
        const pitchVector = new THREE.Vector3(0, 1, 0.5); // Richtung der Auftriebskraft
        const liftStrength = 10.0; // Stärke der Auftriebskraft
        const tailDeflection = 0.1; // Heckauslenkung
        const deltaTime = 0.1; // Zeitschritt

    }

    setupVR() {
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));
        this.controllers = this.buildControllers();
    }

    buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
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
        
        // Heli physics
        const dt = this.clock.getDelta();

        // this.heli_x =  this.joy2_x;
        // this.heli_z =  this.joy2_y;
        // this.heli_y = -this.joy1_y;
        
        this.pitchVector.setX(this.joy2_x);
        this.pitchVector.setZ(this.joy2_z);
        this.pitchVector.setY(this.joy1_y);
        const result = simulateHelicopter(this.bell.position, this.orientation, this.pitchVector, this.liftStrength, this.tailDeflection, dt);
        
        // Update Three.js Objektausrichtung
        this.bell.rotation.z += this.tailDeflection * dt;
        
        //this.heli_y = this.heli_y + this.gravity * dt + (-this.joy1_y);
        if (result.position.y < 0.55) result.position.y = 0.55;

        // Heli position update
        if (this.bell) {
            this.bell.position.set(result.position.x, result.position.y, result.heli_z);
        }


        this.renderer.render(this.scene, this.camera);
    }

    simulateHelicopter(position, orientation, pitchVector, liftStrength, tailDeflection, deltaTime) {
        
        const gravity = 9.81; // Gewichtskraft in negativer Z-Richtung
        const gravityForce = new THREE.Vector3(0, -gravity, 0);

        // Berechne die resultierende Auftriebskraft basierend auf dem Pitch-Vektor und der Stärke
        const liftForce = pitchVector.clone().multiplyScalar(liftStrength);

        // Addiere die Gewichtskraft zur resultierenden Auftriebskraft
        const totalForce = liftForce.add(gravityForce);

        // Aktualisiere die Position basierend auf der resultierenden Kraft
        position.add(totalForce.multiplyScalar(deltaTime));

        // Aktualisiere die Ausrichtung basierend auf der Heckauslenkung
        orientation = rotateAroundZ(orientation, tailDeflection * deltaTime);

        return { position, orientation };
    
    }


    rotateAroundZ(v, angle) {

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        
        return new THREE.Vector3(v.x * cosA - v.y * sinA,
                                 v.x * sinA + v.y * cosA,
                                 v.z);
    
    }


    handelControllerInput() {
        const session = this.renderer.xr.getSession();
        if (session) {
            const inputSources = session.inputSources;
            for (const inputSource of inputSources) {
                if (inputSource.gamepad) {
                    if (inputSource.handedness == 'left') {
                        this.joy1_x = inputSource.gamepad.axes[2] * 0.005;
                        this.joy1_y = inputSource.gamepad.axes[3] * 0.005;
                    }
                    if (inputSource.handedness == 'right') {
                        this.joy2_x = inputSource.gamepad.axes[2] * 0.005;
                        this.joy2_y = inputSource.gamepad.axes[3] * 0.005;
                    }
                }
            }
        }
    }
}

export { App };
