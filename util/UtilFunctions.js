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


//3d video function block str=============================================================
function detectDevice() {
    const ua = navigator.userAgent;

    // Detect iPhone
    const isIPhone = /iPhone/.test(ua);

    // Detect iPad (both the old and new ways of identifying iPads)
    const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Detect desktop (PC or Mac, excluding iPads)
    const isDesktop = !isIPhone && !isIPad && /Win|Mac|Linux/.test(navigator.platform);

    if (isIPhone) {
        return 'iPhone';
    } else if (isIPad) {
        return 'iPad';
    } else if (isDesktop) {
        return 'Desktop';
    } else {
        return 'Unknown';
    }
}

let videoMaterial
export function loadVideoToScreen(screenModel, videoSrc, flvPlayer = false) {
    let deviceType = detectDevice()

    // Create an HTML video element
    const video = document.createElement('video');
    video.loop = true;    // Set to loop the video
    video.muted = true;   // Mute the video
    video.playsInline = true; // Necessary for mobile devices
    if(! (deviceType == 'iPhone' || deviceType == 'iPad') ) video.style.display = 'none'; // Hide the video element
    //video.style.zIndex = 999
    video.crossOrigin = 'anonymous'
    document.body.appendChild(video);

    // Create a VideoTexture from the video element
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;

    // Create a material using the video texture
    videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });

    // Apply the material to the screen model
    screenModel.material = videoMaterial;

    // Attach flvPlayer if it is provided and not null
    if (flvPlayer) {
        console.log(screenModel.name)
        let flvPlayer1 = flvjs.createPlayer({
            type: 'flv',
            url: 'http://172.16.40.58:8080/live/test2.flv'
        });

        flvPlayer1.attachMediaElement(video);
        flvPlayer1.load();
        flvPlayer1.play();
    } else {
        // Otherwise, use the HTML5 video element
        video.src = videoSrc;
        video.play();
    }
}

//3d video function block end=============================================================

