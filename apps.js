// ==========================================================
// MetaHuman Face Animator
// Partie 1 : Initialisation Three.js
// ==========================================================

// ---------- Interface ----------
const container = document.getElementById("canvas-container");
const loadingInfo = document.getElementById("loading-info");
const progressBar = document.getElementById("progress");

// ---------- Variables globales ----------
let avatar = null;
let faceMeshes = [];
let morphTargetDict = {};

const clock = new THREE.Clock();

// ==========================================================
// Renderer
// ==========================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false
});

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputEncoding = THREE.sRGBEncoding;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// ==========================================================
// Scene
// ==========================================================

const scene = new THREE.Scene();

scene.background = null;

// ==========================================================
// Camera
// ==========================================================

const camera = new THREE.PerspectiveCamera(

40,

window.innerWidth / window.innerHeight,

0.01,

100

);

camera.position.set(

0,

0,

2.2

);

// ==========================================================
// Lights
// ==========================================================

// Lumière ambiante

const hemiLight = new THREE.HemisphereLight(

0xffffff,

0x404040,

2.0

);

scene.add(hemiLight);

// Lumière principale

const keyLight = new THREE.DirectionalLight(

0xffffff,

2.5

);

keyLight.position.set(

2,

3,

3

);

keyLight.castShadow = true;

scene.add(keyLight);

// Lumière de remplissage

const fillLight = new THREE.DirectionalLight(

0xffffff,

1.0

);

fillLight.position.set(

-3,

1,

2

);

scene.add(fillLight);

// Contre-jour

const rimLight = new THREE.DirectionalLight(

0xffffff,

0.6

);

rimLight.position.set(

0,

2,

-3

);

scene.add(rimLight);

// ==========================================================
// Loader GLB
// ==========================================================

const loader = new THREE.GLTFLoader();

loader.setCrossOrigin("anonymous");

// Remplace par ton modèle
const MODEL_PATH = "assets/MetaHuman.glb";

loader.load(

MODEL_PATH,

(gltf)=>{

    avatar = gltf.scene;

    avatar.position.set(

        0,

        -1,

        0

    );

    avatar.scale.set(

        1,

        1,

        1

    );

    scene.add(avatar);

    // Recherche automatique des meshes

    avatar.traverse((child)=>{

        if(child.isMesh){

            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;

            if(child.morphTargetDictionary){

                faceMeshes.push(child);

                console.log(
                    "Mesh détecté :",
                    child.name
                );

                console.log(
                    child.morphTargetDictionary
                );

            }

        }

    });

    loadingInfo.textContent =
        "Modèle chargé";

    document.getElementById("loader").style.display =
        "none";

},

(xhr)=>{

    if(xhr.total){

        const percent = Math.round(

            xhr.loaded / xhr.total * 100

        );

        progressBar.value = percent;

        loadingInfo.textContent =
            "Chargement : " +
            percent +
            "%";

    }

},

(error)=>{

    console.error(error);

    loadingInfo.textContent =
        "Impossible de charger le GLB.";

}

);

// ==========================================================
// Resize
// ==========================================================

window.addEventListener(

"resize",

()=>{

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(

        window.innerWidth,

        window.innerHeight

    );

}

);

// ==========================================================
// FPS
// ==========================================================

let fpsCounter = document.getElementById("fps");

let lastTime = performance.now();

let frames = 0;

function updateFPS(){

    frames++;

    let now = performance.now();

    if(now-lastTime>=1000){

        fpsCounter.textContent = frames;

        frames = 0;

        lastTime = now;

    }

}

// ==========================================================
// Render
// ==========================================================

function render(){

    requestAnimationFrame(render);

    updateFPS();

    renderer.render(

        scene,

        camera

    );

}

render();







// ==========================================================
// PARTIE 2 : MediaPipe Face Landmarker
// ==========================================================

// ---------- Interface ----------
const video = document.getElementById("webcam");
const startBtn = document.getElementById("startBtn");
const blendCounter = document.getElementById("blendCount");

// ---------- Variables ----------
let faceLandmarker = null;
let webcamRunning = false;
let lastVideoTime = -1;

// Lissage des blendshapes
const smoothValues = {};

