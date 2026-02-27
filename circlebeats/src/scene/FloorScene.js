/**
 * FloorScene.js
 * 地板加载、floor.jpg 纹理、默认地板、地板参数更新
 */
import * as THREE from 'three';
import { scene, params, gui } from './SceneSetup.js';

// ---- 地板状态 ----
export let floor = null;
const floorTextureLoader = new THREE.TextureLoader();

// ---- 创建地板 ----
export function createFloor() {
    if (floor) {
        scene.remove(floor);
        floor = null;
    }
    if (!params.floorVisible) return;

    floorTextureLoader.load(
        'floor.jpg',
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);

            const normalMap = floorTextureLoader.load('floor.jpg', (normalTexture) => {
                normalTexture.wrapS = THREE.RepeatWrapping;
                normalTexture.wrapT = THREE.RepeatWrapping;
                normalTexture.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);
            });

            const floorGeometry = new THREE.PlaneGeometry(params.floorSize, params.floorSize, 32, 32);
            const floorMaterial = new THREE.MeshPhysicalMaterial({
                map: texture,
                normalMap,
                normalScale: new THREE.Vector2(0.3, 0.3),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: params.floorOpacity,
                roughness: 1 - params.floorReflectivity,
                metalness: 0.1,
                reflectivity: params.floorReflectivity * 1.5,
                clearcoat: 0.5,
                clearcoatRoughness: 0.2,
            });

            floorMaterial.map.encoding = THREE.sRGBEncoding;
            floorMaterial.color = new THREE.Color(params.floorBrightness, params.floorBrightness, params.floorBrightness);

            floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = Math.PI / 2;
            floor.position.y = params.floorHeight;
            floor.receiveShadow = true;
            scene.add(floor);

            scene.fog = new THREE.FogExp2(0x000000, 0.005);
        },
        undefined,
        (error) => {
            console.error('地板贴图加载失败:', error);
            createDefaultFloor();
        }
    );
}

// ---- 默认地板（无贴图） ----
function createDefaultFloor() {
    const floorGeometry = new THREE.PlaneGeometry(params.floorSize, params.floorSize, 32, 32);
    const floorMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x202020),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: params.floorOpacity,
        roughness: 1 - params.floorReflectivity,
        metalness: 0.1,
        reflectivity: params.floorReflectivity * 1.5,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
    });

    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = params.floorHeight;
    floor.receiveShadow = true;
    scene.add(floor);

    scene.fog = new THREE.FogExp2(0x000000, 0.005);
}

// ---- 更新地板参数 ----
export function updateFloor() {
    if (!floor) return;

    floor.position.y = params.floorHeight;
    floor.scale.set(params.floorSize / 30, params.floorSize / 30, 1);

    if (floor.material) {
        floor.material.opacity = params.floorOpacity;
        floor.material.roughness = 1 - params.floorReflectivity;

        if (floor.material.type === 'MeshPhysicalMaterial') {
            floor.material.reflectivity = params.floorReflectivity * 1.5;
            floor.material.metalness = 0.1;
            floor.material.clearcoat = 0.5;
            floor.material.clearcoatRoughness = 0.2;
        } else {
            floor.material.metalness = 0.1;
        }

        if (floor.material.map) {
            floor.material.color.setScalar(params.floorBrightness);
        } else {
            floor.material.color.set(0x202020);
            floor.material.color.multiplyScalar(params.floorBrightness);
        }

        if (floor.material.map) {
            floor.material.map.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);
            if (floor.material.normalMap) {
                floor.material.normalMap.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);
            }
            floor.material.needsUpdate = true;
        }
    }

    if (scene.fog) {
        scene.fog.density = 0.005 / (params.floorSize / 100);
    }
}

// ---- GUI：地板设置 ----
const floorFolder = gui.addFolder('地板设置');
floorFolder.add(params, 'floorVisible').name('显示地板').onChange(value => {
    if (value) {
        createFloor();
    } else if (floor) {
        scene.remove(floor);
        floor = null;
    }
});
floorFolder.add(params, 'floorHeight', -20, 0).name('地板高度').onChange(updateFloor);
floorFolder.add(params, 'floorSize', 30, 1000).name('地板大小').onChange(updateFloor);
floorFolder.add(params, 'floorOpacity', 0, 1).name('地板透明度').onChange(updateFloor);
floorFolder.add(params, 'floorReflectivity', 0, 1).name('地板反射率').onChange(updateFloor);
floorFolder.add(params, 'floorTextureRepeat', 1, 100).name('贴图重复').onChange(() => {
    createFloor();
});
floorFolder.add(params, 'floorBrightness', 0.5, 3).name('地板亮度').onChange(updateFloor);
