/**
 * CameraAnimation.js
 * 相机路径动画、路径生成、路径切换、贝塞尔插值
 */
import * as THREE from 'three';
import { scene, camera, cameraParams, controls, clock } from './SceneSetup.js';
import { allSpheres } from './SphereManager.js';

// ---- 路径状态 ----
export const cameraPaths = {};
export let activeCameraPath = null;
let lastPathUpdateTime = 0;
let lastJumpTime = 0;
let cameraTransitioning = false;
let transitionStartTime = 0;
const transitionFromPosition = new THREE.Vector3();
const transitionFromTarget = new THREE.Vector3();
const transitionToPosition = new THREE.Vector3();
const transitionToTarget = new THREE.Vector3();

// ---- 贝塞尔插值 ----
function bezierInterpolation(p0, p1, p2, p3, t) {
    const oneMinusT = 1 - t;
    return Math.pow(oneMinusT, 3) * p0
        + 3 * Math.pow(oneMinusT, 2) * t * p1
        + 3 * oneMinusT * Math.pow(t, 2) * p2
        + Math.pow(t, 3) * p3;
}

// ---- 路径定义 ----
export function createCameraPaths() {
    // 螺旋上升路径
    cameraPaths.spiral = {
        points: [], targets: [],
        create: () => {
            const points = [], targets = [];
            const loops = 3, pointsPerLoop = 60, totalPoints = loops * pointsPerLoop;
            for (let i = 0; i < totalPoints; i++) {
                const angle = (i / pointsPerLoop) * Math.PI * 2;
                const radius = 15 + Math.sin(i * 0.1) * 5;
                const height = -5 + (i / totalPoints) * 15;
                points.push(new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius));
                targets.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2
                ));
            }
            return { points, targets };
        },
    };

    // 环形摇摆路径
    cameraPaths.swing = {
        points: [], targets: [],
        create: () => {
            const points = [], targets = [], totalPoints = 120;
            for (let i = 0; i < totalPoints; i++) {
                const angle = (i / totalPoints) * Math.PI * 2;
                const baseRadius = 12;
                const verticalSwing = Math.sin(angle * 3) * 4;
                const radiusVar = Math.cos(angle * 2) * 4;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * (baseRadius + radiusVar), verticalSwing, Math.sin(angle) * (baseRadius + radiusVar)
                ));
                const sf = 0.3;
                targets.push(new THREE.Vector3(
                    Math.sin(angle * 5) * sf, Math.cos(angle * 7) * sf, Math.sin(angle * 6) * sf
                ));
            }
            return { points, targets };
        },
    };

    // 随机穿梭路径
    cameraPaths.random = {
        points: [], targets: [],
        create: () => {
            const points = [], targets = [], totalPoints = 100;
            const clusters = [];
            for (let i = 0; i < 8; i++) {
                clusters.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 30
                ));
            }
            for (let i = 0; i < totalPoints; i++) {
                const t = i / totalPoints;
                const ci1 = Math.floor(t * clusters.length) % clusters.length;
                const ci2 = (ci1 + 1) % clusters.length;
                const lf = (t * clusters.length) % 1;
                const p1 = clusters[ci1], p2 = clusters[ci2];
                const cp1 = new THREE.Vector3(
                    p1.x + (Math.random() - 0.5) * 10, p1.y + (Math.random() - 0.5) * 5, p1.z + (Math.random() - 0.5) * 10
                );
                const cp2 = new THREE.Vector3(
                    p2.x + (Math.random() - 0.5) * 10, p2.y + (Math.random() - 0.5) * 5, p2.z + (Math.random() - 0.5) * 10
                );
                const point = new THREE.Vector3();
                point.x = bezierInterpolation(p1.x, cp1.x, cp2.x, p2.x, lf);
                point.y = bezierInterpolation(p1.y, cp1.y, cp2.y, p2.y, lf);
                point.z = bezierInterpolation(p1.z, cp1.z, cp2.z, p2.z, lf);
                points.push(point);
                targets.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3
                ));
            }
            return { points, targets };
        },
    };

    // 慢速特写路径
    cameraPaths.closeup = {
        points: [], targets: [],
        create: () => {
            const points = [], targets = [], totalPoints = 150;
            const targetSpheres = [];
            for (let i = 0; i < 10; i++) {
                targetSpheres.push(allSpheres[Math.floor(Math.random() * allSpheres.length)]);
            }
            for (let i = 0; i < totalPoints; i++) {
                const t = i / totalPoints;
                const si = Math.floor(t * targetSpheres.length) % targetSpheres.length;
                const sphere = targetSpheres[si];
                const ao = ((t * targetSpheres.length) % 1) * Math.PI * 4;
                const radius = 2 + Math.sin(t * Math.PI * 10) * 0.5;
                const ho = Math.cos(t * Math.PI * 8) * 0.7;
                points.push(new THREE.Vector3(
                    sphere.position.x + Math.cos(ao) * radius, sphere.position.y + ho, sphere.position.z + Math.sin(ao) * radius
                ));
                targets.push(new THREE.Vector3(sphere.position.x, sphere.position.y, sphere.position.z));
            }
            return { points, targets };
        },
    };

    // 高速穿越路径
    cameraPaths.flyby = {
        points: [], targets: [],
        create: () => {
            const points = [], targets = [], totalPoints = 120;
            for (let i = 0; i < totalPoints; i++) {
                const t = i / totalPoints;
                const angle = t * Math.PI * 6;
                const radius = 20 - t * 15;
                const height = Math.sin(t * Math.PI * 3) * 10;
                points.push(new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius));
                const nt = Math.min(i + 1, totalPoints - 1) / totalPoints;
                const na = nt * Math.PI * 6;
                const nr = 20 - nt * 15;
                const nh = Math.sin(nt * Math.PI * 3) * 10;
                targets.push(new THREE.Vector3(Math.cos(na) * nr, nh, Math.sin(na) * nr));
            }
            return { points, targets };
        },
    };
}