function smooth(name, target, factor = 0.45){

    if(smoothValues[name] === undefined){

        smoothValues[name] = target;

    }

    smoothValues[name] +=
        (target - smoothValues[name]) * factor;

    return smoothValues[name];

}

// ==========================================================
// Initialisation MediaPipe
// ==========================================================

async function initMediaPipe(){

    loadingInfo.textContent =
        "Initialisation MediaPipe...";

    const vision =
    await window.FilesetResolver.forVisionTasks(

        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"

    );

    faceLandmarker =
    await window.FaceLandmarker.createFromOptions(

        vision,

        {

            baseOptions:{

                modelAssetPath:

                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

                delegate:"GPU"

            },

            runningMode:"VIDEO",

            numFaces:1,

            outputFaceBlendshapes:true,

            outputFacialTransformationMatrixes:true

        }

    );

    loadingInfo.textContent =
        "MediaPipe prêt";

    startBtn.disabled = false;

}

initMediaPipe();

// ==========================================================
// Webcam
// ==========================================================

startBtn.addEventListener(

"click",

async()=>{

    if(webcamRunning) return;

    try{

        const stream =
        await navigator.mediaDevices.getUserMedia({

            video:{
                facingMode:"user",
                width:{ideal:640},
                height:{ideal:480}
            },

            audio:false

        });

        video.srcObject = stream;

        await video.play();

        webcamRunning = true;

        startBtn.style.display = "none";

        predict();

    }

    catch(error){

        alert(error.message);

    }

});

// ==========================================================
// Blendshapes
// ==========================================applyBlendshapeso
// ==========================================================
// Rotation tête
// ==========================================================

function applyHeadRotation(matrixData){

    if(!avatar) return;

    const matrix =
    new THREE.Matrix4();

    matrix.fromArray(matrixData);

    const quaternion =
    new THREE.Quaternion();

    quaternion.setFromRotationMatrix(matrix);

    avatar.quaternion.slerp(

        quaternion,

        0.25

    );

}

// ==========================================================
// Boucle MediaPipe
// ==========================================================

function predict(){

    if(!webcamRunning){

        return;

    }

    if(video.currentTime !== lastVideoTime){

        lastVideoTime = video.currentTime;

        const results =

        faceLandmarker.detectForVideo(

            video,

            performance.now()

        );

        if(

            results.faceBlendshapes &&
            results.faceBlendshapes.length

        ){

            applyBlendshapesOptimized(   
                results.faceBlendshapes

            );

        }

        if(

            results.facialTransformationMatrixes &&
            results.facialTransformationMatrixes.length

        ){

            smoothRotation(

                results.facialTransformationMatrixes[0].data

            );

        }

    }

    requestAnimationFrame(predict);

}




// ==========================================================
// PARTIE 3A : Mapping ARKit -> GLB
// ==========================================================

// Les 52 blendshapes ARKit
const ARKIT_BLENDSHAPES = [

"browDownLeft",
"browDownRight",
"browInnerUp",
"browOuterUpLeft",
"browOuterUpRight",

"cheekPuff",
"cheekSquintLeft",
"cheekSquintRight",

"eyeBlinkLeft",
"eyeBlinkRight",

"eyeLookDownLeft",
"eyeLookDownRight",

"eyeLookInLeft",
"eyeLookInRight",

"eyeLookOutLeft",
"eyeLookOutRight",

"eyeLookUpLeft",
"eyeLookUpRight",

"eyeSquintLeft",
"eyeSquintRight",

"eyeWideLeft",
"eyeWideRight",

"jawForward",
"jawLeft",
"jawOpen",
"jawRight",

"mouthClose",

"mouthDimpleLeft",
"mouthDimpleRight",

"mouthFrownLeft",
"mouthFrownRight",

"mouthFunnel",

"mouthLeft",

"mouthLowerDownLeft",
"mouthLowerDownRight",

"mouthPressLeft",
"mouthPressRight",

"mouthPucker",

"mouthRight",

"mouthRollLower",
"mouthRollUpper",

"mouthShrugLower",
"mouthShrugUpper",

"mouthSmileLeft",
"mouthSmileRight",

"mouthStretchLeft",
"mouthStretchRight",

"mouthUpperUpLeft",
"mouthUpperUpRight",

"noseSneerLeft",
"noseSneerRight",

"tongueOut"

];

