/**
 * SceneSetup.js
 * 场景初始化：renderer、camera、scene、lights、材质、GUI、controls、raycaster、resize
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// ---- CSS 样式 ----
const guiStyle = document.createElement('style');
guiStyle.textContent = `
    .lil-gui.root {
        transition: opacity 0.3s ease;
    }
    .lil-gui.root.folded {
        opacity: 0.3;
        transform: scale(0.8);
        transform-origin: top right;
    }
    .lil-gui.root.folded:hover {
        opacity: 0.8;
    }
    .lil-gui.root > .title > .close-button {
        background: rgba(255,255,255,0.1);
        border-radius: 50%;
        font-size: 14px;
        padding: 2px;
    }
    .lil-gui.root.mini-mode {
        opacity: 0.2;
        transform: scale(0.5);
        transform-origin: top right;
        width: 15px !important;
        height: 15px !important;
        overflow: hidden;
        border-radius: 50%;
    }
    .lil-gui.root.mini-mode:hover {
        opacity: 0.7;
        transform: scale(0.6);
    }
    .lil-gui.root.mini-mode > ul {
        display: none;
    }
    .lil-gui.root.mini-mode > .title {
        background: rgba(40, 40, 40, 0.3);
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2px !important;
        margin: 0 !important;
    }
    .lil-gui.root.mini-mode > .title > .name,
    .lil-gui.root.mini-mode > .title > .close-button {
        display: none !important;
    }
    .lil-gui.root.mini-mode > .title::after {
        content: "\\2699";
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
    }
`;
document.head.appendChild(guiStyle);

// ---- Scene ----
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ---- Camera ----
export const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 200);
camera.position.set(0, 0, 20);

// ---- 相机动画参数 ----
export const cameraParams = {
    autoCamera: true,
    currentPath: 'spiral',
    pathSpeed: 0.5,
    lookAtCenter: true,
    lookAtOffset: new THREE.Vector3(0, 0, 0),
    smoothTransition: true,
    transitionDuration: 2.0,
    cameraFov: 40,
    randomJump: false,
    jumpInterval: 10,
    pathWeight: 0.7,
};

// ---- 几何体 ----
export const geometry = new THREE.IcosahedronGeometry(1, 15);

// ---- 闪烁 & 材质参数 ----
export const params = {
    enableFlicker: false,
    flickerFrequency: 1.0,
    inactiveBrightness: 0.2,
    roughness: 0.1,
    metalness: 0.8,
    envMapIntensity: 1.0,
    lightIntensity: 2.0,
    lightDistance: 6.0,
    lightDecay: 1.0,
    focusTrackingEnabled: true,
    trackingBallSpeed: 3.0,
    trackingBallSize: 1.5,
    focusOffset: 0,
    trackingBallColor: '#ffffff',
    trackingBallEmissive: false,
    trackingBallEmissiveColor: '#ff3300',
    trackingBallShape: 'sphere',
    trackingBallRotate: true,
    trackingBallRotateSpeed: 1.0,
    trackingBallRotateAxis: 'y',
    floorVisible: true,
    floorSize: 100,
    floorHeight: -6,
    floorOpacity: 0.5,
    floorReflectivity: 0.4,
    floorTextureRepeat: 8,
    floorBrightness: 2.0,
    customFocusEnabled: false,
    customFocusBallIndex: -1,
    customFocusOffset: 0.0,
    enableClickLight: false,
    enableStepperSync: true,
    stepperFlickerIntensity: 4.0,
    stepperFlickerDuration: 0.5,
    rememberStepperPattern: true,
};

// ---- Renderer ----
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const threeContainer = document.getElementById('three-container');
if (threeContainer) {
    threeContainer.appendChild(renderer.domElement);
} else {
    console.warn('three-container not found, falling back to document.body');
    document.body.appendChild(renderer.domElement);
}

// ---- PMREMGenerator ----
export const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// ---- Lights ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
camera.add(pointLight);
scene.add(camera);

const createColorLight = (color, intensity, position) => {
    const light = new THREE.PointLight(color, intensity, 10, 1.5);
    light.position.set(...position);
    scene.add(light);
    return light;
};

export const light1 = createColorLight(0x3366ff, 0.3, [8, 3, 3]);
export const light2 = createColorLight(0xff3366, 0.3, [-8, -3, 3]);
export const light3 = createColorLight(0x33ff66, 0.3, [0, 5, -5]);

// ---- Controls ----
export const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// ---- Raycaster ----
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

// ---- Clock ----
export const clock = new THREE.Clock();

// ---- GUI ----
export const gui = new GUI();
gui.close();
gui.domElement.style.display = 'none';

let guiMiniMode = false;
let guiLastState = 'folded';

gui.toggleMiniMode = function () {
    const el = this.domElement;
    if (guiMiniMode) {
        el.classList.remove('mini-mode');
        if (guiLastState === 'folded') this.close();
        else this.open();
        guiMiniMode = false;
    } else {
        guiLastState = this.closed ? 'folded' : 'normal';
        el.classList.add('mini-mode');
        guiMiniMode = true;
    }
    return this;
};

const guiElement = gui.domElement;
const titleElement = guiElement.querySelector('.title');

titleElement.addEventListener('click', function (e) {
    if (!e.target.classList.contains('close-button')) {
        gui.toggleMiniMode();
        e.stopPropagation();
    }
});

const originalClose = gui.close;
const originalOpen = gui.open;

gui.close = function () {
    if (!guiMiniMode) {
        guiElement.classList.add('folded');
        originalClose.call(this);
    }
    return this;
};

gui.open = function () {
    guiElement.classList.remove('folded');
    originalOpen.call(this);
    return this;
};

gui.add({ toggleMini: () => gui.toggleMiniMode() }, 'toggleMini').name('切换迷你模式 (单击标题)');

// ---- Resize ----
export function onWindowResize() {
    const container = document.getElementById('three-container');
    let width, height;
    if (container) {
        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
    } else {
        width = window.innerWidth;
        height = window.innerHeight;
    }
    if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    if (renderer) {
        renderer.setSize(width, height);
    }
    return { width, height };
}

window.addEventListener('resize', onWindowResize, false);
