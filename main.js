import * as THREE from 'three'
import GUI from 'lil-gui'
import Stats from 'stats.js'
import { EffectComposer, GLTFLoader, OrbitControls, RenderPass, ShaderPass, GammaCorrectionShader, SMAAPass } from 'three/examples/jsm/Addons.js';

import { NormalExpansion, ScaleExpansion } from './src/NormalExpension.js'
import { flexableRender, removeAllMesh } from './util/UtilFunctions.js'
// import { GeometryContourEffect, updateGeometryContourBuffer } from './src/GeometryContour.js';
import GeometryContourPass from './src/GeometryContourPass.js'


const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);


const modelLinks = {
	TEST_1 : './static/Models/LineTest1.glb',
	TEST_2 : './static/Models/LineTest2.glb',
	TEST_3 : './static/Models/LineTest3.glb',
	FUDAN_1 : './static/Models/FuDanShow_Fix2.glb',
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
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
	pixelRatio: Math.min(window.devicePixelRatio, 2)
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

const geometryContourPass = new GeometryContourPass(renderer, scene, camera)
composer.addPass(geometryContourPass)

// const smaaPass = new SMAAPass(sizes.width, sizes.height)
// composer.addPass(smaaPass)

const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
composer.addPass(gammaCorrectionPass)


//light
let ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

//model
let gltfLoader = new GLTFLoader()

function loadAndApplyFilter( modelSrc ){
	gltfLoader.load(
		modelSrc, 
		(gltf)=>{
			console.log(gltf)
			scene.add(gltf.scene)
	 
			geometryContourPass.updateContourScene()
			//ScaleExpansion(gltf.scene, scene)
			//NormalExpansion(gltf.scene, scene)
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
	sizes.pixelRatio = Math.min(window.devicePixelRatio , 2)

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