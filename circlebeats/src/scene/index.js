/**
 * src/scene/index.js
 * 桶文件 — 统一导出并挂载全局变量
 * 导入顺序确保副作用正确执行
 */

// 1. 基础设置（无依赖）
export { scene, camera, renderer, controls, params, cameraParams, clock, gui } from './SceneSetup.js';

// 2. 后处理（依赖 SceneSetup）
export { composer, bloomPass, bokehPass, bokehParams } from './PostProcessing.js';

// 3. 小球管理（依赖 SceneSetup, PostProcessing）
export {
    allSpheres, activeSpheres, sphereLights,
    activateSphere, flashSphere,
    highlightCustomFocusBall, updateFocus,
} from './SphereManager.js';

// 3b. 跟踪球（依赖 SceneSetup, PostProcessing）
export { trackingBall, createTrackingBall, updateTrackingBall } from './TrackingBall.js';

// 4. 相机动画（依赖 SceneSetup, SphereManager）
export {
    cameraPaths, createCameraPaths, generateAllCameraPaths,
    setCameraPath, updateCameraPosition,
} from './CameraAnimation.js';

// 5. 地板（依赖 SceneSetup）
export { createFloor, updateFloor, floor } from './FloorScene.js';

// 6. GUI 设置（依赖 SceneSetup, SphereManager, CameraAnimation）— 纯副作用
import './GuiSetup.js';

// 7. 步进器集成（依赖 SceneSetup, SphereManager）— 纯副作用 + 导出
import './StepperIntegration.js';

// 8. 主控制器（依赖所有模块）
export {
    showScene, hideScene, toggleSceneVisibility,
    updateCameraPathSpeed, setCameraAutoModeFromStepper,
    initScene,
} from './SceneController.js';

// ---- 全局挂载 ----
import { activateSphere, flashSphere } from './SphereManager.js';
import {
    showScene, hideScene, toggleSceneVisibility,
    updateCameraPathSpeed, setCameraAutoModeFromStepper,
    initScene,
} from './SceneController.js';

window.activateSphere = activateSphere;
window.flashSphere = flashSphere;
window.showScene = showScene;
window.hideScene = hideScene;
window.toggleSceneVisibility = toggleSceneVisibility;
window.updateCameraPathSpeed = updateCameraPathSpeed;
window.setCameraAutoModeFromStepper = setCameraAutoModeFromStepper;

// 启动场景
initScene();