// ==========================================================
// Correspondances personnalisées
// ==========================================================

const CUSTOM_MAPPING = {

};

// ==========================================================
// Fonction utilitaire
// ==========================================================

function normalizeName(name){

    return name
    .toLowerCase()
    .replace(/[_\-\s]/g,"");

}

// ==========================================================
// Création automatique du mapping
// ==========================================================

let blendshapeMapping = {};

function buildBlendshapeMapping(){

    blendshapeMapping = {};

    faceMeshes.forEach(mesh=>{

        const dict = mesh.morphTargetDictionary;

        Object.keys(dict).forEach(glbName=>{

            const normalizedGLB =
            normalizeName(glbName);

            ARKIT_BLENDSHAPES.forEach(arkit=>{

                const normalizedARKIT =
                normalizeName(arkit);

                if(normalizedGLB === normalizedARKIT){

                    blendshapeMapping[arkit] =
                    glbName;

                }

            });

        });

    });

    // Ajout des correspondances manuelles

    Object.keys(CUSTOM_MAPPING).forEach(key=>{

        blendshapeMapping[key] =
        CUSTOM_MAPPING[key];

    });

    console.log(
        "Mapping généré :",
        blendshapeMapping
    );

}

// ==========================================================
// Appeler après le chargement du GLB
// ==========================================================

// buildBlendshapeMapping();




// ==========================================================
// PARTIE 3B : Optimisations Haute Performance
// ==========================================================

// ------------------------------
// Configuration
// ------------------------------

const SETTINGS = {

    // Intensité du lissage (0.0 -> 1.0)
    smoothing: 0.45,

    // FPS maximum de MediaPipe
    maxTrackingFPS: 30,

    // Ignorer les très petites valeurs
    minBlendshapeValue: 0.01,

    // Interpolation rotation
    rotationSmoothing: 0.20,

    // Interpolation blendshapes
    blendshapeSmoothing: 0.45

};

// ------------------------------
// Cache
// ------------------------------

const blendshapeCache = {};

const previousRotation =
new THREE.Quaternion();

let lastTrackingTime = 0;

// ==========================================================
// Filtrage des BlendShapes
// ==========================================================

function filterBlendshape(name, value){

    if(value < SETTINGS.minBlendshapeValue){

        value = 0;

    }

    if(blendshapeCache[name] === undefined){

        blendshapeCache[name] = value;

    }

    blendshapeCache[name] +=

        (value - blendshapeCache[name])

        *

        SETTINGS.blendshapeSmoothing;

    return blendshapeCache[name];

}

// ==========================================================
// Rotation fluide
// ==========================================================

function smoothRotation(matrixData){

    if(!avatar) return;

    const matrix =
    new THREE.Matrix4();

    matrix.fromArray(matrixData);

    const target =
    new THREE.Quaternion();

    target.setFromRotationMatrix(matrix);

    previousRotation.slerp(

        target,

        SETTINGS.rotationSmoothing

    );

    avatar.quaternion.copy(

        previousRotation

    );

}

// ==========================================================
// Application optimisée
// ==========================================================

function applyBlendshapesOptimized(blendshapes){

    if(faceMeshes.length===0) return;

    const categories =
    blendshapes[0].categories;

    faceMeshes.forEach(mesh=>{

        const dict =
        mesh.morphTargetDictionary;

        const influences =
        mesh.morphTargetInfluences;

        for(let i=0;i<categories.length;i++){

            const shape =
            categories[i];

            const glbName =
            blendshapeMapping[
                shape.categoryName
            ];

            if(!glbName) continue;

            const index =
            dict[glbName];

            if(index===undefined) continue;

            influences[index]=

            filterBlendshape(

                shape.categoryName,

                shape.score

            );

        }

    });

}

// ==========================================================
// Limitation FPS Tracking
// ==========================================================

function canTrack(){

    const now = performance.now();

    if(

        now-lastTrackingTime

        <

        1000/SETTINGS.maxTrackingFPS

    ){

        return false;

    }

    lastTrackingTime = now;

    return true;

}

// ==========================================================
// Optimisation Renderer
// ==========================================================

renderer.setAnimationLoop(()=>{

    renderer.render(

        scene,

        camera

    );

});