// ---- 生成路径数据 & 可视化线 ----
export function generateAllCameraPaths() {
    for (const pathName in cameraPaths) {
        const path = cameraPaths[pathName];
        const { points, targets } = path.create();
        path.points = points;
        path.targets = targets;
        if (path.line) scene.remove(path.line);
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 });
        path.line = new THREE.Line(geo, mat);
        path.line.visible = false;
        scene.add(path.line);
    }
}

// ---- 获取路径位置 ----
function getPathPosition(path, time) {
    if (!path || !path.points || path.points.length === 0) return null;
    const points = path.points;
    const targets = path.targets;
    const total = points.length;
    const wi = Math.floor(time) % total;
    const ni = (wi + 1) % total;
    const fraction = time - Math.floor(time);
    const position = new THREE.Vector3().lerpVectors(points[wi], points[ni], fraction);

    let target;
    if (cameraParams.lookAtCenter) {
        target = cameraParams.lookAtOffset.clone();
    } else if (targets && targets.length > 0) {
        target = new THREE.Vector3().lerpVectors(targets[wi], targets[ni], fraction);
    } else {
        target = new THREE.Vector3();
    }
    return { position, target };
}

// ---- 设置当前路径 ----
export function setCameraPath(pathName) {
    if (!cameraPaths[pathName]) {
        console.warn(`路径 "${pathName}" 不存在`);
        return;
    }
    if (activeCameraPath && activeCameraPath === cameraPaths[pathName]) return;

    if (cameraParams.smoothTransition && activeCameraPath) {
        transitionFromPosition.copy(camera.position);
        const currentTargetOffset = new THREE.Vector3();
        if (cameraParams.lookAtCenter) {
            currentTargetOffset.copy(cameraParams.lookAtOffset);
        } else if (activeCameraPath) {
            const pos = getPathPosition(activeCameraPath, lastPathUpdateTime);
            if (pos && pos.target) currentTargetOffset.copy(pos.target);
        }
        transitionFromTarget.copy(currentTargetOffset);

        const newPathPos = getPathPosition(cameraPaths[pathName], 0);
        if (newPathPos) {
            transitionToPosition.copy(newPathPos.position);
            transitionToTarget.copy(newPathPos.target);
        }
        cameraTransitioning = true;
        transitionStartTime = clock.getElapsedTime();
    }

    activeCameraPath = cameraPaths[pathName];
    lastPathUpdateTime = 0;

    for (const name in cameraPaths) {
        if (cameraPaths[name].line) cameraPaths[name].line.visible = (name === pathName);
    }
}

// ---- 更新相机位置 ----
export function updateCameraPosition(time) {
    if (!cameraParams.autoCamera || !activeCameraPath) return;

    if (cameraTransitioning) {
        const elapsed = time - transitionStartTime;
        const duration = cameraParams.transitionDuration;
        if (elapsed >= duration) {
            cameraTransitioning = false;
        } else {
            const t = elapsed / duration;
            const smoothT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const position = new THREE.Vector3().lerpVectors(transitionFromPosition, transitionToPosition, smoothT);
            const target = new THREE.Vector3().lerpVectors(transitionFromTarget, transitionToTarget, smoothT);
            camera.position.copy(position);
            if (cameraParams.lookAtCenter) camera.lookAt(target);
            controls.enabled = false;
            return;
        }
    }

    if (cameraParams.randomJump) {
        if (time - lastJumpTime > cameraParams.jumpInterval) {
            lastPathUpdateTime = Math.random() * activeCameraPath.points.length;
            lastJumpTime = time;
        }
    }

    lastPathUpdateTime += cameraParams.pathSpeed * 0.05;

    const pathPos = getPathPosition(activeCameraPath, lastPathUpdateTime);
    if (!pathPos) return;

    const weight = cameraParams.pathWeight;
    const orbitPosition = controls.object.position.clone();
    camera.position.lerpVectors(orbitPosition, pathPos.position, weight);
    camera.fov = cameraParams.cameraFov;
    camera.updateProjectionMatrix();
    if (cameraParams.lookAtCenter) camera.lookAt(pathPos.target);
    controls.update();
}
