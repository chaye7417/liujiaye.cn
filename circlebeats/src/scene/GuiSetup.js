/**
 * GuiSetup.js
 * GUI 面板创建：闪烁、材质、光照、焦点跟踪、跟踪球外观/自转、运镜控制
 * 返回需要在其他模块中引用的 GUI 控制器
 */
import {
    scene, camera, params, cameraParams, controls, gui,
} from './SceneSetup.js';
import {
    allSpheres, trackingBall,
    updateInactiveBrightness, updateMaterialProperties, updateLightParameters,
    createTrackingBall, highlightCustomFocusBall,
    setTrackingFolder, setCustomFocusController, setBallSelector,
} from './SphereManager.js';
import {
    cameraPaths, activeCameraPath,
    generateAllCameraPaths, setCameraPath,
} from './CameraAnimation.js';

// ---- 闪烁控制 ----
const flickerFolder = gui.addFolder('闪烁控制');
flickerFolder.add(params, 'enableFlicker').name('启用闪烁');
flickerFolder.add(params, 'flickerFrequency', 0.1, 5.0).name('闪烁频率 (Hz)');
flickerFolder.add(params, 'enableClickLight').name('允许点击点亮小球');

const stepperSyncFolder = flickerFolder.addFolder('步进器同步');
stepperSyncFolder.add(params, 'enableStepperSync').name('与步进器同步闪烁');
stepperSyncFolder.add(params, 'stepperFlickerIntensity', 1.0, 5.0).name('闪烁强度');
stepperSyncFolder.add(params, 'stepperFlickerDuration', 0.05, 0.5).name('闪烁持续时间');
stepperSyncFolder.add(params, 'rememberStepperPattern').name('记住步进器模式');
flickerFolder.add(params, 'inactiveBrightness', 0.0, 0.5).name('未点亮亮度').onChange(updateInactiveBrightness);

// ---- 材质属性 ----
const materialFolder = gui.addFolder('材质属性');
materialFolder.add(params, 'roughness', 0, 1).name('粗糙度').onChange(updateMaterialProperties);
materialFolder.add(params, 'metalness', 0, 1).name('金属感').onChange(updateMaterialProperties);
materialFolder.add(params, 'envMapIntensity', 0, 3).name('反射强度').onChange(updateMaterialProperties);

// ---- 光照控制 ----
const lightFolder = gui.addFolder('光照控制');
lightFolder.add(params, 'lightIntensity', 0, 5).name('光照强度').onChange(updateLightParameters);
lightFolder.add(params, 'lightDistance', 1, 20).name('光照距离').onChange(updateLightParameters);
lightFolder.add(params, 'lightDecay', 0, 2).name('光照衰减').onChange(updateLightParameters);

// ---- 焦点跟踪 ----
const trackingFolder = gui.addFolder('焦点跟踪');
setTrackingFolder(trackingFolder);

trackingFolder.add(params, 'focusTrackingEnabled').name('启用焦点跟踪').onChange(value => {
    if (!trackingBall) createTrackingBall();
    if (value && params.customFocusEnabled) {
        params.customFocusEnabled = false;
        if (customFocusController) customFocusController.updateDisplay();
    }
});
trackingFolder.add(params, 'trackingBallSpeed', 0.1, 3).name('跟踪球速度');
trackingFolder.add(params, 'trackingBallSize', 0.5, 3).name('跟踪球大小').onChange(() => {
    if (trackingBall) { scene.remove(trackingBall); createTrackingBall(); }
});
trackingFolder.add(params, 'focusOffset', -5, 5).name('焦点偏移');

// ---- 自定义焦点 ----
const customFocusFolder = gui.addFolder('自定义焦点');
const customFocusController = customFocusFolder.add(params, 'customFocusEnabled').name('启用自定义焦点').onChange(value => {
    if (value && params.focusTrackingEnabled) {
        params.focusTrackingEnabled = false;
        for (const controller of trackingFolder.controllers) {
            if (controller.property === 'focusTrackingEnabled') { controller.updateDisplay(); break; }
        }
    }
    if (!trackingBall) createTrackingBall();
    highlightCustomFocusBall();
});
setCustomFocusController(customFocusController);

