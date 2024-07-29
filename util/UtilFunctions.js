import * as THREE from 'three'

export function removeAllMesh(scene) {
    if (!scene || !(scene instanceof THREE.Scene)) {
        console.error('Invalid scene provided');
        return;
    }

    let childrenToRemove = [];

    // Traverse through all children and collect meshes to remove
    scene.traverse((child) => {
        if (child.isMesh) {
            childrenToRemove.push(child);
        }
    });

    // Remove collected meshes
    childrenToRemove.forEach(mesh => {
        // Remove from parent group or scene
        mesh.parent.remove(mesh);

        // Dispose of geometry and material
        if (mesh.geometry) {
            mesh.geometry.dispose();
        }

        if (mesh.material) {
            // Some objects can have an array of materials
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
            } else { 
                mesh.material.dispose();
            }
        }

        // Dispose of texture if it exists
        if (mesh.material && mesh.material.map) {
            mesh.material.map.dispose();
        }
    });

    // Optionally remove empty groups
    scene.traverse((child) => {
        if (child instanceof THREE.Group && child.children.length === 0) {
            // Remove empty groups from the scene
            child.parent.remove(child);
        }
    });
}

export function sceneMeshCopy(sourceScene, targetScene) {
    // Traverse the source scene and copy meshes
    sourceScene.traverse((child) => {
        if (child.isMesh) {
            // Clone the mesh
            const clonedMesh = child.clone();
            // Set the same position and rotation as the original mesh
            clonedMesh.position.copy(child.position);
            clonedMesh.rotation.copy(child.rotation);
            clonedMesh.quaternion.copy(child.quaternion);
            // Add the cloned mesh to the target scene
            targetScene.add(clonedMesh);
        }
    });
}

export function findCameraInScene(scene) {
    let camera = null;
    scene.traverse((child) => {
        if (child.isCamera) {
            camera = child;
        }
    });
    return camera || new THREE.PerspectiveCamera(); // Default camera if none is found
}





let renderTargetLocal = null

export function setAlternativeRenderTarget(renderTarget){
    renderTargetLocal = renderTarget
}

export function flexableRender(composer, renderer) {
    if (renderTargetLocal === null) {
        composer.render();
    } else {
        // Create a temporary scene and camera to display the render target
        const tempScene = new THREE.Scene();
        const tempCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        tempCamera.position.z = 1;

        const planeGeometry = new THREE.PlaneGeometry(2, 2);
        const planeMaterial = new THREE.MeshBasicMaterial({ map: renderTargetLocal.texture });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        tempScene.add(plane);

        renderer.render(tempScene, tempCamera);
    }
}
