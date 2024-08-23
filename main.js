import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Plane} from './plane.js' 
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';

// width and height of screen
const width = window.innerWidth
const height = window.innerHeight


// Create renderer
var renderer = new THREE.WebGLRenderer({antialias: false});
renderer.setSize(width, height);
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

// Scene
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x005ff1)


// Create camera
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.y = 1;




// --- Ground with shader material ---
const terrainSize = 100;
const terrainOffset = 20;

// glsl uniforms 
var uniforms = {
	lightDir: {value: new THREE.Vector3(0, -1, 0).normalize()},
}

// custom terrain shading material
const terrainMaterial = new THREE.ShaderMaterial( {
	uniforms: uniforms,
	vertexShader: document.getElementById('vertexShader').textContent,
	fragmentShader: document.getElementById('fragmentShader').textContent

});
terrainMaterial.side = THREE.DoubleSide;

// ground plane geometry
const geometry = new THREE.PlaneGeometry(2000, 7500, terrainSize - 1,  terrainSize - 1);

// ground mesh
const ground = new THREE.Mesh(geometry, terrainMaterial);
ground.rotation.x = -1.5707
scene.add(ground);

// Perlin noise for terrain generation

noise.seed(Math.random())

let perlinGrid = []

// Generate perlin noise
for (let y = 0; y < terrainSize; y += 1){
	let xRow = []
	for (let x = 0; x < terrainSize; x += 1){
		let v = noise.perlin2(x / terrainSize * 2, y / terrainSize * 2);
		xRow.push(v)
	}
	perlinGrid.push(xRow)
}

// apply perlin noise to ground plane
let vertices = ground.geometry.attributes.position

console.log(ground)

for (let i = 0; i < vertices.count; i++) {
	const x = vertices.getX(i);
	let y = vertices.getY(i);
	let z = vertices.getZ(i);
	var gx = i % terrainSize
	var gy = (i - gx) / terrainSize
	if ((gx > 45) && (gx < 55)) {
		z = 20 // runway land
	} else {
		z = perlinGrid[gy][gx] * 100 + terrainOffset // set height from corresponding perlin noise
	}
	vertices.setXYZ(i, x, y, z); 
}

geometry.computeVertexNormals() // compute new vertex normals for terrain

// runway generation
const textureLoader = new THREE.TextureLoader(); 
const runwayTexture = textureLoader.load('./resources/runway.png'); // load runway texture

const runwayMaterial = new THREE.MeshBasicMaterial({map : runwayTexture}); // runway material

// create runway
const runwayGeometry = new THREE.BoxGeometry(7500, 1, 100); 
const runwaySideMaterial = new THREE.MeshBasicMaterial( {color: 0x555555} ); 
const runway = new THREE.Mesh(runwayGeometry, [runwaySideMaterial, runwaySideMaterial, runwayMaterial, runwaySideMaterial, runwaySideMaterial, runwaySideMaterial]); 
runway.rotation.y = 1.5707
runway.position.y = 20 // position on terrain
scene.add(runway);

console.log(runway.geometry.attributes.position)

// fps counter
var prevTime = performance.now();
var timeNow = performance.now();
var fps = 60

//  --- Create HUD display ---
var hudCanvas = document.createElement('canvas');

hudCanvas.width = width;
hudCanvas.height = height;

// init HUD screen
var hudDisplay = hudCanvas.getContext('2d');
hudDisplay.font = "Normal 40px Arial";
hudDisplay.textAlign = 'center';
hudDisplay.fillStyle = "rgba(250, 250, 250, 1)";
hudDisplay.fillText('Initializing...', width / 2, height / 2);
 
// HUD camera and scene
var cameraHUD = new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, 0, 30 );
var sceneHUD = new THREE.Scene();

// connecting html canvas to THREE.js screen
var hudTexture = new THREE.Texture(hudCanvas) 
hudTexture.needsUpdate = true;

var hudMaterial = new THREE.MeshBasicMaterial( {map: hudTexture} );
hudMaterial.transparent = true;

// Create plane that renders HUD
var planeGeometry = new THREE.PlaneGeometry( width, height );
var plane = new THREE.Mesh( planeGeometry, hudMaterial );
sceneHUD.add(plane);


// animation function
var x = 0
var avgFPS = 60
var fpss = [60, 60, 60]
function animate() {
	x += 0.1
	// update plane

	plane.changeThrust(1)
	plane.update(avgFPS, runway)

	// measure fps
	timeNow = performance.now();
	
	fps = 1000 / (timeNow - prevTime)
	prevTime = performance.now();
	fpss.unshift(fps)
	fpss.pop()
	avgFPS = (fpss[0] + fpss[1] + fpss[2]) / 3


	// Update HUD graphics
	hudDisplay.clearRect(0, 0, width, height);
	hudDisplay.fillText(Math.round(plane.airspeed * 100) / 100, width/2, height/2);
	hudDisplay.fillText(Math.round(plane.plane.position.z * 100) / 100, width/2, height/2  - 100);
	hudTexture.needsUpdate = true;
	
	// Render scene
	renderer.render(scene, plane.planeCamera);

	// Render HUD on top of the scene
	renderer.render(sceneHUD, cameraHUD);
}

// when plane is finished loading
function finishedLoading() {
	document.addEventListener("keydown", keypress)
	plane.plane.position.z = 3700
	mainLoop();
}

// if error occurs during plane loading
function errorLoading(error) {
	console.log(error)
} 

// set main loop for animation function
function mainLoop() {
	var prevTime = performance.now();
	renderer.setAnimationLoop(animate);
}

// load plane with async function
var plane = new Plane(scene, 'resources/airplane/plane3.glb', 'plane2', function () {renderer.setAnimationLoop(null);}, () => finishedLoading(), () => errorLoading())
plane.initPlane()



function keypress() {
	if (event.key == "ArrowUp") {
		plane.changeRotation(new THREE.Euler(-0.1 * (plane.airspeed / 275), 0, 0))
	} else if (event.key == "ArrowDown") {
		plane.changeRotation(new THREE.Euler(0.1 * (plane.airspeed / 275), 0, 0))
	} else if (event.key == "ArrowLeft") {
		plane.changeRotation(new THREE.Euler(0, 0.1 * (plane.airspeed / 275), -0.1 * (plane.airspeed / 275)))
	} else if (event.key == "ArrowRight") {
		plane.changeRotation(new THREE.Euler(0, -0.1 * (plane.airspeed / 275), 0.1 * (plane.airspeed / 275)))
	} else if (event.key == "z") {
		plane.changeRotation(new THREE.Euler(0, 0.1 * (plane.airspeed / 275), 0))
	} else if (event.key == "c") {
		plane.changeRotation(new THREE.Euler(0, -0.1 * (plane.airspeed / 275), 0))
	} else if (event.key == "m") {
		renderer.setAnimationLoop(null)
	}
}