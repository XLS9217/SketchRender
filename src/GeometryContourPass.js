import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { removeAllMesh } from '../util/UtilFunctions';

const normalScene = new THREE.Scene();
normalScene.background = new THREE.Color(0.0, 0.0, 0.0);
let normalBufferUniform = new THREE.Uniform();
let normalRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

const depthScene = new THREE.Scene();
depthScene.background = new THREE.Color(0.0, 0.0, 0.0);
let depthBufferUniform = new THREE.Uniform();
let depthRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

const wireFrameScene = new THREE.Scene();
wireFrameScene.background = new THREE.Color(0.0, 0.0, 0.0);
let wireframeBufferUniform = new THREE.Uniform();
let wireframeRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);


let resolutionUniform = new THREE.Uniform();

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

const Accuracy_Option = {
    X4 : 4,
    X8 : 8
}

export default class GeometryContourPass extends Pass {
    constructor(renderer, scene, camera) {
        super();
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Initialize uniforms
        this.normalBufferUniform = normalBufferUniform;
        this.depthBufferUniform = depthBufferUniform;
        this.wireFrameBufferUniform = wireframeBufferUniform;
        this.resolutionUniform = resolutionUniform;
        this.normalThrsholdUniform = new THREE.Uniform(0.05);
        this.depthThrsholdUniform = new THREE.Uniform(0.05);
        this.accuracyUniform = new THREE.Uniform(8);
        this.neighbourDistUniform = new THREE.Uniform(1.2);
        this.applyToModelUniform = new THREE.Uniform(false)
        this.applyWireframeLimit = new THREE.Uniform(false)
        
        // Shader material
        const customShader = {
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0.0 },

                uNormalRender: this.normalBufferUniform,
                uDepthRender: this.depthBufferUniform,
                uWireframeRender: this.wireFrameBufferUniform,

                uResolution: this.resolutionUniform,

                uNormalThrshold: this.normalThrsholdUniform,
                uDepthThrshold: this.depthThrsholdUniform,

                uAccuracy: this.accuracyUniform,
                uNeighbourDist: this.neighbourDistUniform,
                uIsApplyToModel: this.applyToModelUniform,
                uApplyWireframe: this.applyWireframeLimit,

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
                uniform sampler2D uDepthRender;
                uniform sampler2D uWireframeRender;
                uniform vec2 uResolution;
                uniform float uNormalThrshold;
                uniform float uDepthThrshold;
                uniform float uNeighbourDist;
                uniform int uAccuracy;
                uniform bool uIsApplyToModel;
                uniform bool uApplyWireframe;

                varying vec2 vUv;


                float calculateNormalDistance(vec2 centerUV, vec2 neighbourUV) {
                    vec3 normalCenter = texture2D(uNormalRender, centerUV).rgb;
                    vec3 normalNeighbour = vec3(0.0);
                
                    if (neighbourUV.x >= 0.0 && neighbourUV.x <= 1.0 && neighbourUV.y >= 0.0 && neighbourUV.y <= 1.0) {
                        normalNeighbour = texture2D(uNormalRender, neighbourUV).rgb;
                    }
                
                    return distance(normalCenter, normalNeighbour);
                }

                float calculateDepthDistance(vec2 centerUV, vec2 neighbourUV) {
                    vec3 depthCenter = texture2D(uDepthRender, centerUV).rgb;
                    vec3 depthNeighbour = vec3(0.0);
                
                    if (neighbourUV.x >= 0.0 && neighbourUV.x <= 1.0 && neighbourUV.y >= 0.0 && neighbourUV.y <= 1.0) {
                        depthNeighbour = texture2D(uDepthRender, neighbourUV).rgb;
                    }
                
                    return distance(depthCenter, depthNeighbour);
                }

                /**
                 * mode
                 *  Mode 1 Normal
                 *  Mode 2 Depth
                 * lineThickFactor: how thick is the line
                 * accuracy: how many neighbour is used
                 *  4
                 *  8
                 */
                float calculateAverageDistence(int mode, float lineThickFactor, int accuracy){
                    vec2 uv = vUv;
                    if(uIsApplyToModel) uv = gl_FragCoord.xy / uResolution;

                    float offsetX = 1.0 / uResolution.x / lineThickFactor;
                    float offsetY = 1.0 / uResolution.y / lineThickFactor;

                    float distances[8];

                    vec2 checkPosition[8];
                    checkPosition[0] = uv + vec2(-offsetX, 0.0);
                    checkPosition[1] = uv + vec2(offsetX, 0.0);
                    checkPosition[2] = uv + vec2(0.0, offsetY);
                    checkPosition[3] = uv + vec2(0.0, -offsetY);
                    checkPosition[4] = uv + vec2(-offsetX, offsetY);
                    checkPosition[5] = uv + vec2(offsetX, offsetY);
                    checkPosition[6] = uv + vec2(offsetX, offsetY);
                    checkPosition[7] = uv + vec2(-offsetX, -offsetY);

                    if(mode == 1){
                        for(int i=0; i<accuracy; i++){
                            distances[i] = calculateNormalDistance(uv, checkPosition[i]);
                        }
                    }
                    else if(mode == 2){
                        for(int i=0; i<accuracy; i++){
                            distances[i] = calculateDepthDistance(uv, checkPosition[i]);
                        }
                    }

                    float outputAvg = 0.0;
                    float biggest = 0.0;
                    float accuracy_float = float(accuracy);
                    for(int i=0; i<accuracy; i++){
                        outputAvg += distances[i];
                        if(distances[i] > biggest) biggest = distances[i];
                    }
                    return outputAvg / accuracy_float;
                    //return biggest;
                }
                

                void main() {
                    vec2 uv = vUv;
                    if(uIsApplyToModel) uv = gl_FragCoord.xy / uResolution;
                    vec3 color = vec3(1.0, 1.0, 1.0);
                    float pixelLight = 1.0;

                    //blend in wire frame
                    vec3 hasWireframe = texture2D(uWireframeRender, uv).rgb;
                    //if does not have wireframe just return
                    if(hasWireframe.r < 0.1 && uApplyWireframe){
                        gl_FragColor = vec4(color, 1.0);
                    }else{
                        //normal line
                        //float normalAverage = NormalAverage();
                        float normalAverage = calculateAverageDistence(1, uNeighbourDist, uAccuracy);
                        if (normalAverage > uNormalThrshold) pixelLight = 0.0;
                        color = vec3(pixelLight);

                        //depth line
                        float depthAverage = calculateAverageDistence(2, uNeighbourDist, uAccuracy);
                        depthAverage *= 10.0;
                        if (depthAverage > uDepthThrshold) pixelLight = 0.0;
                        color = vec3(pixelLight);

                        gl_FragColor = vec4(color, 1.0);
                        //gl_FragColor = texture2D(uNormalRender, uv);
                        //gl_FragColor = texture2D(tDiffuse, uv);
                        //gl_FragColor = texture2D(uWireframeRender, uv);
                        //gl_FragColor = texture2D(uDepthRender, uv);
                    }        
                }
            `
        };

        this.material = new THREE.ShaderMaterial(customShader);
        this.fsQuad = new FullScreenQuad( this.material );

        this.addDebugFolder()
        

        
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

        //this.renderer.render(wireFrameScene, this.camera)
    }

    updateGeometryContourBuffer() {

        let normalRenderBuffer = this.normalRender(this.renderer, this.scene, this.camera);
        this.normalBufferUniform.value = normalRenderBuffer.texture;

        let depthRenderBuffer = this.depthRender(this.renderer, this.scene, this.camera);
        this.depthBufferUniform.value = depthRenderBuffer.texture;

        if(this.applyWireframeLimit.value){
            let wireframeRenderBuffer = this.wireframeRender(this.renderer, this.scene, this.camera);
            this.wireFrameBufferUniform.value = wireframeRenderBuffer.texture
        }

        const canvas = this.renderer.domElement;
        //this.resolutionUniform.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this.resolutionUniform.value = new THREE.Vector2(canvas.width, canvas.height);
    }

    updateContourScene() {
        // 1. Dispose of everything in the contourScene and clear it
        if (normalScene) {
            removeAllMesh(normalScene)
        }
        if(depthScene){
            removeAllMesh(depthScene)
        }
        if(wireFrameScene){
            removeAllMesh(wireFrameScene)
        }
        
        // 2. Copy every mesh from this.scene to normalScene and depthScene
        this.scene.traverse((object) => {
            if (object.isMesh) {
                // Clone the mesh and add it to normalScene and depthScene
                const meshCloneNormal = object.clone();
                const meshCloneDepth = object.clone();
                const meshCloneWire = object.clone();

                //compute normal material
                meshCloneNormal.material = new THREE.MeshNormalMaterial({})
                normalScene.add(meshCloneNormal);

                //compute depth material
                meshCloneDepth.material = new THREE.MeshDepthMaterial({})
                depthScene.add(meshCloneDepth);

                //update wireframe scene
                meshCloneWire.material = new THREE.MeshBasicMaterial({wireframe: true , wireframeLinewidth: 0.1})
                wireFrameScene.add(meshCloneWire)
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
        renderer.setRenderTarget(normalRenderTarget);
        //renderer.render(scene, camera);
        renderer.render(normalScene, camera);
        renderer.setRenderTarget(null);

        return normalRenderTarget;
    }

    depthRender(renderer, scene, camera){
        renderer.setRenderTarget(depthRenderTarget);
        //renderer.render(scene, camera);
        renderer.render(depthScene, camera);
        renderer.setRenderTarget(null);

        return depthRenderTarget;
    }

    wireframeRender(renderer, scene, camera){
        renderer.setRenderTarget(wireframeRenderTarget);
        //renderer.render(scene, camera);
        renderer.render(wireFrameScene, camera);
        renderer.setRenderTarget(null);

        return wireframeRenderTarget;
    }

    






    addDebugFolder(){
        this.debug_folder = window.debug_ui.addFolder('线框调试')

        this.debug_folder.add(this.normalThrsholdUniform, 'value')
            .min(0.001)
            .max(0.2)
            .step(0.001)
            //.name('法向量差异因子')
            .name('朝向差异因子')

        this.debug_folder.add(this.depthThrsholdUniform, 'value')
            .min(0.001)
            .max(0.2)
            .step(0.001)
            //.name('深度差异因子')
            .name('距离差异因子')

        this.debug_folder.add(this.accuracyUniform, 'value', Accuracy_Option)
            //.name('临近比对点数量')
            .name('准确度')
            .onChange(value => {
                console.log('Accuracy changed to:', value);

            });

        this.debug_folder.add(this.neighbourDistUniform, 'value')
            .min(0.05)
            .max(3.0)
            .step(0.001)
            //.name('相邻检测距离')
            .name('线粗因子')

        this.debug_folder.add(this.applyToModelUniform, 'value')
            .name('按模型图元渲染')

        this.debug_folder.add(this.applyWireframeLimit, 'value')
            .name('网格限粗(帧数影响大)')
    }
}
