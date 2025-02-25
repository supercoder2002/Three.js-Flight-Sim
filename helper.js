import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const glbLoader = new GLTFLoader();

/* Notes

	Cessna 172 weighs 1680 lbs in empty configuration (762 kg)
	Takeoff speed of a Cessna 172 is 55 knots (28 m/s)
    Stall speed of Cessna with flaps down is 48 knots (24 m/s)
	Stall speed of Cessna without flaps is 40 knots (21 m/s)
	
*/



// load one object
function loadObject(loader, url, name, obj_array) {
	let myPromise = new Promise(function(myResolve, myReject) {
		loader.load(
			url,
			function (object) {
				object.name = name;
				obj_array.push(object);
				myResolve();
			},
			function (xhr) {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded' );
			},
			function (error) {
				myReject(error);
			}
		);
	});
	return myPromise; 
}


// load multiple objects
async function loadObjects(loader, urls, names, obj_array) {
	for (let i = 0; i < urls.length; i++) {
		await loadObject(loader, urls[i], names[i], obj_array);
	}
}

// calculates thrust acceleration 
function calculateThrust(thrustForce, mass, thrustDirection) {
	var thrustAcceleration = (thrustForce / mass)
	var totalAcceleration = new THREE.Vector3(thrustDirection.x * thrustAcceleration, thrustDirection.y * thrustAcceleration, thrustDirection.z * thrustAcceleration);
	return totalAcceleration
}

// calculates drag (Cd = coefficient of drag, area = area of wing surface)
function calculateDrag(mass, airDensity, velocity, Cd, area, dragDirection) {
	var drag = (0.5 * (velocity ** 2) * airDensity * Cd * area) / mass
	var dragAcceleration = new THREE.Vector3(dragDirection.x * drag, dragDirection.y * drag, dragDirection.z * drag);
	//console.log(drag * mass)
	return dragAcceleration
}

// // calculates friction (N = normal force, μ = friction coefficient)
function calculateFriction(N, μ, velocity, mass) {
	var frictionPower = -N * μ
	let frictionDirection = velocity.clone().negate().normalize()

	let friction = frictionDirection.clone().multiplyScalar(frictionPower)

	var frictionAcceleration = frictionDirection.clone().multiplyScalar(1/mass);
	return frictionAcceleration
}

// calculates the value of linear integration based on integral of y=mx+c
function calculateLinearIntegration(m, c, b1 = 1, b0 = 0) {
	// integral of y=mx+c is mx^2/2 + cx
	var integration1 = (m * b1 * b1) / 2 + c * b1 // upper bound integration
	var integration0 = (m * b0 * b0) / 2 + c * b0 // lower bound integration
	return integration1 - integration0
}

function calculateLift(mass, airDensity, velocity, Cl, area, rightDirection) {
	let liftVelocity = velocity.clone().projectOnPlane(rightDirection.normalize())
	let liftPower = Cl * 1/2 * airDensity * (liftVelocity.length() ** 2) * area

	let n = new THREE.Vector3(rightDirection.y, 0, rightDirection.x).normalize()

	let liftDirection = liftVelocity.clone().normalize().cross(n)
	console.log(liftDirection)

	let liftForce = liftDirection.normalize().multiplyScalar(liftPower)

	let dragPower = (Cl ** 2) / (Math.PI * area / 16 * 9) // Induced Drag equals Cl squared divided by pi * aspect ratio * efficiency 
	//console.log(dragPower)
	let dragDirection = liftVelocity.clone().negate().normalize()
	let dragForce = dragDirection.clone().multiplyScalar(dragPower)

	let totalForce = new THREE.Vector3().addVectors(liftForce, dragForce)

	var totalAcceleration = new THREE.Vector3(totalForce.x / mass, totalForce.y / mass, totalForce.z / mass);
	//console.log(totalAcceleration)

	return totalAcceleration
}


