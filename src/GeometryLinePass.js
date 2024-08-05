import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { removeAllMesh } from '../util/UtilFunctions';
import CustomEdgesGeometry from './CustomEdgesGeometry.js'

const lineScene = new THREE.Scene()
const backgroundColor = new THREE.Color(0.9, 0.9, 0.9)
lineScene.background = backgroundColor

export default class GeometryLinePass extends Pass {
    constructor(renderer, scene, camera) {
        super();
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        

        this.lineSceneTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        
        // Initialize uniforms
        this.lineSceneUniform = new THREE.Uniform(this.lineSceneTarget.texture)
        
        // Shader material
        const customShader = {
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0.0 },
                uLineBuffer: this.lineSceneUniform

            },
            vertexShader: /* glsl */`
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D tDiffuse;
                uniform sampler2D uLineBuffer;

                varying vec2 vUv;

                void main() {
                    vec2 uv = vUv;
                    gl_FragColor = texture2D(tDiffuse, uv);
                    gl_FragColor = texture2D(uLineBuffer, uv);
                }
            `
        };

        this.material = new THREE.ShaderMaterial(customShader);
        this.fsQuad = new FullScreenQuad( this.material );

    }

    dispose() {
        //console.log('dispose')
		this.material.dispose();

		this.fsQuad.dispose();

	}

    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        this.updateBuffers()
        this.material.uniforms.tDiffuse.value = readBuffer.texture;

        if (this.renderToScreen) {
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(writeBuffer);
            renderer.clear();
            this.fsQuad.render(renderer);
        }
    }

    updateBuffers(){

        let renderSize = new THREE.Vector2()
        this.renderer.getSize(renderSize)
        const pixelRatio = this.renderer.getPixelRatio();
        this.lineSceneTarget.setSize(renderSize.x * pixelRatio, renderSize.y * pixelRatio);

        this.renderer.setRenderTarget(this.lineSceneTarget);
        this.renderer.render(lineScene, this.camera);
        this.renderer.setRenderTarget(null);

        this.lineSceneUniform.value = this.lineSceneTarget.texture
        
    }

    //construct a new model using line geometry
    updateLineScene() {
        removeAllMesh(lineScene)

        this.constructLineModel(this.scene)

    }

    constructLineModel(scene){
        lineScene.clear()

        const meshes = [];
        scene.traverse( child => {
            if ( child.isMesh ) {
                meshes.push( child );
            }
        } );
    
        for ( const key in meshes ) {
    
            const mesh = meshes[ key ];
            const parent = mesh.parent;
    
            let lineGeom;
            
            //lineGeom = new THREE.EdgesGeometry( mesh.geometry, 40 );
            lineGeom = new CustomEdgesGeometry( mesh.geometry, 40 );
    
            
            const line = new THREE.LineSegments( lineGeom, this.getLineMaterial() );
            line.position.copy( mesh.position );
            line.scale.copy( mesh.scale );
            line.rotation.copy( mesh.rotation );
            
            lineScene.add(line)

            mesh.material = this.getSurfaceMaterial()
            lineScene.add(mesh)
        }
    
    }

    getLineMaterial() {
        let material = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true});
    
        material.onBeforeCompile = (shader) => {
            // console.log(shader.vertexShader);
            // console.log(shader.fragmentShader);
    
            shader.uniforms.uSceneColor = new THREE.Uniform(backgroundColor)

            // Inject code into the vertex shader to transform normal to view space
            shader.vertexShader = `
                attribute vec3 normal2;

                varying vec3 vViewNormal;
                varying vec3 vViewNormal2;
                ${shader.vertexShader}
            `;
    
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vViewNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;
                vViewNormal2 = (modelViewMatrix * vec4(normal2, 0.0)).xyz;
                `
            );
    
            // Inject code into the fragment shader to use the transformed normal for coloring
            shader.fragmentShader = `
                varying vec3 vViewNormal;
                varying vec3 vViewNormal2;

                uniform vec3 uSceneColor;

                ${shader.fragmentShader}
            `;
    
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                
                // Calculate the color based on the view space normal
                float dotProd = dot(normalize(vViewNormal), vec3(0.0, 0.0, 1.0));
                float dotProd2 = dot(normalize(vViewNormal2), vec3(0.0, 0.0, 1.0));

                if (dotProd > 0.0 || dotProd2 > 0.0) {
                    // Normal is facing the camera, set the color to green
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else {
                    // Normal is not facing the camera, set the color to red
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                }
                //gl_FragColor = vec4(vViewNormal2, 1.0);
                `
            );
        };
    
        return material;
    }
    
    getSurfaceMaterial(){
        let material = new THREE.ShaderMaterial({
            vertexShader: /* glsl */`
                varying vec3 vNormalView;
        
                void main() {
                    // Transform the normal to view space
                    vNormalView = normalize((modelViewMatrix * vec4(normal, 0.0)).xyz);
        
                    // Offset the vertex position along the normal in view space
                    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                    vec3 offsetPosition = viewPosition.xyz + vNormalView * 0.1; // Adjust the offset distance as needed
        
                    gl_Position = projectionMatrix * vec4(offsetPosition, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                void main() {
                    gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
                }
            `
        });
        return material;
    }
}
