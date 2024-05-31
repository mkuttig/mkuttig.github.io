import * as THREE from './libs/three/three.module.js';
import { VRButton } from './libs/three/jsm/VRButton.js'
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App{
	
    constructor(){
		
        const container = document.createElement( 'div' );
		document.body.appendChild( container );
        
		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
		this.camera.position.set( 0, 0, 0 );
        
		this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xaaaaaa );

		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
		this.scene.add(ambient);
        
        const light = new THREE.DirectionalLight();
        light.position.set( 0.2, 1, 1);
        this.scene.add(light);

        const geometry = new THREE.BoxBufferGeometry();
        const material = new THREE.MeshStandardMaterial( { color: 0xFF0000 });
        this.mesh = new THREE.Mesh( geometry, material );
        this.mesh.position.set( 0, 0, -4);
        this.scene.add(this.mesh);

        this.room = new THREE.LineSegments(new BoxLineGeometry(6,6,6,10,10,10),
                                           new THREE.LineBasicMaterial( {color: 0x000000 }));
        this.room.geometry.translate(0,3,0);
        this.scene.add(room);

		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		container.appendChild( this.renderer.domElement );


        const controls = new OrbitControls( this.camera, this.renderer.domElement );
        

        this.setupVR();

        this.renderer.setAnimationLoop(this.render.bind(this));
   
        window.addEventListener('resize', this.resize.bind(this) );

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
        this.mesh.rotateY( 0.01 );
        this.renderer.render( this.scene, this.camera );
    }
}

export { App };
