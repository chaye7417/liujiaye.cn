/**
 * StepperIntegration.js
 * 步进器集成：stepper state、事件处理、syncBallWithStepper、
 * setupStepperBalls、injectStepperCode、rhythm 事件监听
 */
import { params, clock } from './SceneSetup.js';
import {
    allSpheres, activeSpheres, sphereLights,
    createLightForSphere, removeLightForSphere, activateSphere,
} from './SphereManager.js';

// ---- 步进器状态 ----
const stepperState = {
    lastBeat: -1,
    lastStep: -1,
    activePresets: new Set(),
    beatInterval: 500,
    stepCount: 16,
    isPlaying: false,
};

// ---- 处理步进器事件 ----
function handleStepperEvent(beat, step, preset, active) {
    const sphere = allSpheres[preset];
    if (!sphere) return;
    sphere.userData.stepperControlled = true;

    const wasActive = sphere.userData.active;
    const shouldBeActive = params.rememberStepperPattern
        ? stepperState.activePresets.has(preset)
        : active;

    if (shouldBeActive !== wasActive) {
        if (shouldBeActive) {
            sphere.material.emissiveIntensity = 2.0;
            sphere.material.emissive.copy(sphere.material.color);
            sphere.userData.active = true;
            sphere.userData.stepperActive = true;
            if (!activeSpheres.includes(sphere)) activeSpheres.push(sphere);
            if (!sphereLights.has(sphere)) createLightForSphere(sphere);
        } else {
            sphere.material.emissiveIntensity = params.inactiveBrightness;
            sphere.userData.active = false;
            sphere.userData.stepperActive = false;
            removeLightForSphere(sphere);
            const idx = activeSpheres.indexOf(sphere);
            if (idx !== -1) activeSpheres.splice(idx, 1);
        }
    }

    // 闪烁触发（防抖 0.3s）
    if (sphere.userData.active && active) {
        const currentTime = clock.getElapsedTime();
        if (!sphere.userData.lastFlickerTime || currentTime - sphere.userData.lastFlickerTime > 0.3) {
            sphere.userData.lastFlickerTime = currentTime;
            sphere.userData.flickerStartTime = currentTime;
            sphere.material.emissiveIntensity = params.stepperFlickerIntensity;
            setTimeout(() => {
                if (sphere && sphere.userData) {
                    sphere.material.emissiveIntensity = sphere.userData.active ? 2.0 : params.inactiveBrightness;
                }
            }, 300);
        }
    }
}

// ---- 全局同步接口 ----
window.syncBallWithStepper = function (beat, step, preset, active) {
    stepperState.lastBeat = beat;
    stepperState.lastStep = step;
    stepperState.isPlaying = true;
    if (active) stepperState.activePresets.add(preset);
    else stepperState.activePresets.delete(preset);

    if (params.enableStepperSync && allSpheres[preset]) {
        handleStepperEvent(beat, step, preset, active);
    }

    window.dispatchEvent(new CustomEvent('stepper-sync', {
        detail: { beat, step, preset, active, timestamp: performance.now() },
    }));
    return true;
};

// ---- 步进器小球设置 ----
export function setupStepperBalls() {
    if (allSpheres.length >= 8) {
        window.activatePresetSphere = function (presetIndex, active) {
            if (presetIndex >= 0 && presetIndex < 8) {
                activateSphere(presetIndex, active);
                return true;
            }
            return false;
        };

        const presetColors = [];
        for (let i = 0; i < 8; i++) {
            if (i < allSpheres.length) {
                presetColors.push(`#${allSpheres[i].material.color.getHexString()}`);
            }
        }
        window.dispatchEvent(new CustomEvent('threejs-integration-ready', {
            detail: { presetColors, timestamp: performance.now() },
        }));
    } else {
        console.warn('没有足够的小球来映射预设');
    }
}

// ---- 注入步进器代码（patch AudioSequencer.prototype.beat） ----
export function injectStepperCode() {
    const script = document.createElement('script');
    script.textContent = `
        const lastSyncTimes = new Map();
        const originalBeat = AudioSequencer.prototype.beat;
        AudioSequencer.prototype.beat = function() {
            originalBeat.call(this);
            if (this.isPlaying && typeof window.syncBallWithStepper === 'function') {
                const ui = window.ui || { stepCount: 16, currentPattern: 0 };
                const stepIndex = this.currentBeat % ui.stepCount;
                const beat = Math.floor(this.currentBeat / 4);
                const now = performance.now();
                const resIndex = ui.resolution ? ui.resolution.currentIndex : 3;
                const minInterval = [500, 400, 300, 200][resIndex] || 300;
                const presetPatterns = window.presetPatterns || [];
                for (let presetIndex = 0; presetIndex < presetPatterns.length; presetIndex++) {
                    if (presetPatterns[presetIndex] && presetPatterns[presetIndex].length > 0) {
                        const presetNode = presetPatterns[presetIndex][0];
                        const presetKey = 'preset_' + presetIndex;
                        const lastTime = lastSyncTimes.get(presetKey) || 0;
                        if (now - lastTime >= minInterval) {
                            if (presetNode.alpha && presetNode.alpha[stepIndex] > 0.5) {
                                window.syncBallWithStepper(beat, stepIndex, presetIndex, true);
                                lastSyncTimes.set(presetKey, now);
                            } else {
                                window.syncBallWithStepper(beat, stepIndex, presetIndex, false);
                            }
                        }
                    }
                }
                if (typeof nodes !== 'undefined' && nodes.length > 0) {
                    for (let i = 0; i < nodes.length; i++) {
                        if (nodes[i].alpha) {
                            const nodePresetIndex = nodes[i].presetIndex !== undefined
                                ? nodes[i].presetIndex : ui.currentPattern;
                            const nodeKey = 'node_' + i + '_' + nodePresetIndex;
                            const lastTime = lastSyncTimes.get(nodeKey) || 0;
                            if (now - lastTime >= minInterval) {
                                const isActive = nodes[i].alpha[stepIndex] > 0.5;
                                if (isActive) {
                                    window.syncBallWithStepper(beat, stepIndex, nodePresetIndex, isActive);
                                    lastSyncTimes.set(nodeKey, now);
                                }
                            }
                        }
                    }
                }
            }
        };
    `;
    document.body.appendChild(script);
}

// ---- 事件监听 ----
window.addEventListener('rhythm-beat', (event) => {
    if (!event.detail) return;
    const { beat, step, preset, active } = event.detail;
    stepperState.lastBeat = beat;
    stepperState.lastStep = step;
    stepperState.isPlaying = true;
    if (active) stepperState.activePresets.add(preset);
    else stepperState.activePresets.delete(preset);
    if (params.enableStepperSync) handleStepperEvent(beat, step, preset, active);
    if (typeof window.activatePresetSphere === 'function') window.activatePresetSphere(preset, active);
});

window.addEventListener('rhythm-stop', () => {
    stepperState.isPlaying = false;
    if (!params.rememberStepperPattern) {
        for (const sphere of allSpheres) {
            if (sphere.userData.stepperControlled && sphere.userData.active) {
                sphere.material.emissiveIntensity = params.inactiveBrightness;
                sphere.userData.active = false;
                sphere.userData.stepperActive = false;
                removeLightForSphere(sphere);
                const idx = activeSpheres.indexOf(sphere);
                if (idx !== -1) activeSpheres.splice(idx, 1);
            }
        }
        stepperState.activePresets.clear();
    }
});

window.addEventListener('rhythm-integration-ready', () => {
    // placeholder for integration.js callback
});
