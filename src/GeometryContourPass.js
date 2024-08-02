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
    constructor(renderer, scene, camera, ignoreList) {
        super();
        this.renderer = renderer;
        this.scene = scene;
        this.sceneCamera = camera;
        
        // Initialize uniforms
        this.resolutionUniform = resolutionUniform;
        this.normalThrsholdUniform = new THREE.Uniform(0.05);
        this.depthThrsholdUniform = new THREE.Uniform(0.05);
        this.colorThrsholdUniform = new THREE.Uniform(0.05);
        this.accuracyUniform = new THREE.Uniform(8);
        this.neighbourDistUniform = new THREE.Uniform(1.0);
        this.applyToModelUniform = new THREE.Uniform(false)
        
        // Shader material
        const customShader = {
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0.0 },

                uNormalRender: normalBufferUniform,
                uDepthRender: depthBufferUniform,

                uResolution: this.resolutionUniform,
                uPixelRatio: new THREE.Uniform(1.0),

                uNormalThrshold: this.normalThrsholdUniform,
                uDepthThrshold: this.depthThrsholdUniform,
                uColorThrshold: this.colorThrsholdUniform,

                uAccuracy: this.accuracyUniform,
                uNeighbourDist: this.neighbourDistUniform,
                uIsApplyToModel: this.applyToModelUniform,

                uShowDepthScene: new THREE.Uniform(false),
                uShowNormalScene: new THREE.Uniform(false),
                uShowColorScene: new THREE.Uniform(false),

                uShouldDepthCaluclation: new THREE.Uniform(true),
                uShouldNormalCaluclation: new THREE.Uniform(true),
                uShouldColorCaluclation: new THREE.Uniform(true),
            },
            vertexShader: /* glsl */`
                precision highp float;

                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                precision highp float;

                uniform float time;
                uniform sampler2D tDiffuse;

                uniform sampler2D uNormalRender;
                uniform sampler2D uDepthRender;

                uniform vec2 uResolution;
                uniform float uPixelRatio;

                uniform float uNormalThrshold;
                uniform float uDepthThrshold;
                uniform float uColorThrshold;

                uniform float uNeighbourDist;
                uniform int uAccuracy;
                
                uniform bool uIsApplyToModel;
                uniform bool uApplyWireframe;

                uniform bool uShowDepthScene;
                uniform bool uShowNormalScene;
                uniform bool uShowColorScene;

                uniform bool uShouldDepthCaluclation;
                uniform bool uShouldNormalCaluclation;
                uniform bool uShouldColorCaluclation;

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

                float calculateColorDistance(vec2 centerUV, vec2 neighbourUV) {
                    vec3 normalCenter = texture2D(tDiffuse, centerUV).rgb;
                    vec3 normalNeighbour = vec3(0.0);

                    if (neighbourUV.x >= 0.0 && neighbourUV.x <= 1.0 && neighbourUV.y >= 0.0 && neighbourUV.y <= 1.0) {
                        normalNeighbour = texture2D(tDiffuse, neighbourUV).rgb;
                    }
                
                    return distance(normalCenter, normalNeighbour);
                }

                /**
                 * mode
                 *  Mode 1 Normal
                 *  Mode 2 Depth
                 *  Mode 3 Color
                 * lineThickFactor: how thick is the line
                 * accuracy: how many neighbour is used
                 *  4
                 *  8
                 */
                float calculateAverageDistence(int mode, float lineThickFactor, int accuracy, vec2 uv){

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
                    else if(mode == 3){
                        for(int i=0; i<accuracy; i++){
                            distances[i] = calculateColorDistance(uv, checkPosition[i]);
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
                    if(uIsApplyToModel){
                        uv = gl_FragCoord.xy / uResolution * uPixelRatio;
                    }
                    vec3 color = vec3(1.0, 1.0, 1.0);
                    float pixelLight = 1.0;
                    
                    //normal line
                    if(uShouldNormalCaluclation){
                        float normalAverage = calculateAverageDistence(1, uNeighbourDist, uAccuracy, uv);
                        if (normalAverage > uNormalThrshold) pixelLight = 0.0;
                        color = vec3(pixelLight);
                    }

                    //depth line
                    if(uShouldDepthCaluclation){
                        float depthAverage = calculateAverageDistence(2, uNeighbourDist, uAccuracy, uv);
                        depthAverage *= 10.0;
                        if (depthAverage > uDepthThrshold) pixelLight = 0.0;
                        color = vec3(pixelLight);
                    }

                    //color line
                    if(uShouldColorCaluclation){
                        float colorAverage = calculateAverageDistence(3, uNeighbourDist, uAccuracy, uv);
                        if (colorAverage > uColorThrshold) pixelLight = 0.0;
                        color = vec3(pixelLight);
                    }

                    gl_FragColor = vec4(color, 1.0);
                    if( uShowNormalScene ) gl_FragColor = texture2D(uNormalRender, uv);
                    if( uShowColorScene ) gl_FragColor = texture2D(tDiffuse, uv);
                    if( uShowDepthScene ) gl_FragColor = texture2D(uDepthRender, uv);
                         
                }
            `
        };
        this.customShader = customShader
        this.material = new THREE.ShaderMaterial(customShader);
        this.fsQuad = new FullScreenQuad( this.material );

        this.addDebugFolder()
        
        // window.addEventListener('resize', () => {
        //     this.updateContourScene()
        // })
        
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

        //this.renderer.render(outputScene, this.sceneCamera)
    }

    updateGeometryContourBuffer() {

        let renderSize = new THREE.Vector2()
        const canvas = this.renderer.domElement;
        this.renderer.getSize(renderSize)
        const pixelRatio = this.renderer.getPixelRatio();

        normalRenderTarget.setSize(canvas.width * pixelRatio, canvas.height * pixelRatio);
        this.normalRender(this.renderer, this.scene, this.sceneCamera);
        normalBufferUniform.value = normalRenderTarget.texture;

        depthRenderTarget.setSize(canvas.width * pixelRatio, canvas.height * pixelRatio);
        this.depthRender(this.renderer, this.scene, this.sceneCamera);
        depthBufferUniform.value = depthRenderTarget.texture;

        this.resolutionUniform.value = new THREE.Vector2(canvas.width * pixelRatio, canvas.height * pixelRatio);
        this.customShader.uniforms.uPixelRatio.value = pixelRatio
    }

    updateContourScene() {
        // 1. Dispose of everything in the contourScene and clear it
        if (normalScene) {
            removeAllMesh(normalScene)
        }
        if(depthScene){
            removeAllMesh(depthScene)
        }
        
        // 2. Copy every mesh from this.scene to normalScene and depthScene
        this.scene.traverse((object) => {
            if (object.isMesh) {
                // Clone the mesh and add it to normalScene and depthScene
                const meshCloneNormal = object.clone();
                const meshCloneDepth = object.clone();
                const meshCloneOutput = object.clone();

                 // Update world matrix
                object.updateMatrixWorld(true);

                // Apply the world matrix to the cloned mesh
                meshCloneNormal.applyMatrix4(object.matrixWorld);
                meshCloneDepth.applyMatrix4(object.matrixWorld);
                meshCloneOutput.applyMatrix4(object.matrixWorld);

                //compute normal material
                meshCloneNormal.material = new THREE.MeshNormalMaterial({})
                normalScene.add(meshCloneNormal);

                //compute depth material
                meshCloneDepth.material = new THREE.MeshDepthMaterial({})
                depthScene.add(meshCloneDepth);
            }
        });
    }

    normalRender(renderer, scene, camera) {
        renderer.setRenderTarget(normalRenderTarget);
        //renderer.render(scene, camera);
        renderer.render(normalScene, camera);
        renderer.setRenderTarget(null);
    }

    depthRender(renderer, scene, camera){
        renderer.setRenderTarget(depthRenderTarget);
        //renderer.render(scene, camera);
        renderer.render(depthScene, camera);
        renderer.setRenderTarget(null);
    }

    






    addDebugFolder(){
        this.debug_folder = window.debug_ui.addFolder('线框调试')

        this.debug_folder.add(this.normalThrsholdUniform, 'value')
            .min(0.001)
            .max(0.2)
            .step(0.001)
            .name('法向量差异因子')

        this.debug_folder.add(this.customShader.uniforms.uShowNormalScene, 'value')
            .name('法向量图')

        this.debug_folder.add(this.customShader.uniforms.uShouldNormalCaluclation, 'value')
            .name('法向量参与计算')


        this.debug_folder.add(this.depthThrsholdUniform, 'value')
            .min(0.001)
            .max(0.2)
            .step(0.001)
            .name('深度差异因子')

        this.debug_folder.add(this.customShader.uniforms.uShowDepthScene, 'value')
            .name('深度图')

        this.debug_folder.add(this.customShader.uniforms.uShouldDepthCaluclation, 'value')
            .name('深度参与计算')


        this.debug_folder.add(this.colorThrsholdUniform, 'value')
            .min(0.001)
            .max(0.2)
            .step(0.001)
            .name('颜色差异因子')

        this.debug_folder.add(this.customShader.uniforms.uShowColorScene, 'value')
            .name('色差图')

        this.debug_folder.add(this.customShader.uniforms.uShouldColorCaluclation, 'value')
            .name('色差参与计算')


        this.debug_folder.add(this.accuracyUniform, 'value', Accuracy_Option)
            .name('临近比对点数量')
            .onChange(value => {
                console.log('Accuracy changed to:', value);

            });

        this.debug_folder.add(this.neighbourDistUniform, 'value')
            .min(0.05)
            .max(3.0)
            .step(0.001)
            .name('相邻检测距离')

        this.debug_folder.add(this.applyToModelUniform, 'value')
            .name('按模型图元渲染')
    }
}