const ballSelector = customFocusFolder.add(params, 'customFocusBallIndex', -1, allSpheres.length - 1, 1)
    .name('选择焦点球').onChange(() => { highlightCustomFocusBall(); });
setBallSelector(ballSelector);

customFocusFolder.add(params, 'customFocusOffset', -5, 5, 0.1).name('焦点偏移');
customFocusFolder.add({
    randomSelect() {
        params.customFocusBallIndex = Math.floor(Math.random() * allSpheres.length);
        ballSelector.updateDisplay();
        highlightCustomFocusBall();
    },
}, 'randomSelect').name('随机选择');

// clickToFocus 使用 window 全局变量桥接到 SphereManager
window.__clickToFocusEnabled = false;
customFocusFolder.add({
    toggleClickToFocus() {
        window.__clickToFocusEnabled = !window.__clickToFocusEnabled;
        return window.__clickToFocusEnabled;
    },
}, 'toggleClickToFocus').name('点击选择焦点球').listen();

// ---- 跟踪球外观 ----
const trackingAppearanceFolder = trackingFolder.addFolder('跟踪球外观');
trackingAppearanceFolder.addColor(params, 'trackingBallColor').name('小球颜色').onChange(() => {
    if (trackingBall) createTrackingBall();
});
trackingAppearanceFolder.add(params, 'trackingBallEmissive').name('启用发光').onChange(() => {
    if (trackingBall) createTrackingBall();
});
trackingAppearanceFolder.addColor(params, 'trackingBallEmissiveColor').name('发光颜色').onChange(() => {
    if (trackingBall && params.trackingBallEmissive) createTrackingBall();
});
trackingAppearanceFolder.add(params, 'trackingBallShape', ['sphere', 'cube', 'torus', 'cone']).name('形状').onChange(() => {
    if (trackingBall) createTrackingBall();
});

// ---- 跟踪球自转 ----
const trackingRotationFolder = trackingFolder.addFolder('跟踪球自转');
trackingRotationFolder.add(params, 'trackingBallRotate').name('启用自转').onChange(() => {
    if (trackingBall && !params.trackingBallRotate) trackingBall.rotation.set(0, 0, 0);
});
trackingRotationFolder.add(params, 'trackingBallRotateSpeed', 0.1, 5).name('自转速度');
trackingRotationFolder.add(params, 'trackingBallRotateAxis', ['x', 'y', 'z', 'random']).name('自转轴');

// ---- 运镜控制 ----
const cameraFolder = gui.addFolder('运镜控制');
export const cameraAutoController = cameraFolder.add(cameraParams, 'autoCamera').name('启用自动运镜').onChange(value => {
    if (value && !activeCameraPath) {
        generateAllCameraPaths();
        setCameraPath(cameraParams.currentPath);
    }
    if (value) {
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
    } else {
        for (const name in cameraPaths) {
            if (cameraPaths[name].line) cameraPaths[name].line.visible = false;
        }
    }
    controls.enabled = !value || cameraParams.pathWeight < 1.0;
});
cameraFolder.add(cameraParams, 'currentPath', ['spiral', 'swing', 'random', 'closeup', 'flyby']).name('相机路径').onChange(value => {
    if (cameraParams.autoCamera) setCameraPath(value);
});
cameraFolder.add(cameraParams, 'pathSpeed', 0.1, 2.0).name('路径速度');
cameraFolder.add(cameraParams, 'cameraFov', 20, 80).name('视野角度').onChange(value => {
    camera.fov = value;
    camera.updateProjectionMatrix();
});
cameraFolder.add(cameraParams, 'lookAtCenter').name('始终看向中心');
cameraFolder.add(cameraParams, 'smoothTransition').name('平滑过渡');
cameraFolder.add(cameraParams, 'transitionDuration', 0.5, 5.0).name('过渡时间(秒)');
cameraFolder.add(cameraParams, 'pathWeight', 0, 1).name('路径权重').onChange(value => {
    controls.enabled = value < 0.99;
});
cameraFolder.add(cameraParams, 'randomJump').name('随机跳转');
cameraFolder.add(cameraParams, 'jumpInterval', 3, 30).name('跳转间隔(秒)');
cameraFolder.add({
    resetCamera() {
        camera.position.set(0, 0, 20);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    },
}, 'resetCamera').name('重置相机位置');
