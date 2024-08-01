import * as THREE from 'three'
import GUI from 'lil-gui'
import Stats from 'stats.js'
import { EffectComposer, GLTFLoader, OrbitControls, RenderPass, ShaderPass, GammaCorrectionShader, SMAAPass, FXAAShader } from 'three/examples/jsm/Addons.js';

import { NormalExpansion, ScaleExpansion } from './src/NormalExpension.js'
import { flexableRender, loadVideoToScreen, removeAllMesh } from './util/UtilFunctions.js'
// import { GeometryContourEffect, updateGeometryContourBuffer } from './src/GeometryContour.js';
import GeometryContourPass from './src/GeometryContourPass.js'
import GeometryLinePass from './src/GeometryLinePass.js';


const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);


const modelLinks = {
	TEST_1 : './static/Models/LineTest1.glb',
	TEST_2 : './static/Models/LineTest2.glb',
	TEST_3 : './static/Models/LineTest3.glb',
	FUDAN_1 : './static/Models/FuDanShow_Fix2.glb',
	BYTE_1 : './static/Models/ByteDance.glb',
	CEIBS_1 : './static/Models/ceibs.glb',
}
const RenderTypes = {

}

//global
window.hultRender = false

//debug
window.debug_ui = new GUI()
window.debug_param = {
	selectedModel: Object.keys(modelLinks)[0]
}




//info 
const MIN_PIXEL_RATIO = 2
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
	pixelRatio: Math.min(window.devicePixelRatio, MIN_PIXEL_RATIO)
}

const canvas = document.querySelector('canvas.webgl')



//scene
let scene = new THREE.Scene()
scene.background = new THREE.Color( 0.5, 0.6, 0.5 );

//scene.add(new THREE.AxesHelper(5.0))

//camera
let camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 1, 1000);
camera.position.set(10.5, 10.5, 15.0)
scene.add(camera)

let orbitControl = new OrbitControls(camera, canvas)

//renderer
let renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true
})
renderer.setClearColor(0xaaaaaa)
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)


// Set up EffectComposer and RenderPass
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// const geometryContourShaderPass = GeometryContourEffect(renderer, scene, camera)
// composer.addPass(geometryContourShaderPass)

// const smaaPass = new SMAAPass(sizes.width, sizes.height)
// composer.addPass(smaaPass)

const geometryContourPass = new GeometryContourPass(renderer, scene, camera)
composer.addPass(geometryContourPass)

// const geometryLinePass = new GeometryLinePass(renderer, scene, camera)
// composer.addPass(geometryLinePass)

// const fxaaPass = new ShaderPass(FXAAShader)
// composer.addPass(fxaaPass)

const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
composer.addPass(gammaCorrectionPass)


//light
let ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

let directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
directionalLight.position.set(0.0, 10.0, 10.0)
scene.add(directionalLight)

//model
let gltfLoader = new GLTFLoader()

let flvPlayer = flvjs.createPlayer({
    type: 'flv',
    url: 'http://172.16.40.58:8080/live/test2.flv'
});

let vidSrc = './static/videos/屏幕录制 2024-08-01 131047.mp4'
let flvUrl = 'http://172.16.40.58:8080/live/test2.flv'

function loadAndApplyFilter( modelSrc ){
	gltfLoader.load(
		modelSrc, 
		(gltf)=>{
			console.log(gltf)
			scene.add(gltf.scene)
	 
			geometryContourPass.updateContourScene()
			//geometryLinePass.updateLineScene()
			//ScaleExpansion(gltf.scene, scene)
			//NormalExpansion(gltf.scene, scene)

			//add screen for ceibs
			// if(modelSrc == modelLinks.CEIBS_1){
			// 	scene.traverse((child) => {
			// 		if(child.isMesh && child.name.includes('Screen')){
			// 			child.scale.z *= -1.0
			// 			if(child.name.includes('2')) loadVideoToScreen(child, vidSrc , false)
			// 			else loadVideoToScreen(child, vidSrc , true)
			// 		}
			// 	})
				
			// }
		}
	)
}


loadAndApplyFilter(modelLinks.TEST_1)

//change model on the fly
window.debug_ui.add(window.debug_param, 'selectedModel', Object.keys(modelLinks))
    .name('Models')
    .onChange(value => {
		removeAllMesh(scene)
        const selectedLink = modelLinks[value];
        loadAndApplyFilter(selectedLink)
    });




window.addEventListener('resize', () =>
{
	sizes.width = window.innerWidth
	sizes.height = window.innerHeight
	sizes.pixelRatio = Math.min(window.devicePixelRatio , MIN_PIXEL_RATIO)

	camera.aspect = sizes.width / sizes.height
	camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)

})



//render loop
const tick = () => {

	stats.begin()

	orbitControl.update()
	 
	//composer.render()
	flexableRender(composer, renderer)

	stats.end() 

	window.requestAnimationFrame(tick)
}
tick()