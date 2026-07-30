// ================================
// CONFIGURATION HAUTE PERFORMANCE
// ================================

// Canvas
const container = document.getElementById("canvas-container");

// Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false
});

// Adaptation automatique
renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputColorSpace =
THREE.SRGBColorSpace;

renderer.toneMapping =
THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.1;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// ================================
// SCENE
// ================================

const scene = new THREE.Scene();

scene.background = null;

// ================================
// CAMERA
// ================================

const camera = new THREE.PerspectiveCamera(
40,
window.innerWidth/window.innerHeight,
0.01,
100
);

camera.position.set(
0,
0,
2.4
);

// ================================
// HORLOGE
// ================================

const clock = new THREE.Clock();

// ================================
// LUMIERES
// ================================

const hemi =
new THREE.HemisphereLight(
0xffffff,
0x222233,
2
);

scene.add(hemi);

const key =
new THREE.DirectionalLight(
0xffffff,
2.5
);

key.position.set(
2,
4,
4
);

key.castShadow = true;

scene.add(key);

const fill =
new THREE.DirectionalLight(
0xffffff,
1
);

fill.position.set(
-3,
2,
3
);

scene.add(fill);

const rim =
new THREE.DirectionalLight(
0xffffff,
0.7
);

rim.position.set(
0,
3,
-5
);

scene.add(rim);

// ================================
// CHARGEMENT GLB
// ================================

const loader =
new THREE.GLTFLoader();

loader.setCrossOrigin("anonymous");

let avatar;
let faceMeshes=[];

loader.load(

"assets/MetaHuman.glb",

(gltf)=>{

avatar = gltf.scene;

avatar.position.set(0,-1,0);

avatar.scale.setScalar(1);

scene.add(avatar);

avatar.traverse((child)=>{

if(child.isMesh){

child.frustumCulled=false;

child.castShadow=true;

child.receiveShadow=true;

if(child.morphTargetDictionary){

faceMeshes.push(child);

console.log(
child.name,
child.morphTargetDictionary
);

}

}

});

},

(xhr)=>{

const percent=
Math.round(
(xhr.loaded/xhr.total)*100
);

console.log(percent+"%");

},

(error)=>{

console.error(error);

}

);

// ================================
// SMOOTHING
// ================================

const smoothValues={};

function smoothValue(
name,
target,
speed=0.35
){

if(smoothValues[name]===undefined){

smoothValues[name]=target;

}

smoothValues[name]+=(
target-
smoothValues[name]
)*speed;

return smoothValues[name];

}

// ================================
// APPLICATION DES BLENDSHAPES
// ================================

function applyBlendshapes(categories){

faceMeshes.forEach(mesh=>{

const dict=
mesh.morphTargetDictionary;

const influences=
mesh.morphTargetInfluences;

categories.forEach(shape=>{

const index=
dict[shape.categoryName];

if(index!==undefined){

influences[index]=
smoothValue(
shape.categoryName,
shape.score
);

}

});

});

}

// ================================
// ROTATION
// ================================

function applyHeadPose(matrixData){

if(!avatar)return;

const matrix=
new THREE.Matrix4();

matrix.fromArray(matrixData);

const quat=
new THREE.Quaternion();

quat.setFromRotationMatrix(matrix);

avatar.quaternion.slerp(
quat,
0.25
);

}

// ================================
// RESIZE
// ================================

window.addEventListener(
"resize",
()=>{

camera.aspect=
window.innerWidth/
window.innerHeight;

camera.updateProjectionMatrix();

renderer.setSize(
window.innerWidth,
window.innerHeight
);

renderer.setPixelRatio(
Math.min(
window.devicePixelRatio,
2
)
);

}
);

// ================================
// RENDU
// ================================

function render(){

requestAnimationFrame(render);

const delta=
clock.getDelta();

// Ici seront ajoutés les résultats de MediaPipe
// applyBlendshapes(...)
// applyHeadPose(...)

renderer.render(
scene,
camera
);

}

render();
