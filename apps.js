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
const MODEL_PATH = "assets/metaHumanHead_52shapekeys_01.glb";

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
