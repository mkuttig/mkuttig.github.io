import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';    
import { BoxLineGeometry } from './libs/three/jsm/BoxLineGeometry.js';
import { VRButton } from './libs/three/jsm/VRButton.js'
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';
import { RGBELoader } from '../../libs/three/jsm/RGBELoader.js';

class App{
	
    constructor(){
		
        const container = document.createElement( 'div' );
		document.body.appendChild( container );
   
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.physicallyCorrectLights = true;
        container.appendChild( this.renderer.domElement );
		this.setEnvironment();

		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
		this.camera.position.set( 0, 0, 0 );
        
		this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xaaaaaa );

		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
		this.scene.add(ambient);
        
        const light = new THREE.DirectionalLight();
        light.position.set( 0.2, 1, 1);
        this.scene.add(light);
/*
        const geometry = new THREE.BoxBufferGeometry();
        const material = new THREE.MeshStandardMaterial( { color: 0xFF0000 });
        this.mesh = new THREE.Mesh( geometry, material );
        this.mesh.position.set( 0, 0, -4);
        this.scene.add(this.mesh);
*/
        this.room = new THREE.LineSegments(new BoxLineGeometry(20,20,20,30,30,30),
                                           new THREE.LineBasicMaterial( {color: 0x202020 }));
        this.room.geometry.translate( 0, 8.4, 0);
        this.scene.add(this.room);

        const self = this;
        const loader = new GLTFLoader().setPath( './assets/');
        loader.load('bell.glb',
                    function(gltf) {
                        self.bell = gltf.scene;
                        self.bell.position.set( 0, 0, 0);
                        self.scene.add(gltf.scene);
                    },
                    function(xhr) {},
                    function(err) {
                        console.log('Error loading bell.glb');
                        console.log(err);
                    } );

        const controls = new OrbitControls( this.camera, this.renderer.domElement );
        
        this.setupVR();

        this.renderer.setAnimationLoop(this.render.bind(this));
   
        window.addEventListener('resize', this.resize.bind(this) );

    }	
    
    setEnvironment(){
        const loader = new RGBELoader().setDataType( THREE.UnsignedByteType );        
    }


	setupVR() {
		this.renderer.xr.enabled = true;
		document.body.appendChild(VRButton.createButton(this.renderer));
        this.controllers = this.buildControllers();
    }

    buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();
        const geometry = new THREE.BufferGeometry().setFromPoints([ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1) ]);
        const controllers = [];

        for (let i=0;i<=1;i++) {

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
        this.renderer.setSize( window.innerWidth, window.innerHeight );  
    }
    
	render( ) {   
        // this.mesh.rotateY( 0.01 );
        this.renderer.render( this.scene, this.camera );
    }
}

export { App };
