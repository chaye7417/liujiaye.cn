/**
 * TrackingBall.js
 * 焦点跟踪小球：创建、环境贴图更新、位置与自转更新
 */
import * as THREE from 'three';
import { scene, params, renderer } from './SceneSetup.js';
import { bokehPass } from './PostProcessing.js';

// ---- 跟踪球状态 ----
export let trackingBall = null;
let trackingBallPath = null;
let trackingBallEnvMap = null;
let lastTrackingBallUpdate = 0;

// ---- 创建跟踪球 ----
export function createTrackingBall() {
    if (trackingBall) {
        scene.remove(trackingBall);
        if (trackingBallPath) scene.remove(trackingBallPath);
    }

    if (!trackingBallEnvMap) {
        trackingBallEnvMap = {
            renderTarget: new THREE.WebGLCubeRenderTarget(256, {
                generateMipmaps: true,
                minFilter: THREE.LinearMipmapLinearFilter,
                magFilter: THREE.LinearFilter,
            }),
            camera: null,
        };
        trackingBallEnvMap.camera = new THREE.CubeCamera(0.1, 1000, trackingBallEnvMap.renderTarget);
        scene.add(trackingBallEnvMap.camera);
    }

    let geo;
    switch (params.trackingBallShape) {
        case 'cube':
            geo = new THREE.BoxGeometry(params.trackingBallSize * 1.5, params.trackingBallSize * 1.5, params.trackingBallSize * 1.5);
            break;
        case 'torus':
            geo = new THREE.TorusGeometry(params.trackingBallSize, params.trackingBallSize / 3, 16, 100);
            break;
        case 'cone':
            geo = new THREE.ConeGeometry(params.trackingBallSize, params.trackingBallSize * 2, 32);
            break;
        default:
            geo = new THREE.SphereGeometry(params.trackingBallSize, 32, 32);
    }

    const emissiveColor = params.trackingBallEmissive
        ? new THREE.Color(params.trackingBallEmissiveColor)
        : new THREE.Color(0x000000);

    const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(params.trackingBallColor),
        emissive: emissiveColor,
        emissiveIntensity: params.trackingBallEmissive ? 0.8 : 0,
        roughness: 0.1, metalness: 0.9,
        envMapIntensity: 2.0, clearcoat: 1.0, clearcoatRoughness: 0.1, reflectivity: 1.0,
    });

    trackingBall = new THREE.Mesh(geo, mat);
    trackingBall.position.set(0, 0, 0);

    // 轨迹路径
    const pathRadius = 8, pathSegments = 64;
    const verts = [];
    for (let i = 0; i <= pathSegments; i++) {
        const theta = (i / pathSegments) * Math.PI * 2;
        verts.push(pathRadius * Math.cos(theta), 0, pathRadius * Math.sin(theta));
    }
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    trackingBallPath = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 }));

    scene.add(trackingBall);
    scene.add(trackingBallPath);
    updateTrackingBallEnvironmentMap();
    return trackingBall;
}

// ---- 环境贴图更新 ----
function updateTrackingBallEnvironmentMap() {
    if (!trackingBall || !trackingBallEnvMap) return;
    const now = performance.now();
    if (now - lastTrackingBallUpdate < 16) return;
    lastTrackingBallUpdate = now;

    trackingBall.visible = false;
    const origBokeh = bokehPass.enabled;
    bokehPass.enabled = false;
    trackingBallEnvMap.camera.position.copy(trackingBall.position);
    trackingBallEnvMap.camera.update(renderer, scene);
    trackingBall.material.envMap = trackingBallEnvMap.renderTarget.texture;
    trackingBall.material.needsUpdate = true;
    trackingBall.visible = true;
    bokehPass.enabled = origBokeh;
}

// ---- 位置 & 自转更新 ----
export function updateTrackingBall(time) {
    if (!trackingBall) return;
    const pathRadius = 8;
    const angle = time * params.trackingBallSpeed * 0.5;
    trackingBall.position.x = pathRadius * Math.cos(angle);
    trackingBall.position.z = pathRadius * Math.sin(angle);
    trackingBall.position.y = Math.sin(angle * 2) * 2;

    if (params.trackingBallRotate) {
        const rs = time * params.trackingBallRotateSpeed * 2;
        switch (params.trackingBallRotateAxis) {
            case 'x': trackingBall.rotation.x = rs; break;
            case 'y': trackingBall.rotation.y = rs; break;
            case 'z': trackingBall.rotation.z = rs; break;
            case 'random':
                trackingBall.rotation.x = rs * 0.7;
                trackingBall.rotation.y = rs * 1.3;
                trackingBall.rotation.z = rs * 0.5;
                break;
            default: trackingBall.rotation.y = rs;
        }
        if (params.trackingBallShape === 'torus') {
            const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
            const axis = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
            const q = new THREE.Quaternion().setFromAxisAngle(axis, rs);
            trackingBall.quaternion.copy(q);
        }
    }

    // 环境贴图防抖更新
    if (trackingBall.userData.lastEnvMapPos === undefined) {
        trackingBall.userData.lastEnvMapPos = trackingBall.position.clone();
        updateTrackingBallEnvironmentMap();
    } else {
        const dist = trackingBall.position.distanceTo(trackingBall.userData.lastEnvMapPos);
        if (dist > 0.2 || Math.floor(time * 30) % 5 === 0) {
            trackingBall.userData.lastEnvMapPos.copy(trackingBall.position);
            updateTrackingBallEnvironmentMap();
        }
    }
}
