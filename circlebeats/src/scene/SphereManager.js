/**
 * SphereManager.js
 * 小球创建、激活动画、颜色管理、光源管理、焦点跟踪
 */
import * as THREE from 'three';
import {
    scene, camera, geometry, params,
    clock, raycaster, mouse,
} from './SceneSetup.js';
import { bokehPass, bokehParams } from './PostProcessing.js';
export { trackingBall, createTrackingBall, updateTrackingBall } from './TrackingBall.js';
import { trackingBall } from './TrackingBall.js';

// ---- 小球数组 & 光源映射 ----
export const activeSpheres = [];
export const allSpheres = [];
export const sphereLights = new Map();

// ---- 创建小球 ----
for (let i = 0; i < 50; i++) {
    const color = new THREE.Color();
    color.setHSL(Math.random(), 0.7, 0.125);

    const material = new THREE.MeshStandardMaterial({
        color, emissive: color,
        emissiveIntensity: params.inactiveBrightness,
        roughness: params.roughness, metalness: params.metalness,
        envMapIntensity: params.envMapIntensity,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.x = Math.random() * 10 - 5;
    sphere.position.y = Math.random() * 10 - 5;
    sphere.position.z = Math.random() * 10 - 5;
    sphere.position.normalize().multiplyScalar(Math.random() * 4.0 + 2.0);
    sphere.scale.setScalar(Math.random() * Math.random() + 0.5);
    sphere.userData.active = false;
    sphere.userData.color = color.clone();
    sphere.userData.originalY = sphere.position.y;
    sphere.rotation.x = Math.random() * Math.PI;
    sphere.rotation.y = Math.random() * Math.PI;
    sphere.rotation.z = Math.random() * Math.PI;
    scene.add(sphere);
    allSpheres.push(sphere);
}

// ---- 光源管理 ----
export function createLightForSphere(sphere) {
    const color = sphere.userData.color.clone();
    const light = new THREE.PointLight(color, params.lightIntensity, params.lightDistance, params.lightDecay);
    light.position.copy(sphere.position);
    scene.add(light);
    sphereLights.set(sphere, light);
    return light;
}

export function removeLightForSphere(sphere) {
    if (sphereLights.has(sphere)) {
        scene.remove(sphereLights.get(sphere));
        sphereLights.delete(sphere);
    }
}

export function updateLights() {
    for (const [sphere, light] of sphereLights.entries()) {
        light.position.copy(sphere.position);
        if (params.enableFlicker) {
            light.intensity = sphere.material.emissiveIntensity * params.lightIntensity / 2;
        }
        light.distance = params.lightDistance;
        light.decay = params.lightDecay;
    }
}

// ---- 材质 & 亮度更新 ----
export function updateInactiveBrightness() {
    for (const sphere of allSpheres) {
        if (!sphere.userData.active) sphere.material.emissiveIntensity = params.inactiveBrightness;
    }
}

export function updateMaterialProperties() {
    for (const sphere of allSpheres) {
        sphere.material.roughness = params.roughness;
        sphere.material.metalness = params.metalness;
        sphere.material.envMapIntensity = params.envMapIntensity;
    }
}

export function updateLightParameters() {
    for (const [, light] of sphereLights.entries()) {
        light.intensity = params.lightIntensity;
        light.distance = params.lightDistance;
        light.decay = params.lightDecay;
    }
}

// ---- 焦点 & 高亮 ----
export function highlightCustomFocusBall() {
    for (let i = 0; i < allSpheres.length; i++) {
        const sphere = allSpheres[i];
        if (!sphere.userData.active && sphere.userData.wasHighlighted) {
            sphere.userData.wasHighlighted = false;
            sphere.material.emissiveIntensity = params.inactiveBrightness;
        }
    }
    if (!params.customFocusEnabled || params.customFocusBallIndex < 0 || params.customFocusBallIndex >= allSpheres.length) return;

    const sel = allSpheres[params.customFocusBallIndex];
    if (sel.userData.active) return;
    sel.userData.wasHighlighted = true;
    sel.material.emissiveIntensity = 0.5;
    if (!sel.userData.originalScale) sel.userData.originalScale = sel.scale.clone();
    sel.scale.copy(sel.userData.originalScale.clone().multiplyScalar(1.1));
}

export function updateFocus(time) {
    if (!bokehParams.enabled || !bokehPass) return;
    if (params.focusTrackingEnabled && trackingBall) {
        bokehPass.uniforms['focus'].value = camera.position.distanceTo(trackingBall.position) + params.focusOffset;
    } else if (params.customFocusEnabled && params.customFocusBallIndex >= 0 && params.customFocusBallIndex < allSpheres.length) {
        const fb = allSpheres[params.customFocusBallIndex];
        bokehPass.uniforms['focus'].value = camera.position.distanceTo(fb.position) + params.customFocusOffset;
    }
}

// ---- 激活 / 闪烁 ----
export function activateSphere(index, active) {
    if (index < 0 || index >= allSpheres.length) { console.warn(`无效的小球索引: ${index}`); return; }
    const sphere = allSpheres[index];
    if (active) {
        sphere.material.emissiveIntensity = params.stepperFlickerIntensity;
        sphere.material.emissive.copy(sphere.material.color);
        sphere.userData.active = true;
        if (!sphereLights.has(sphere)) createLightForSphere(sphere);
        if (!activeSpheres.includes(sphere)) activeSpheres.push(sphere);
        const t = clock.getElapsedTime();
        sphere.userData.lastFlickerTime = t;
        sphere.userData.flickerStartTime = t;
        sphere.userData.stepperControlled = true;
        sphere.userData.stepperActive = true;
    } else {
        sphere.material.emissiveIntensity = params.inactiveBrightness;
        sphere.userData.active = false;
        sphere.userData.stepperActive = false;
        removeLightForSphere(sphere);
        const idx = activeSpheres.indexOf(sphere);
        if (idx !== -1) activeSpheres.splice(idx, 1);
    }
}

export function flashSphere(index) {
    if (index < 0 || index >= allSpheres.length) { console.warn(`无效的小球索引: ${index}`); return; }
    const sphere = allSpheres[index];
    sphere.material.emissiveIntensity = params.stepperFlickerIntensity;
    sphere.userData.flickerStartTime = clock.getElapsedTime();
    sphere.userData.lastFlickerTime = sphere.userData.flickerStartTime;
}

// ---- Raycaster 点击 ----
let trackingFolder = null;
let customFocusController = null;
let ballSelector = null;

export function setTrackingFolder(folder) { trackingFolder = folder; }
export function setCustomFocusController(ctrl) { customFocusController = ctrl; }
export function setBallSelector(sel) { ballSelector = sel; }

window.addEventListener('pointerdown', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(allSpheres, false);
    if (intersects.length === 0) return;

    const object = intersects[0].object;

    if (window.__clickToFocusEnabled) {
        const index = allSpheres.indexOf(object);
        if (index !== -1) {
            params.customFocusBallIndex = index;
            if (!params.customFocusEnabled) {
                params.customFocusEnabled = true;
                if (params.focusTrackingEnabled) {
                    params.focusTrackingEnabled = false;
                    if (trackingFolder) {
                        for (const c of trackingFolder.controllers) {
                            if (c.property === 'focusTrackingEnabled') { c.updateDisplay(); break; }
                        }
                    }
                }
                if (customFocusController) customFocusController.updateDisplay();
            }
            if (ballSelector) ballSelector.updateDisplay();
            highlightCustomFocusBall();
            if (!event.ctrlKey && !event.metaKey) return;
        }
    }

    if (params.enableClickLight && object.material && object.material.emissiveIntensity !== undefined) {
        if (!object.userData.active) {
            object.material.emissiveIntensity = 2.0;
            object.material.emissive.copy(object.material.color);
            object.userData.active = true;
            activeSpheres.push(object);
            createLightForSphere(object);
        } else {
            object.material.emissiveIntensity = params.inactiveBrightness;
            object.material.emissive.copy(object.material.color);
            object.userData.active = false;
            removeLightForSphere(object);
            const idx = activeSpheres.indexOf(object);
            if (idx !== -1) activeSpheres.splice(idx, 1);
            if (params.customFocusEnabled && params.customFocusBallIndex !== -1
                && allSpheres[params.customFocusBallIndex] === object) {
                setTimeout(highlightCustomFocusBall, 10);
            }
        }
    }
});
