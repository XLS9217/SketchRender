import * as THREE from 'three'

export function NormalExpansion(model, scene) {
    model.traverse((child) => {
        if (child.isMesh) {
            // Create a copy of the geometry
            const geometryCopy = child.geometry.clone();

            // Ensure the geometry has vertex normals computed
            geometryCopy.computeVertexNormals();

            const positionAttribute = geometryCopy.attributes.position;
            const normalAttribute = geometryCopy.attributes.normal;

            // Traverse each vertex of the geometry
            for (let i = 0; i < positionAttribute.count; i++) {
                const normal = new THREE.Vector3(
                    normalAttribute.getX(i),
                    normalAttribute.getY(i),
                    normalAttribute.getZ(i)
                );
                const position = new THREE.Vector3(
                    positionAttribute.getX(i),
                    positionAttribute.getY(i),
                    positionAttribute.getZ(i)
                );

                // Move the vertex along the normal direction by 0.1 units
                position.addScaledVector(normal, 0.05);

                // Update the vertex position
                positionAttribute.setXYZ(i, position.x, position.y, position.z);
            }

            // Update the position attribute
            positionAttribute.needsUpdate = true;

            // Optional: Update the normals again if needed
            geometryCopy.computeVertexNormals();

            // Create a new mesh with the expanded geometry and a black material
            const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 , side: THREE.BackSide});
            const expandedMesh = new THREE.Mesh(geometryCopy, blackMaterial);

            // Set the same position and rotation as the original mesh
            expandedMesh.position.copy(child.position);
            expandedMesh.rotation.copy(child.rotation);
            expandedMesh.quaternion.copy(child.quaternion);

			expandedMesh.renderOrder = model.renderOrder - 1

            // Add the expanded mesh to the scene
            scene.add(expandedMesh);
        }
    });
}

export function ScaleExpansion( model, scene ){
	//replace to other material for support render
	model.traverse((child) => {
		if(child.isMesh){
			// 	child.material = new THREE.MeshNormalMaterial()

			// Create a copy of the geometry
			const geometryCopy = child.geometry.clone();

			// Create a new mesh with the copied geometry and original material
			const scaledMesh = new THREE.Mesh(geometryCopy, new THREE.MeshBasicMaterial({color : 0x000000 , side: THREE.BackSide}));

			// Scale up the copied geometry by 1.1
			scaledMesh.scale.set(1.1, 1.1, 1.1);

			// Set the same position and rotation as the original mesh
			scaledMesh.position.copy(child.position);
			scaledMesh.rotation.copy(child.rotation);
			scaledMesh.quaternion.copy(child.quaternion);

			// Add the scaled mesh back to the scene
			scene.add(scaledMesh);

		}
	})

}