import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/Addons.js';

const newScene = new THREE.Scene();
newScene.background = new THREE.Color( 0.0, 0.0, 0.0 );

let normalBufferUniform = new THREE.Uniform()
let resolutionUniform = new THREE.Uniform()
let contourThrsholdUniform = new THREE.Uniform(0.05)


export function GeometryContourEffect(renderer, scene, camera) {

    updateGeometryContourBuffer(renderer, scene, camera)

    
window.debug_ui.add(contourThrsholdUniform, 'value').min(0.01).max(0.5).step(0.01)

    console.log('composer')

    const customShader = {
        uniforms: {
            tDiffuse: { value: null },
            time: { value: 0.0 },
            uNormalRender: normalBufferUniform,
            uResolution: resolutionUniform,
            uContourThrshold: contourThrsholdUniform
        },

        vertexShader: /* glsl */`

            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,

        fragmentShader: /* glsl */`

            uniform float time;
            uniform sampler2D tDiffuse;
            uniform sampler2D uNormalRender;
            uniform vec2 uResolution;
            uniform float uContourThrshold;

            varying vec2 vUv;

            float calculateNormalDistance(vec2 centerUV, vec2 neighbourUV) {
                float normalDist = 0.0;

                // 1. find center
                vec3 normalCenter = texture2D(uNormalRender, centerUV).rgb;
            
                // 2. find neighbour in uNormalRender, if neighbour out of bound, return 0
                vec3 normalNeighbour;
                if (neighbourUV.x < 0.0 || neighbourUV.x > 1.0 || neighbourUV.y < 0.0 || neighbourUV.y > 1.0) {
                    return 0.0;
                } else {
                    normalNeighbour = texture2D(uNormalRender, neighbourUV).rgb;
                }
            
                // 3. find the distance between center and neighbour
                normalDist = distance(normalCenter, normalNeighbour);
                return normalDist;
            }
            

            void main() {
                vec2 uv = vUv;
                vec3 color = vec3(1.0, 1.0 ,1.0);

                //calculate normal from all four distance
                float offset = 1.0 / uResolution.x; // Use resolution for offset
                vec2 uvLeft = uv + vec2(-offset, 0.0);
                vec2 uvRight = uv + vec2(offset, 0.0);

                offset = 1.0 / uResolution.y; // Use resolution for offset
                vec2 uvUp = uv + vec2(0.0, offset);
                vec2 uvDown = uv + vec2(0.0, -offset);

                float distanceLeft = calculateNormalDistance(uv, uvLeft);
                float distanceRight = calculateNormalDistance(uv, uvRight);
                float distanceUp = calculateNormalDistance(uv, uvUp);
                float distanceDown = calculateNormalDistance(uv, uvDown);

                //calcuulate the average of the normal
                float normalAverage = (distanceLeft + distanceRight + distanceUp + distanceDown) / 4.0;
                float pixelLight = 1.0;
                if(normalAverage > uContourThrshold) pixelLight = 0.0;
                color = vec3(pixelLight);
                
                gl_FragColor = vec4(color, 1.0);
                //UNCOMMENT TO DEBUG
                //gl_FragColor = texture2D(tDiffuse, uv);
                //gl_FragColor = texture2D(uNormalRender, uv);
                //gl_FragColor = vec4(1.0 , 1.0, 0.0, 1.0);
            }
        `
    };
    const passMaterial = new THREE.ShaderMaterial(customShader)
    const shaderPass = new ShaderPass(passMaterial);
    
    return shaderPass
}


export function updateGeometryContourBuffer(renderer, scene, camera){

    let normalRenderBuffer = normalRender(renderer, scene, camera)
    normalBufferUniform.value = normalRenderBuffer.texture
    
    // Update the resolution uniform
    resolutionUniform.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
}


function normalRender(renderer, scene, camera) {
    // 1. Make a new scene

    // 2. Copy the meshes from the original scene to the new scene, set them to normal material
    scene.traverse((child) => {
        if (child.isMesh) {
            const meshCopy = child.clone();
            meshCopy.material = new THREE.MeshNormalMaterial()
            newScene.add(meshCopy);
        }
    });

    // 3. Create a render target
    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

    // 4. Render the new scene to the render target
    renderer.setRenderTarget(renderTarget);
    renderer.render(newScene, camera);
    renderer.setRenderTarget(null); // Reset to the default framebuffer

    // 5. free the temporary memory
    // Dispose of cloned meshes and materials
    newScene.traverse((child) => {
        if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
        }
    });
    newScene.clear()

    // Dispose of the scene itself
    //newScene.dispose();

    // 5. Return the texture from the render target
    return renderTarget;
}