class OBB {
	constructor(position, size, rotation, scene) {
		this.AABB = new THREE.Box3();
		this.AABB.setFromCenterAndSize(position, size);
		this.size = size
		this.i = 0

		this.position = position
		this.rotation = rotation

		const OBBGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
		const OBBMaterial = new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: true});
		OBBMaterial.side = THREE.DoubleSide

		this.OBBMesh = new THREE.Mesh(OBBGeometry, OBBMaterial);
		this.OBBMesh.position.copy(position)
		this.OBBMesh.setRotationFromQuaternion(rotation)
		scene.add(this.OBBMesh);
		this.scene = scene
	}

	setOrientation(position = this.position, rotation = this.rotation, relativeTo = this.position) {
		this.AABB.setFromCenterAndSize(position, this.size);
		var rot = new THREE.Matrix4()
		rot.makeRotationFromQuaternion(rotation)
		var newPos = new THREE.Vector3()
		newPos.subVectors(position, relativeTo)
		newPos.applyMatrix4(rot)
		newPos.add(relativeTo)

		this.OBBMesh.position.copy(newPos)
		this.OBBMesh.setRotationFromQuaternion(rotation)
		this.position.copy(newPos)
		this.AABB.setFromCenterAndSize(newPos, this.size)
		this.rotation.copy(rotation)
		//console.log(rotation)
	}

	checkMeshColliding(mesh) {
		this.i += 1
		var l = 0 
		let rotMat = new THREE.Matrix4()
		//console.log(this.rotation)
		rotMat.makeRotationFromQuaternion(this.rotation)
		rotMat.invert()

		let translation = new THREE.Vector3().subVectors(mesh.position, this.position)
		let translation2 = new THREE.Vector3().subVectors(mesh.position, translation) 


		let transMat = new THREE.Matrix4() 
		transMat.makeTranslation(translation2)
		transMat.invert()


		const geometry = mesh.geometry.clone()
		mesh.updateWorldMatrix()

		geometry.applyMatrix4(mesh.matrixWorld)
		geometry.applyMatrix4(transMat)
		geometry.applyMatrix4(rotMat)
		transMat.invert()
		geometry.applyMatrix4(transMat)
		

		const index = geometry.index.array
		const points = geometry.attributes.position.array

		let v0 = new THREE.Vector3()
		let v1 = new THREE.Vector3()
		let v2 = new THREE.Vector3()

		for (let i = 0; i < index.length; i += 3) {
			let i0 = index[i] * 3
			let i1 = index[i + 1] * 3
			let i2 = index[i + 2] * 3

			v0 = new THREE.Vector3(points[i0], points[i0 + 1], points[i0 + 2])
			v1 = new THREE.Vector3(points[i1], points[i1 + 1], points[i1 + 2])
			v2 = new THREE.Vector3(points[i2], points[i2 + 1], points[i2 + 2])

			let triangle = new THREE.Triangle(v0, v1, v2)

			if (this.AABB.intersectsTriangle(triangle)) {
				this.OBBMesh.material.color.set(0, 0, 1.0)

				let realPoints = mesh.geometry.attributes.position.array

				let rv0 = new THREE.Vector3(realPoints[i0], realPoints[i0 + 1], realPoints[i0 + 2])
				let rv1 = new THREE.Vector3(realPoints[i1], realPoints[i1 + 1], realPoints[i1 + 2])
				let rv2 = new THREE.Vector3(realPoints[i2], realPoints[i2 + 1], realPoints[i2 + 2])


				let realTriangle = new THREE.Triangle(rv0, rv1, rv2)
				let normal = new THREE.Vector3()
				realTriangle.getNormal(normal)
				return {collides: true, normal: normal}
			}
			
		}
		this.OBBMesh.material.color.set(0, 1.0, 0)
		return {collides: false, normal: null}
	}


}


function lerpEuler(current, target, f) {
	var diff = new THREE.Vector3(target.x - current.x, target.y - current.y, target.z - current.z)
	diff.multiplyScalar(f)
	current.set(current.x + diff.x, current.y + diff.y, current.z + diff.z)
	return diff
}

function calculateLiftCoefficent(AoA) {
    let scaleAoA = AoA / 1.5707
    let inverted = false

    //console.log(scaleAoA)
    
    if ((scaleAoA > 2) && (scaleAoA < -2))  {
        return null
    }
    
    if ((scaleAoA > 1) && (scaleAoA < 2))  {
        inverted = true
        scaleAoA = scaleAoA - 2
    }
    else if ((scaleAoA > -2) && (scaleAoA < -1))  {
        inverted = true
        scaleAoA = scaleAoA + 2
    }

    //console.log(AoA, inverted)
    
    //console.log(scaleAoA)
    let nonInverted = 0
    
    if ((scaleAoA <= 0.2) && (scaleAoA >= -0.2)) {
        nonInverted = Math.sin(scaleAoA * 10) + 0.02
    } 
    else if ((scaleAoA < -0.2) && (scaleAoA > -1)) {
        nonInverted = (-(1 / (scaleAoA - 0.84))) ** 6 + 0.025
    }
    else if ((scaleAoA < 1) && (scaleAoA > 0.2)) {
        nonInverted = (1 / (scaleAoA + 0.84)) ** 6 - 0.025
    }
    
    if (inverted) {
        return -nonInverted * 2
    } else {
        return nonInverted * 2
    }
}

export {loadObjects, glbLoader, calculateThrust, calculateDrag, lerpEuler, OBB, calculateLinearIntegration, calculateLiftCoefficent, calculateLift, calculateFriction};
