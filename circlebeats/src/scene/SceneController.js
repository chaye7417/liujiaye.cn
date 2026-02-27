/**
 * SceneController.js
 * 主控制器：animate 循环、帧率控制、showScene/hideScene、初始化序列
 */
import {
    params, cameraParams, renderer, controls, clock, gui, onWindowResize, light1, light2, light3,
} from './SceneSetup.js';
import {
    composer, bokehPass, bokehParams,
    updateSceneEnvironment, updateComposerSize, initPassOrder,
} from './PostProcessing.js';
import {
    activeSpheres, allSpheres, sphereLights,
    updateLights, createTrackingBall, updateTrackingBall,
    highlightCustomFocusBall, updateFocus, activateSphere, flashSphere,
} from './SphereManager.js';
import {
    activeCameraPath,
    createCameraPaths, generateAllCameraPaths, setCameraPath, updateCameraPosition,
} from './CameraAnimation.js';
import { createFloor } from './FloorScene.js';
import { cameraAutoController } from './GuiSetup.js';
import { setupStepperBalls, injectStepperCode } from './StepperIntegration.js';

// ---- 渲染控制 ----
let isRendering = true;

// ---- 帧率控制 ----
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;
let lastFrameTime = 0;

// ---- 环境反射更新控制 ----
let lastEnvUpdateTime = 0;
const ENV_UPDATE_INTERVAL = 5;

// ---- 微小动态效果 ----
function addSubtleMovement() {
    const time = clock.getElapsedTime() * 0.2;
    for (let i = 0; i < allSpheres.length; i++) {
        const sphere = allSpheres[i];
        const amplitude = 0.005 + (i % 5) * 0.001;
        const frequency = 0.2 + (i % 7) * 0.05;
        sphere.position.y = sphere.userData.originalY + Math.sin(time * frequency + i) * amplitude;
    }
    light1.color.setHSL((Math.sin(time * 0.3) + 1) * 0.5, 0.7, 0.5);
    light2.color.setHSL((Math.sin(time * 0.4 + 2) + 1) * 0.5, 0.7, 0.5);
    light3.color.setHSL((Math.sin(time * 0.5 + 4) + 1) * 0.5, 0.7, 0.5);
}

// ---- Animate 主循环 ----
function animate(currentTime) {
    if (!isRendering) return;
    requestAnimationFrame(animate);

    const delta = currentTime - lastFrameTime;
    if (delta < frameInterval) return;
    lastFrameTime = currentTime - (delta % frameInterval);

    const time = clock.getElapsedTime();

    if (time - lastEnvUpdateTime > ENV_UPDATE_INTERVAL) {
        updateSceneEnvironment();
        lastEnvUpdateTime = time;
    }

    // 闪烁逻辑
    if (activeSpheres.length > 0) {
        for (const sphere of activeSpheres) {
            if (!sphere.userData.active) continue;
            let flickerValue = 0;

            if (params.enableFlicker) {
                flickerValue = Math.abs(Math.sin(time * Math.PI * params.flickerFrequency));
            } else if (params.enableStepperSync && sphere.userData.flickerStartTime) {
                const elapsed = time - sphere.userData.flickerStartTime;
                if (elapsed < params.stepperFlickerDuration) {
                    flickerValue = Math.pow(1 - (elapsed / params.stepperFlickerDuration), 1.5);
                } else {
                    delete sphere.userData.flickerStartTime;
                }
            }

            if (flickerValue > 0) {
                const maxI = params.stepperFlickerIntensity;
                const normalI = 2.0;
                const intensity = normalI + flickerValue * (maxI - normalI);
                sphere.material.emissiveIntensity = intensity;
                if (sphereLights.has(sphere)) {
                    sphereLights.get(sphere).intensity = intensity * params.lightIntensity / 2;
                }
            } else if (!params.enableFlicker && !sphere.userData.flickerStartTime) {
                sphere.material.emissiveIntensity = 2.0;
                if (sphereLights.has(sphere)) {
                    sphereLights.get(sphere).intensity = params.lightIntensity;
                }
            }
        }
    }

    updateLights();
    addSubtleMovement();
    updateTrackingBall(time);
    updateCameraPosition(time);
    updateFocus(time);
    controls.update();
    composer.render();
}

// ---- 启动 / 停止渲染 ----
function startRendering() {
    if (!isRendering) {
        isRendering = true;
        requestAnimationFrame(animate);
    }
}

function stopRendering() {
    isRendering = false;
}

// ---- 场景显示/隐藏 ----
let sceneVisible = true;

export function hideScene() {
    if (renderer) renderer.domElement.style.display = 'none';
    sceneVisible = false;
    stopRendering();
}

export function showScene() {
    if (renderer) renderer.domElement.style.display = 'block';
    sceneVisible = true;
    startRendering();
}

export function toggleSceneVisibility() {
    if (sceneVisible) hideScene();
    else { showScene(); if (!isRendering) startRendering(); }
    return sceneVisible;
}

// ---- Resize 扩展 ----
const _origResize = onWindowResize;
function handleResize() {
    const dims = _origResize();
    if (dims) updateComposerSize(dims.width, dims.height);
}
window.removeEventListener('resize', _origResize, false);
window.addEventListener('resize', handleResize, false);

// ---- 更新相机路径速度 ----
export function updateCameraPathSpeed(speed) {
    cameraParams.pathSpeed = speed;
    if (gui) {
        for (const folder of gui.folders) {
            if (folder._title === '运镜控制') {
                for (const ctrl of folder.controllers) {
                    if (ctrl.property === 'pathSpeed') { ctrl.updateDisplay(); break; }
                }
                break;
            }
        }
    }
}

export function setCameraAutoModeFromStepper(isPlaying) {
    cameraParams.autoCamera = isPlaying;
    if (isPlaying && !activeCameraPath) {
        generateAllCameraPaths();
        setCameraPath(cameraParams.currentPath);
    }
    if (cameraAutoController) {
        cameraAutoController.setValue(cameraParams.autoCamera);
        cameraAutoController.updateDisplay();
    }
}

// ---- ResizeObserver ----
if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => { handleResize(); });
    const container = document.getElementById('three-container');
    if (container) resizeObserver.observe(container);
}

window.resizeThreeScene = function () {
    requestAnimationFrame(() => { handleResize(); });
};

// ---- 初始化序列 ----
export function initScene() {
    updateSceneEnvironment();
    createFloor();
    createTrackingBall();
    createCameraPaths();
    generateAllCameraPaths();
    setCameraPath(cameraParams.currentPath);
    initPassOrder();

    if (params.customFocusEnabled && params.customFocusBallIndex >= 0) {
        params.focusTrackingEnabled = false;
        highlightCustomFocusBall();
    }

    setupStepperBalls();
    setTimeout(injectStepperCode, 1000);

    requestAnimationFrame(animate);
    showScene();
}
