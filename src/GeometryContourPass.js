import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const contourScene = new THREE.Scene();
contourScene.background = new THREE.Color(0.0, 0.0, 0.0);

let renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

let normalBufferUniform = new THREE.Uniform();
let resolutionUniform = new THREE.Uniform();
let contourThrsholdUniform = new THREE.Uniform(0.05);

const simpleNormalMaterial = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
        
        varying vec3 vNormal; 

        void main() {
            vNormal = (modelViewMatrix * vec4(normal, 1.0)).xyz; 
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `, 

    fragmentShader:  /* glsl */ `
        
    varying vec3 vNormal;

        void main() {
            gl_FragColor = vec4(vNormal, 1.0);
        }
    `, 
})

export default class GeometryContourPass extends Pass {
    constructor(renderer, scene, camera) {
        super();
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Initialize uniforms
        this.normalBufferUniform = normalBufferUniform;
        this.resolutionUniform = resolutionUniform;
        this.contourThrsholdUniform = contourThrsholdUniform;
        
        // Shader material
        const customShader = {
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0.0 },
                uNormalRender: this.normalBufferUniform,
                uResolution: this.resolutionUniform,
                uContourThrshold: this.contourThrsholdUniform,
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
                    vec3 normalCenter = texture2D(uNormalRender, centerUV).rgb;
                    vec3 normalNeighbour = vec3(0.0);
                
                    if (neighbourUV.x >= 0.0 && neighbourUV.x <= 1.0 && neighbourUV.y >= 0.0 && neighbourUV.y <= 1.0) {
                        normalNeighbour = texture2D(uNormalRender, neighbourUV).rgb;
                    }
                
                    return distance(normalCenter, normalNeighbour);
                }
                

                void main() {
                    vec2 uv = vUv;
                    vec3 color = vec3(1.0, 1.0, 1.0);

                    float lineThickFactor = 1.2;

                    float offsetX = 1.0 / uResolution.x / lineThickFactor;
                    float offsetY = 1.0 / uResolution.y / lineThickFactor;
                    vec2 uvLeft = uv + vec2(-offsetX, 0.0);
                    vec2 uvRight = uv + vec2(offsetX, 0.0);
                    vec2 uvUp = uv + vec2(0.0, offsetY);
                    vec2 uvDown = uv + vec2(0.0, -offsetY);

                    float distanceLeft = calculateNormalDistance(uv, uvLeft);
                    float distanceRight = calculateNormalDistance(uv, uvRight);
                    float distanceUp = calculateNormalDistance(uv, uvUp);
                    float distanceDown = calculateNormalDistance(uv, uvDown);

                    float normalAverage = (distanceLeft + distanceRight + distanceUp + distanceDown) / 4.0;
                    float pixelLight = 1.0;
                    if (normalAverage > uContourThrshold) pixelLight = 0.0;
                    color = vec3(pixelLight);

                    gl_FragColor = vec4(color, 1.0);
                    //gl_FragColor = texture2D(uNormalRender, uv);
                }
            `
        };

        this.material = new THREE.ShaderMaterial(customShader);
        this.fsQuad = new FullScreenQuad( this.material );

        window.debug_ui.add(this.contourThrsholdUniform, 'value').min(0.001).max(0.2).step(0.001);
    }

    dispose() {
        //console.log('dispose')
		this.material.dispose();

		this.fsQuad.dispose();

	}

    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        this.updateGeometryContourBuffer();

        this.material.uniforms.tDiffuse.value = readBuffer.texture;

        if (this.renderToScreen) {
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(writeBuffer);
            renderer.clear();
            this.fsQuad.render(renderer);
        }

    }

    updateGeometryContourBuffer() {
        let normalRenderBuffer = this.normalRender(this.renderer, this.scene, this.camera);
        this.normalBufferUniform.value = normalRenderBuffer.texture;
        this.resolutionUniform.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    }

    updateContourScene() {
        // 1. Dispose of everything in the contourScene and clear it
        if (contourScene) {
            contourScene.traverse((object) => {
                if (object.isMesh) {
                    // Dispose geometry and material of the mesh
                    object.geometry.dispose();
                    if (object.material.isMaterial) {
                        // Dispose materials if they are instances of Material
                        object.material.dispose();
                    } else {
                        // Dispose of each material if it's an array
                        object.material.forEach(material => material.dispose());
                    }
                }
            }); 
            
            // Clear the scene
            contourScene.clear();
        }
        
        // 2. Copy every mesh from this.scene to contourScene
        this.scene.traverse((object) => {
            if (object.isMesh) {
                // Clone the mesh and add it to contourScene
                const meshClone = object.clone();
                meshClone.material = new THREE.MeshNormalMaterial()
                contourScene.add(meshClone);
            }
        });

        // Alternative: Convert the whole scene
        // this.scene.traverse((object) => {
        //     if (object.isMesh) {
        //         object.material = new THREE.MeshNormalMaterial()
        //         //object.material = simpleNormalMaterial
        //     }
        // });
    }

    normalRender(renderer, scene, camera) {

        //const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        renderer.setRenderTarget(renderTarget);
        //renderer.render(scene, camera);
        renderer.render(contourScene, camera);
        renderer.setRenderTarget(null);

        return renderTarget;
    }
}
