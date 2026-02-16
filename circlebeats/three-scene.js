import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// 控制渲染循环的标志
let isRendering = true;

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// 移除外部环境贴图
// 后面我们会让渲染器自动处理反射

// 添加自定义CSS样式，为GUI添加特殊样式
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
    
    /* 更改关闭按钮样式 */
    .lil-gui.root > .title > .close-button {
        background: rgba(255,255,255,0.1);
        border-radius: 50%;
        font-size: 14px;
        padding: 2px;
    }
    
    /* GUI折叠时特殊样式 */
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
        content: "⚙";
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
    }
`;
document.head.appendChild(guiStyle);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 200);
camera.position.set(0, 0, 20);

// 相机动画参数
const cameraParams = {
    autoCamera: true,          // 是否启用自动运镜
    currentPath: 'spiral',      // 当前选择的相机路径
    pathSpeed: 0.5,             // 路径移动速度
    lookAtCenter: true,         // 是否始终看向中心
    lookAtOffset: new THREE.Vector3(0, 0, 0), // 注视点偏移
    smoothTransition: true,     // 平滑切换路径
    transitionDuration: 2.0,    // 路径切换过渡时间（秒）
    cameraFov: 40,              // 相机视野角度
    randomJump: false,          // 随机跳转到路径上的点
    jumpInterval: 10,           // 随机跳转间隔（秒）
    pathWeight: 0.7,            // 路径权重（轨道控制混合比例）
};

// 使用更高细节的几何体
const geometry = new THREE.IcosahedronGeometry(1, 15);

// 闪烁控制参数
const params = {
    enableFlicker: false,
    flickerFrequency: 1.0, // 默认闪烁频率 (Hz)
    inactiveBrightness: 0.2, // 默认未激活小球亮度
    roughness: 0.1, // 材质粗糙度
    metalness: 0.8, // 金属感
    envMapIntensity: 1.0, // 环境贴图强度
    lightIntensity: 2.0,   // 发光强度
    lightDistance: 6.0,    // 光照距离
    lightDecay: 1.0,       // 光照衰减
    focusTrackingEnabled: true, // 焦点跟踪启用状态
    trackingBallSpeed: 3.0, // 跟踪小球速度
    trackingBallSize: 1.5,  // 跟踪小球大小
    focusOffset: 0,      // 焦点偏移量
    trackingBallColor: '#ffffff', // 跟踪小球颜色
    trackingBallEmissive: false,  // 跟踪小球是否发光
    trackingBallEmissiveColor: '#ff3300', // 跟踪小球发光颜色
    trackingBallShape: 'sphere', // 跟踪小球形状，可选 'sphere', 'cube', 'torus', 'cone'
    trackingBallRotate: true,    // 跟踪小球是否自转
    trackingBallRotateSpeed: 1.0, // 跟踪小球自转速度
    trackingBallRotateAxis: 'y',  // 跟踪小球自转轴，可选 'x', 'y', 'z', 'random'
    floorVisible: true,           // 地板是否可见
    floorSize: 100,               // 地板大小 - 修改为更大的值
    floorHeight: -6,              // 地板高度
    floorOpacity: 0.5,            // 地板透明度降低，使反射看起来更自然
    floorReflectivity: 0.4,       // 提高地板反射率，使反射更明显
    floorTextureRepeat: 8,        // 减少贴图重复次数，使纹理看起来不那么密集
    floorBrightness: 2.0,         // 调整地板亮度，使其更亮
    customFocusEnabled: false,    // 是否启用自定义焦点
    customFocusBallIndex: -1,     // 当前选定的焦点小球索引，-1表示未选择
    customFocusOffset: 0.0,       // 自定义焦点偏移
    enableClickLight: false,      // 是否允许用户点击小球点亮/熄灭小球，默认关闭
    
    // 步进器与闪烁同步相关参数
    enableStepperSync: true,     // 是否启用步进器与闪烁同步
    stepperFlickerIntensity: 4.0, // 步进器触发闪烁的强度
    stepperFlickerDuration: 0.5,  // 步进器触发闪烁的持续时间（秒）
    rememberStepperPattern: true, // 是否记住步进器的模式（即使步进器暂停也保持小球点亮）
};

const activeSpheres = []; // 存储被点亮的小球
const allSpheres = []; // 存储所有小球
const sphereLights = new Map(); // 存储每个发光小球对应的光源

// 创建更多样化的小球
for (let i = 0; i < 50; i++) {
    const color = new THREE.Color();
    color.setHSL(Math.random(), 0.7, 0.125); // fixed lightness for consistent brightness

    // 使用更真实的PBR材质
    const material = new THREE.MeshStandardMaterial({ 
        color: color, 
        emissive: color, 
        emissiveIntensity: params.inactiveBrightness,
        roughness: params.roughness,
        metalness: params.metalness,
        envMapIntensity: params.envMapIntensity
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.x = Math.random() * 10 - 5;
    sphere.position.y = Math.random() * 10 - 5;
    sphere.position.z = Math.random() * 10 - 5;
    sphere.position.normalize().multiplyScalar(Math.random() * 4.0 + 2.0);
    sphere.scale.setScalar(Math.random() * Math.random() + 0.5);
    sphere.userData.active = false; // 标记为非活跃状态
    sphere.userData.color = color.clone(); // 保存原始颜色
    sphere.userData.originalY = sphere.position.y; // 保存原始Y坐标，用于浮动效果
    
    // 添加微小随机旋转使小球看起来更自然
    sphere.rotation.x = Math.random() * Math.PI;
    sphere.rotation.y = Math.random() * Math.PI;
    sphere.rotation.z = Math.random() * Math.PI;
    
    scene.add(sphere);
    allSpheres.push(sphere); // 添加到所有小球数组
}

// 增强光照系统
// 环境光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// 点光源
const pointLight = new THREE.PointLight(0xffffff, 0.5);
camera.add(pointLight);
scene.add(camera);

// 添加多个额外的彩色点光源以增强视觉效果
const createColorLight = (color, intensity, position) => {
    const light = new THREE.PointLight(color, intensity, 10, 1.5);
    light.position.set(...position);
    scene.add(light);
    return light;
};

// 添加多个彩色光源
const light1 = createColorLight(0x3366ff, 0.3, [8, 3, 3]);
const light2 = createColorLight(0xff3366, 0.3, [-8, -3, 3]);
const light3 = createColorLight(0x33ff66, 0.3, [0, 5, -5]);

// 为发光小球创建对应的光源
function createLightForSphere(sphere) {
    const color = sphere.userData.color.clone();
    // 创建点光源，使用小球的颜色
    const light = new THREE.PointLight(
        color, 
        params.lightIntensity, 
        params.lightDistance, 
        params.lightDecay
    );
    
    // 将光源放置在小球位置
    light.position.copy(sphere.position);
    scene.add(light);
    
    // 存储光源与小球的映射关系
    sphereLights.set(sphere, light);
    
    return light;
}

// 移除小球对应的光源
function removeLightForSphere(sphere) {
    if (sphereLights.has(sphere)) {
        const light = sphereLights.get(sphere);
        scene.remove(light);
        sphereLights.delete(sphere);
    }
}

// 更新所有光源的位置和强度
function updateLights() {
    for (const [sphere, light] of sphereLights.entries()) {
        // 更新光源位置跟随小球
        light.position.copy(sphere.position);
        
        // 如果启用闪烁，同步光照强度与小球发光强度
        if (params.enableFlicker) {
            light.intensity = sphere.material.emissiveIntensity * params.lightIntensity / 2;
        }
        
        // 更新光照参数
        light.distance = params.lightDistance;
        light.decay = params.lightDecay;
    }
}

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
// 启用物理正确光照
renderer.physicallyCorrectLights = true;
// 启用色调映射以提高视觉效果
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// 将canvas添加到指定的three-container容器中，而不是document.body
const threeContainer = document.getElementById('three-container');
if (threeContainer) {
    threeContainer.appendChild(renderer.domElement);
} else {
    console.warn('three-container not found, falling back to document.body');
document.body.appendChild(renderer.domElement);
}

// 关键步骤：启用渲染器的自反射功能
// 这会使反光表面自动反射场景中的其他物体，而不是使用环境贴图
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// post processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0; // 设置阈值默认为0
bloomPass.strength = 1.3; // 设置强度默认为1.3
bloomPass.radius = 1; // 设置半径默认为1
composer.addPass(bloomPass);

// 添加景深效果
const bokehParams = {
    focus: 10.0,
    aperture: 0.0025,
    maxblur: 0.013,
    enabled: true,
    bloomFirst: false, // 控制泛光和景深效果的顺序
    width: window.innerWidth * 1.5, // 高分辨率渲染
    height: window.innerHeight * 1.5, // 高分辨率渲染
    dof: true // 是否启用高质量DOF
};

// 创建高质量景深通道
const createBokehPass = () => {
    const pass = new BokehPass(scene, camera, {
        focus: bokehParams.focus,
        aperture: bokehParams.aperture,
        maxblur: bokehParams.maxblur,
        width: bokehParams.width,
        height: bokehParams.height
    });
    
    // 尝试增强景深着色器质量
    if (pass.materialBokeh && pass.materialBokeh.fragmentShader) {
        // 尝试增加采样圆的质量
        const srcSampler = 'for ( int i = 0; i < KERNEL_SIZE; i ++ ) {';
        const newSampler = 'for ( int i = 0; i < KERNEL_SIZE * 2; i ++ ) {';
        pass.materialBokeh.fragmentShader = 
            pass.materialBokeh.fragmentShader.replace(srcSampler, newSampler);
        
        // 尝试使光斑更自然
        pass.materialBokeh.fragmentShader = 
            pass.materialBokeh.fragmentShader.replace(
                'gl_FragColor = texture2D( tColor, vUv.xy ) * max( 1.0, color.r * 1.5 );',
                'gl_FragColor = texture2D( tColor, vUv.xy ) * max( 1.0, color.r * 2.0 );'
            );
            
        // 标记需要重新编译
        pass.materialBokeh.needsUpdate = true;
    }
    
    pass.enabled = bokehParams.enabled;
    return pass;
};

// 使用 let 声明，使变量可以重新赋值
let bokehPass = createBokehPass();
composer.addPass(bokehPass);

// controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.autoRotate = true; // 添加自动旋转以展示环境反射效果
controls.autoRotateSpeed = 0.5;

// raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    // 只检测小球，不检测地板
    const intersects = raycaster.intersectObjects(allSpheres, false);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        
        // 如果启用了点击选择焦点功能，则设置该球为焦点
        if (clickToFocusEnabled) {
            // 找到被点击的小球在allSpheres中的索引
            const index = allSpheres.indexOf(object);
            if (index !== -1) {
                // 设置为自定义焦点球
                params.customFocusBallIndex = index;
                // 如果自定义焦点未启用，则启用它
                if (!params.customFocusEnabled) {
                    params.customFocusEnabled = true;
                    // 如果焦点跟踪启用，则禁用它
                    if (params.focusTrackingEnabled) {
                        params.focusTrackingEnabled = false;
                        // 更新UI
                        for (const controller of trackingFolder.controllers) {
                            if (controller.property === 'focusTrackingEnabled') {
                                controller.updateDisplay();
                                break;
                            }
                        }
                    }
                    // 更新UI
                    customFocusController.updateDisplay();
                }
                // 更新小球选择器UI
                ballSelector.updateDisplay();
                // 突出显示选中的小球
                highlightCustomFocusBall();
                
                // 如果仅是选择焦点，则返回，不进行点亮/熄灭操作
                if (!event.ctrlKey && !event.metaKey) { // 除非按住Ctrl键或Command键
                    return;
                }
            }
        }
        
        // 正常的点亮/熄灭逻辑 - 只有当enableClickLight为true时才执行
        if (params.enableClickLight && object.material && object.material.emissiveIntensity !== undefined) {
            if (!object.userData.active) {
                object.material.emissiveIntensity = 2.0;
                object.material.emissive.copy(object.material.color);
                object.userData.active = true; // 标记为活跃状态
                activeSpheres.push(object); // 添加到活跃小球数组
                
                // 创建光源
                createLightForSphere(object);
            } else {
                object.material.emissiveIntensity = params.inactiveBrightness;
                object.material.emissive.copy(object.material.color);
                object.userData.active = false; // 标记为非活跃状态
                
                // 移除光源
                removeLightForSphere(object);
                
                // 从活跃小球数组中移除
                const index = activeSpheres.indexOf(object);
                if (index !== -1) {
                    activeSpheres.splice(index, 1);
                }
                
                // 如果这个球是当前的自定义焦点球，则更新其高亮状态
                if (params.customFocusEnabled && 
                    params.customFocusBallIndex !== -1 && 
                    allSpheres[params.customFocusBallIndex] === object) {
                    // 更新高亮状态
                    setTimeout(highlightCustomFocusBall, 10); // 稍微延迟以确保状态更新
                }
            }
        }
    }
});

// 更新未激活小球的亮度
function updateInactiveBrightness() {
    for (const sphere of allSpheres) {
        if (!sphere.userData.active) {
            sphere.material.emissiveIntensity = params.inactiveBrightness;
        }
    }
}

// 更新所有小球的材质属性
function updateMaterialProperties() {
    for (const sphere of allSpheres) {
        sphere.material.roughness = params.roughness;
        sphere.material.metalness = params.metalness;
        sphere.material.envMapIntensity = params.envMapIntensity;
    }
}

// 更新所有光照参数
function updateLightParameters() {
    // 更新所有发光小球的光源
    for (const [sphere, light] of sphereLights.entries()) {
        light.intensity = params.lightIntensity;
        light.distance = params.lightDistance;
        light.decay = params.lightDecay;
    }
}

// gui
const gui = new GUI();
gui.close(); // 默认折叠/隐藏GUI面板
// 完全隐藏控制面板，防止用户操作
gui.domElement.style.display = 'none';

// 添加GUI自定义交互逻辑
let guiMiniMode = false; // 默认不启用迷你模式
let guiLastState = "folded"; // 记录上一次的状态，可以是 "normal", "folded", "mini"

// 扩展GUI的方法
gui.toggleMiniMode = function() {
    const guiElement = this.domElement;
    
    if (guiMiniMode) {
        // 从迷你模式切换回到上一次的状态
        guiElement.classList.remove('mini-mode');
        if (guiLastState === "folded") {
            this.close();
        } else {
            this.open();
        }
        guiMiniMode = false;
    } else {
        // 保存当前状态
        guiLastState = this.closed ? "folded" : "normal";
        // 进入迷你模式
        guiElement.classList.add('mini-mode');
        guiMiniMode = true;
    }
    return this;
};

// 监听GUI标题点击事件
const guiElement = gui.domElement;
const titleElement = guiElement.querySelector('.title');

titleElement.addEventListener('click', function(e) {
    // 仅当点击的是标题区域（不是关闭按钮）时才触发
    if (!e.target.classList.contains('close-button')) {
        // 切换迷你模式
        gui.toggleMiniMode();
        e.stopPropagation(); // 防止触发默认的折叠行为
    }
});

// 监听GUI的折叠状态
const originalClose = gui.close;
const originalOpen = gui.open;

gui.close = function() {
    if (!guiMiniMode) {
        guiElement.classList.add('folded');
        originalClose.call(this);
    }
    return this;
};

gui.open = function() {
    guiElement.classList.remove('folded');
    originalOpen.call(this);
    return this;
};

// 添加提示
gui.add({ toggleMini: () => gui.toggleMiniMode() }, 'toggleMini').name('切换迷你模式 (单击标题)');

// 初始化GUI不使用迷你模式
// guiElement.classList.add('mini-mode');

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(bloomPass, 'threshold', 0.0, 1.0).name('Threshold');
bloomFolder.add(bloomPass, 'strength', 0.0, 3.0).name('Strength');
bloomFolder.add(bloomPass, 'radius', 0.0, 1.0).name('Radius');

// 添加景深控制滑块
const bokehFolder = gui.addFolder('景深效果');
bokehFolder.add(bokehParams, 'enabled').name('启用景深').onChange(value => {
    bokehPass.enabled = value;
    
    // 当景深状态改变时，重新排列渲染通道
    if (bokehParams.bloomFirst) {
        composer.passes = [
            composer.passes[0], // RenderPass
            bloomPass,          // BloomPass
            bokehPass           // BokehPass
        ];
    } else {
        composer.passes = [
            composer.passes[0], // RenderPass
            bokehPass,          // BokehPass
            bloomPass           // BloomPass
        ];
    }
});
bokehFolder.add(bokehParams, 'focus', 1, 50).name('焦点距离').onChange(value => {
    bokehPass.uniforms["focus"].value = value;
}).listen(); // 添加listen()以允许外部更新
bokehFolder.add(bokehParams, 'aperture', 0.0001, 0.01, 0.0001).name('光圈大小').onChange(value => {
    bokehPass.uniforms["aperture"].value = value;
});
bokehFolder.add(bokehParams, 'maxblur', 0, 0.05, 0.001).name('最大模糊').onChange(value => {
    bokehPass.uniforms["maxblur"].value = value;
});
bokehFolder.add(bokehParams, 'bloomFirst').name('泛光在前').onChange(value => {
    // 重新排列渲染通道
    if (value) {
        composer.passes = [
            composer.passes[0], // RenderPass
            bloomPass,          // BloomPass
            bokehPass           // BokehPass
        ];
    } else {
        composer.passes = [
            composer.passes[0], // RenderPass
            bokehPass,          // BokehPass
            bloomPass           // BloomPass
        ];
    }
});

// 添加景深质量控制
bokehFolder.add(bokehParams, 'dof').name('高质量光斑').onChange(value => {
    // 找到当前BokehPass的索引
    const index = composer.passes.findIndex(pass => pass === bokehPass);
    if (index === -1) return;
    
    // 保存旧的参数
    const oldSettings = {
        focus: bokehPass.uniforms.focus.value,
        aperture: bokehPass.uniforms.aperture.value,
        maxblur: bokehPass.uniforms.maxblur.value,
        enabled: bokehPass.enabled
    };
    
    // 删除旧的通道
    composer.passes.splice(index, 1);
    
    // 创建新的通道
    const newBokehPass = createBokehPass();
    
    // 复制原来的参数
    newBokehPass.uniforms.focus.value = oldSettings.focus;
    newBokehPass.uniforms.aperture.value = oldSettings.aperture;
    newBokehPass.uniforms.maxblur.value = oldSettings.maxblur;
    newBokehPass.enabled = oldSettings.enabled;
    
    // 添加到渲染器
    composer.passes.splice(index, 0, newBokehPass);
    
    // 直接重新赋值
    bokehPass = newBokehPass;
});

const toneMappingFolder = gui.addFolder('Renderer');
toneMappingFolder.add(renderer, 'toneMappingExposure', 0.1, 3).name('Exposure');

// 添加闪烁控制滑块
const flickerFolder = gui.addFolder('闪烁控制');
flickerFolder.add(params, 'enableFlicker').name('启用闪烁');
flickerFolder.add(params, 'flickerFrequency', 0.1, 5.0).name('闪烁频率 (Hz)');

// 添加点击小球点亮控制
flickerFolder.add(params, 'enableClickLight').name('允许点击点亮小球');

// 添加步进器闪烁同步控制
const stepperSyncFolder = flickerFolder.addFolder('步进器同步');
stepperSyncFolder.add(params, 'enableStepperSync').name('与步进器同步闪烁');
stepperSyncFolder.add(params, 'stepperFlickerIntensity', 1.0, 5.0).name('闪烁强度');
stepperSyncFolder.add(params, 'stepperFlickerDuration', 0.05, 0.5).name('闪烁持续时间');
stepperSyncFolder.add(params, 'rememberStepperPattern').name('记住步进器模式');

// 添加未激活小球亮度控制
flickerFolder.add(params, 'inactiveBrightness', 0.0, 0.5).name('未点亮亮度').onChange(updateInactiveBrightness);

// 添加材质属性控制
const materialFolder = gui.addFolder('材质属性');
materialFolder.add(params, 'roughness', 0, 1).name('粗糙度').onChange(updateMaterialProperties);
materialFolder.add(params, 'metalness', 0, 1).name('金属感').onChange(updateMaterialProperties);
materialFolder.add(params, 'envMapIntensity', 0, 3).name('反射强度').onChange(updateMaterialProperties);

// 添加光照控制
const lightFolder = gui.addFolder('光照控制');
lightFolder.add(params, 'lightIntensity', 0, 5).name('光照强度').onChange(updateLightParameters);
lightFolder.add(params, 'lightDistance', 1, 20).name('光照距离').onChange(updateLightParameters);
lightFolder.add(params, 'lightDecay', 0, 2).name('光照衰减').onChange(updateLightParameters);

// 添加焦点跟踪控制
const trackingFolder = gui.addFolder('焦点跟踪');
trackingFolder.add(params, 'focusTrackingEnabled').name('启用焦点跟踪').onChange(value => {
    // 确保追踪球存在 - 无论焦点跟踪是否启用，追踪球都应该存在
    if (!trackingBall) {
        createTrackingBall();
    }
    
    // 如果启用焦点跟踪，则禁用自定义焦点
    if (value && params.customFocusEnabled) {
        params.customFocusEnabled = false;
        // 如果有customFocusController，则更新其UI
        if (customFocusController) {
            customFocusController.updateDisplay();
        }
    }
});
trackingFolder.add(params, 'trackingBallSpeed', 0.1, 3).name('跟踪球速度');
trackingFolder.add(params, 'trackingBallSize', 0.5, 3).name('跟踪球大小').onChange(value => {
    if (trackingBall) {
        scene.remove(trackingBall);
        createTrackingBall();
    }
});
trackingFolder.add(params, 'focusOffset', -5, 5).name('焦点偏移');

// 添加自定义焦点控制
const customFocusFolder = gui.addFolder('自定义焦点');
const customFocusController = customFocusFolder.add(params, 'customFocusEnabled').name('启用自定义焦点').onChange(value => {
    // 如果启用自定义焦点，则禁用跟踪球焦点（但不影响追踪球的运动）
    if (value && params.focusTrackingEnabled) {
        params.focusTrackingEnabled = false;
        // 更新trackingFolder中focusTrackingEnabled控制器的显示
        for (const controller of trackingFolder.controllers) {
            if (controller.property === 'focusTrackingEnabled') {
                controller.updateDisplay();
                break;
            }
        }
    }
    
    // 确保追踪球存在，无论焦点跟踪是否启用
    if (!trackingBall) {
        createTrackingBall();
    }
    
    // 突出显示当前选择的焦点球
    highlightCustomFocusBall();
});

// 添加自定义焦点小球选择器
const ballSelector = customFocusFolder.add(params, 'customFocusBallIndex', -1, allSpheres.length - 1, 1).name('选择焦点球').onChange(value => {
    // 突出显示选中的小球
    highlightCustomFocusBall();
});

// 自定义焦点偏移
customFocusFolder.add(params, 'customFocusOffset', -5, 5, 0.1).name('焦点偏移');

// 添加随机选择按钮
customFocusFolder.add({
    randomSelect: function() {
        // 随机选择一个小球作为焦点
        params.customFocusBallIndex = Math.floor(Math.random() * allSpheres.length);
        ballSelector.updateDisplay(); // 更新UI显示
        // 突出显示选中的小球
        highlightCustomFocusBall();
    }
}, 'randomSelect').name('随机选择');

// 添加点击切换焦点的功能
let clickToFocusEnabled = false;
customFocusFolder.add({
    toggleClickToFocus: function() {
        clickToFocusEnabled = !clickToFocusEnabled;
        return clickToFocusEnabled;
    }
}, 'toggleClickToFocus').name('点击选择焦点球').listen();

// 添加跟踪小球外观控制
const trackingAppearanceFolder = trackingFolder.addFolder('跟踪球外观');

// 颜色选择器
trackingAppearanceFolder.addColor(params, 'trackingBallColor').name('小球颜色').onChange(() => {
    if (trackingBall) {
        createTrackingBall(); // 重新创建以应用新颜色
    }
});

// 发光开关
trackingAppearanceFolder.add(params, 'trackingBallEmissive').name('启用发光').onChange(() => {
    if (trackingBall) {
        createTrackingBall(); // 重新创建以应用发光效果
    }
});

// 发光颜色选择器（仅当发光开启时才有效）
trackingAppearanceFolder.addColor(params, 'trackingBallEmissiveColor').name('发光颜色').onChange(() => {
    if (trackingBall && params.trackingBallEmissive) {
        createTrackingBall(); // 重新创建以应用新的发光颜色
    }
});

// 形状选择器
trackingAppearanceFolder.add(params, 'trackingBallShape', ['sphere', 'cube', 'torus', 'cone']).name('形状').onChange(() => {
    if (trackingBall) {
        createTrackingBall(); // 重新创建以应用新形状
    }
});

// 添加自转控制
const trackingRotationFolder = trackingFolder.addFolder('跟踪球自转');

// 自转开关
trackingRotationFolder.add(params, 'trackingBallRotate').name('启用自转').onChange(() => {
    if (trackingBall && !params.trackingBallRotate) {
        // 重置旋转
        trackingBall.rotation.set(0, 0, 0);
    }
});

// 自转速度
trackingRotationFolder.add(params, 'trackingBallRotateSpeed', 0.1, 5).name('自转速度');

// 自转轴选择
trackingRotationFolder.add(params, 'trackingBallRotateAxis', ['x', 'y', 'z', 'random']).name('自转轴');

// 在GUI中添加地板控制
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
    createFloor(); // 重新创建地板以更新贴图重复
});
floorFolder.add(params, 'floorBrightness', 0.5, 3).name('地板亮度').onChange(updateFloor);

// 在GUI中添加相机控制
const cameraFolder = gui.addFolder('运镜控制');
let cameraAutoController = cameraFolder.add(cameraParams, 'autoCamera').name('启用自动运镜').onChange(value => {
    // 如果启用自动运镜但没有激活的相机路径
    if (value && !activeCameraPath) {
        generateAllCameraPaths();
        setCameraPath(cameraParams.currentPath);
    }
    
    if (value) {
        // 降低轨道控制器的阻尼，使相机动作更流畅
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
    } else {
        // 隐藏所有路径线
        for (const name in cameraPaths) {
            const path = cameraPaths[name];
            if (path.line) {
                path.line.visible = false;
            }
        }
    }
    
    // 更新控制器状态
    controls.enabled = !value || cameraParams.pathWeight < 1.0;
});
cameraFolder.add(cameraParams, 'currentPath', ['spiral', 'swing', 'random', 'closeup', 'flyby']).name('相机路径').onChange(value => {
    if (cameraParams.autoCamera) {
        setCameraPath(value);
    }
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
    // 如果权重为1，则完全禁用轨道控制
    controls.enabled = value < 0.99;
});
cameraFolder.add(cameraParams, 'randomJump').name('随机跳转');
cameraFolder.add(cameraParams, 'jumpInterval', 3, 30).name('跳转间隔(秒)');

// 添加相机位置重置按钮
cameraFolder.add({
    resetCamera: function() {
        // 重置相机位置
        camera.position.set(0, 0, 20);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}, 'resetCamera').name('重置相机位置');

// events
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    // 获取three-container的实际尺寸，而不是整个窗口尺寸
    const threeContainer = document.getElementById('three-container');
    let width, height;
    
    if (threeContainer) {
        const rect = threeContainer.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
    } else {
        // 如果容器不存在，回退到窗口尺寸
        width = window.innerWidth;
        height = window.innerHeight;
    }

    // 更新相机
    if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    // 更新渲染器
    if (renderer) {
        renderer.setSize(width, height);
    }
    
    // 更新后期处理器
    if (composer) {
        composer.setSize(width, height);
    }
    
    // 更新景深效果的分辨率，使用1.5倍分辨率以获得更好的质量
    if (bokehParams) {
        bokehParams.width = width * 1.5;
        bokehParams.height = height * 1.5;
    
        // 更新景深效果的渲染目标 - 添加安全检查
        if (bokehPass && typeof bokehPass === 'object') {
            if (bokehPass.renderTargetDepth && typeof bokehPass.renderTargetDepth.setSize === 'function') {
                bokehPass.renderTargetDepth.setSize(bokehParams.width, bokehParams.height);
            }
            if (bokehPass.renderTargetColor && typeof bokehPass.renderTargetColor.setSize === 'function') {
                bokehPass.renderTargetColor.setSize(bokehParams.width, bokehParams.height);
            }
        }
    }
}

// 为场景添加微小的动态效果
function addSubtleMovement() {
    const time = clock.getElapsedTime() * 0.2;
    
    // 给一些小球添加微小的浮动运动，调整为更柔和的效果
    for (let i = 0; i < allSpheres.length; i++) {
        const sphere = allSpheres[i];
        // 大幅减小振幅和频率，使运动更加平滑
        const amplitude = 0.005 + (i % 5) * 0.001; // 固定振幅，避免随机抖动
        const frequency = 0.2 + (i % 7) * 0.05;    // 降低频率，使运动更缓慢
        
        // 应用轻微浮动效果，使用固定的正弦函数
        sphere.position.y = sphere.userData.originalY + Math.sin(time * frequency + i) * amplitude;
    }
    
    // 灯光颜色变化
    light1.color.setHSL((Math.sin(time * 0.3) + 1) * 0.5, 0.7, 0.5);
    light2.color.setHSL((Math.sin(time * 0.4 + 2) + 1) * 0.5, 0.7, 0.5);
    light3.color.setHSL((Math.sin(time * 0.5 + 4) + 1) * 0.5, 0.7, 0.5);
}

// 闪烁动画变量
let clock = new THREE.Clock();
let lastTime = 0;

// 更新场景的反射环境
function updateSceneEnvironment() {
    // 临时隐藏要生成反射的物体
    scene.background = new THREE.Color(0x000000);
    
    // 生成环境反射贴图
    const sceneEnv = pmremGenerator.fromScene(scene).texture;
    
    // 将生成的环境反射应用到所有小球上
    scene.environment = sceneEnv;
}

// 创建焦点跟踪小球
let trackingBall = null;
let trackingBallPath = null;
let trackingBallEnvMap = null; // 追踪球专用环境贴图
let lastTrackingBallUpdate = 0; // 上次更新环境贴图的时间

// 创建焦点跟踪小球的函数
function createTrackingBall() {
    if (trackingBall) {
        scene.remove(trackingBall);
        if (trackingBallPath) scene.remove(trackingBallPath);
    }
    
    // 初始化追踪球专用的立方体相机和渲染目标
    if (!trackingBallEnvMap) {
        trackingBallEnvMap = {
            renderTarget: new THREE.WebGLCubeRenderTarget(256, {
                generateMipmaps: true,
                minFilter: THREE.LinearMipmapLinearFilter,
                magFilter: THREE.LinearFilter
            }),
            camera: new THREE.CubeCamera(0.1, 1000, null) // camera在构造函数中会被设置
        };
        trackingBallEnvMap.camera = new THREE.CubeCamera(0.1, 1000, trackingBallEnvMap.renderTarget);
        scene.add(trackingBallEnvMap.camera);
    }
    
    // 根据用户选择的形状创建几何体
    let trackingGeometry;
    switch(params.trackingBallShape) {
        case 'sphere':
            trackingGeometry = new THREE.SphereGeometry(params.trackingBallSize, 32, 32);
            break;
        case 'cube':
            trackingGeometry = new THREE.BoxGeometry(
                params.trackingBallSize * 1.5, 
                params.trackingBallSize * 1.5, 
                params.trackingBallSize * 1.5
            );
            break;
        case 'torus':
            trackingGeometry = new THREE.TorusGeometry(
                params.trackingBallSize, 
                params.trackingBallSize / 3, 
                16, 
                100
            );
            break;
        case 'cone':
            trackingGeometry = new THREE.ConeGeometry(
                params.trackingBallSize,
                params.trackingBallSize * 2,
                32
            );
            break;
        default:
            trackingGeometry = new THREE.SphereGeometry(params.trackingBallSize, 32, 32);
    }
    
    // 处理发光属性
    const emissiveColor = params.trackingBallEmissive ? 
                          new THREE.Color(params.trackingBallEmissiveColor) : 
                          new THREE.Color(0x000000);
    
    const emissiveIntensity = params.trackingBallEmissive ? 0.8 : 0;
    
    // 创建材质 - 使用高反射度材质
    const trackingMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(params.trackingBallColor),
        emissive: emissiveColor,
        emissiveIntensity: emissiveIntensity,
        roughness: 0.1,
        metalness: 0.9,
        envMapIntensity: 2.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0
    });
    
    trackingBall = new THREE.Mesh(trackingGeometry, trackingMaterial);
    
    // 设置初始位置
    trackingBall.position.set(0, 0, 0);
    
    // 创建轨迹路径（一个圆环）
    const pathRadius = 8; // 路径半径
    const pathSegments = 64; // 路径分段数
    const pathGeometry = new THREE.BufferGeometry();
    const pathVertices = [];
    
    for (let i = 0; i <= pathSegments; i++) {
        const theta = (i / pathSegments) * Math.PI * 2;
        pathVertices.push(
            pathRadius * Math.cos(theta),
            0,
            pathRadius * Math.sin(theta)
        );
    }
    
    pathGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pathVertices, 3));
    
    const pathMaterial = new THREE.LineBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.3
    });
    
    trackingBallPath = new THREE.Line(pathGeometry, pathMaterial);
    
    // 添加到场景
    scene.add(trackingBall);
    scene.add(trackingBallPath);
    
    // 进行一次初始环境贴图更新
    updateTrackingBallEnvironmentMap();
    
    return trackingBall;
}

// 更新追踪球的环境贴图
function updateTrackingBallEnvironmentMap() {
    if (!trackingBall || !trackingBallEnvMap) return;
    
    // 降低性能损耗：使用低分辨率进行快速更新
    const currentTime = performance.now();
    const timeDiff = currentTime - lastTrackingBallUpdate;
    
    // 确保至少有一定的时间间隔以避免过度渲染
    if (timeDiff < 16) { // 约60fps的更新率
        return;
    }
    
    lastTrackingBallUpdate = currentTime;
    
    // 暂时隐藏被追踪的小球，以避免在环境贴图中看到自己
    trackingBall.visible = false;
    
    // 为了提高性能，在更新时临时降低其他物体的复杂度
    const originalBokehEnabled = bokehPass.enabled;
    bokehPass.enabled = false; // 临时禁用景深效果
    
    // 更新立方体相机位置
    trackingBallEnvMap.camera.position.copy(trackingBall.position);
    
    // 更新环境贴图
    trackingBallEnvMap.camera.update(renderer, scene);
    
    // 应用环境贴图到追踪球材质
    trackingBall.material.envMap = trackingBallEnvMap.renderTarget.texture;
    trackingBall.material.needsUpdate = true;
    
    // 恢复追踪球可见性
    trackingBall.visible = true;
    
    // 恢复之前的渲染设置
    bokehPass.enabled = originalBokehEnabled;
}

// 更新跟踪小球位置的函数
function updateTrackingBall(time) {
    if (!trackingBall) return;
    
    // 让小球沿着路径运动 - 无论焦点追踪是否启用，小球都应该继续运动
    const pathRadius = 8;
    const angle = time * params.trackingBallSpeed * 0.5; // 控制运动速度
    
    trackingBall.position.x = pathRadius * Math.cos(angle);
    trackingBall.position.z = pathRadius * Math.sin(angle);
    trackingBall.position.y = Math.sin(angle * 2) * 2; // 添加上下运动
    
    // 添加自转效果
    if (params.trackingBallRotate) {
        const rotationSpeed = time * params.trackingBallRotateSpeed * 2;
        
        switch(params.trackingBallRotateAxis) {
            case 'x':
                trackingBall.rotation.x = rotationSpeed;
                break;
            case 'y':
                trackingBall.rotation.y = rotationSpeed;
                break;
            case 'z':
                trackingBall.rotation.z = rotationSpeed;
                break;
            case 'random':
                // 在所有轴上旋转，但速度不同，产生更复杂的旋转效果
                trackingBall.rotation.x = rotationSpeed * 0.7;
                trackingBall.rotation.y = rotationSpeed * 1.3;
                trackingBall.rotation.z = rotationSpeed * 0.5;
                break;
            default:
                trackingBall.rotation.y = rotationSpeed;
        }
        
        // 如果是环形，添加特殊旋转逻辑，使其看起来像是在滚动
        if (params.trackingBallShape === 'torus') {
            // 计算运动方向的切线
            const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
            // 将旋转轴设置为垂直于运动路径的方向
            const rotationAxis = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
            
            // 创建一个四元数来表示旋转
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(rotationAxis, rotationSpeed);
            
            // 应用旋转
            trackingBall.quaternion.copy(quaternion);
        }
    }
    
    // 更高频率更新环境贴图
    // 每帧更新，但使用防抖动技术，只在小球移动一定距离后才更新
    if (trackingBall.userData.lastEnvMapPos === undefined) {
        trackingBall.userData.lastEnvMapPos = trackingBall.position.clone();
        updateTrackingBallEnvironmentMap();
    } else {
        // 计算与上次更新位置的距离
        const moveDist = trackingBall.position.distanceTo(trackingBall.userData.lastEnvMapPos);
        // 当移动超过阈值或者达到时间间隔时更新
        if (moveDist > 0.2 || Math.floor(time * 30) % 5 === 0) {  // 移动0.2单位或每1/6秒
            trackingBall.userData.lastEnvMapPos.copy(trackingBall.position);
            updateTrackingBallEnvironmentMap();
        }
    }
}

// 相机路径系统
const cameraPaths = {};
let activeCameraPath = null;
let lastPathUpdateTime = 0;
let lastJumpTime = 0;
let cameraTransitioning = false;
let transitionStartTime = 0;
let transitionFromPosition = new THREE.Vector3();
let transitionFromTarget = new THREE.Vector3();
let transitionToPosition = new THREE.Vector3();
let transitionToTarget = new THREE.Vector3();

// 创建相机路径
function createCameraPaths() {
    // 螺旋上升路径
    const spiralPath = {
        points: [],
        targets: [],
        create: () => {
            const points = [];
            const targets = [];
            const loops = 3;
            const pointsPerLoop = 60;
            const totalPoints = loops * pointsPerLoop;
            
            for (let i = 0; i < totalPoints; i++) {
                const angle = (i / pointsPerLoop) * Math.PI * 2;
                const radius = 15 + Math.sin(i * 0.1) * 5;
                const height = -5 + (i / totalPoints) * 15;
                
                const x = Math.cos(angle) * radius;
                const y = height;
                const z = Math.sin(angle) * radius;
                
                points.push(new THREE.Vector3(x, y, z));
                
                // 注视点位置，添加一些随机偏移以获得更自然的镜头感
                const targetOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                );
                targets.push(targetOffset);
            }
            
            return { points, targets };
        }
    };
    
    // 环形摇摆路径
    const swingPath = {
        points: [],
        targets: [],
        create: () => {
            const points = [];
            const targets = [];
            const totalPoints = 120;
            
            for (let i = 0; i < totalPoints; i++) {
                const angle = (i / totalPoints) * Math.PI * 2;
                // 基础半径
                const baseRadius = 12;
                // 添加垂直摇摆
                const verticalSwing = Math.sin(angle * 3) * 4;
                // 添加半径变化
                const radiusVar = Math.cos(angle * 2) * 4;
                
                const x = Math.cos(angle) * (baseRadius + radiusVar);
                const y = verticalSwing;
                const z = Math.sin(angle) * (baseRadius + radiusVar);
                
                points.push(new THREE.Vector3(x, y, z));
                
                // 注视点随机摇摆
                const swingFactor = 0.3;
                const targetOffset = new THREE.Vector3(
                    Math.sin(angle * 5) * swingFactor,
                    Math.cos(angle * 7) * swingFactor,
                    Math.sin(angle * 6) * swingFactor
                );
                targets.push(targetOffset);
            }
            
            return { points, targets };
        }
    };
    
    // 随机穿梭路径
    const randomPath = {
        points: [],
        targets: [],
        create: () => {
            const points = [];
            const targets = [];
            const totalPoints = 100;
            
            // 创建一些随机点簇
            const clusters = [];
            for (let i = 0; i < 8; i++) {
                clusters.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 30,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 30
                ));
            }
            
            // 用曲线连接这些点簇
            for (let i = 0; i < totalPoints; i++) {
                const t = i / totalPoints;
                // 使用噪声来选择聚类
                const clusterIndex1 = Math.floor(t * clusters.length) % clusters.length;
                const clusterIndex2 = (clusterIndex1 + 1) % clusters.length;
                
                // 在两个聚类之间进行插值
                const lerpFactor = (t * clusters.length) % 1;
                const p1 = clusters[clusterIndex1];
                const p2 = clusters[clusterIndex2];
                
                // 使用三次贝塞尔曲线创建平滑路径
                const controlPoint1 = new THREE.Vector3(
                    p1.x + (Math.random() - 0.5) * 10,
                    p1.y + (Math.random() - 0.5) * 5,
                    p1.z + (Math.random() - 0.5) * 10
                );
                
                const controlPoint2 = new THREE.Vector3(
                    p2.x + (Math.random() - 0.5) * 10,
                    p2.y + (Math.random() - 0.5) * 5,
                    p2.z + (Math.random() - 0.5) * 10
                );
                
                // 三次贝塞尔曲线插值
                const point = new THREE.Vector3();
                point.x = bezierInterpolation(p1.x, controlPoint1.x, controlPoint2.x, p2.x, lerpFactor);
                point.y = bezierInterpolation(p1.y, controlPoint1.y, controlPoint2.y, p2.y, lerpFactor);
                point.z = bezierInterpolation(p1.z, controlPoint1.z, controlPoint2.z, p2.z, lerpFactor);
                
                points.push(point);
                
                // 为每个点创建一个随机目标偏移
                const targetOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 3
                );
                targets.push(targetOffset);
            }
            
            return { points, targets };
        }
    };
    
    // 慢速特写路径 - 近距离观察小球
    const closeupPath = {
        points: [],
        targets: [],
        create: () => {
            const points = [];
            const targets = [];
            const totalPoints = 150;
            
            // 选择几个小球作为特写目标
            const targetSpheres = [];
            for (let i = 0; i < 10; i++) {
                const randomIndex = Math.floor(Math.random() * allSpheres.length);
                targetSpheres.push(allSpheres[randomIndex]);
            }
            
            // 为每个目标小球创建一个环绕路径
            for (let i = 0; i < totalPoints; i++) {
                const t = i / totalPoints;
                const sphereIndex = Math.floor(t * targetSpheres.length);
                const sphere = targetSpheres[sphereIndex % targetSpheres.length];
                
                // 在球体周围创建近距离环绕路径
                const angleOffset = (t * targetSpheres.length) % 1 * Math.PI * 4; // 在每个球周围转两圈
                const radius = 2 + Math.sin(t * Math.PI * 10) * 0.5; // 小范围变化半径
                const heightOffset = Math.cos(t * Math.PI * 8) * 0.7; // 上下摇摆
                
                const x = sphere.position.x + Math.cos(angleOffset) * radius;
                const y = sphere.position.y + heightOffset;
                const z = sphere.position.z + Math.sin(angleOffset) * radius;
                
                points.push(new THREE.Vector3(x, y, z));
                
                // 注视目标就是球体位置
                targets.push(new THREE.Vector3(
                    sphere.position.x,
                    sphere.position.y,
                    sphere.position.z
                ));
            }
            
            return { points, targets };
        }
    };
    
    // 高速穿越路径
    const flybyPath = {
        points: [],
        targets: [],
        create: () => {
            const points = [];
            const targets = [];
            const totalPoints = 120;
            
            // 创建一条穿过小球群的路径
            for (let i = 0; i < totalPoints; i++) {
                const t = i / totalPoints;
                
                // 使用参数方程创建一条复杂路径
                const angle = t * Math.PI * 6; // 多次穿越
                const radius = 20 - t * 15; // 逐渐缩小半径
                const height = Math.sin(t * Math.PI * 3) * 10; // 上下起伏
                
                const x = Math.cos(angle) * radius;
                const y = height;
                const z = Math.sin(angle) * radius;
                
                points.push(new THREE.Vector3(x, y, z));
                
                // 注视点总是稍微领先于当前位置
                const lookAheadFactor = 0.05;
                const nextIndex = Math.min(i + 1, totalPoints - 1);
                const nextT = nextIndex / totalPoints;
                const nextAngle = nextT * Math.PI * 6;
                const nextRadius = 20 - nextT * 15;
                const nextHeight = Math.sin(nextT * Math.PI * 3) * 10;
                
                const targetX = Math.cos(nextAngle) * nextRadius;
                const targetY = nextHeight;
                const targetZ = Math.sin(nextAngle) * nextRadius;
                
                targets.push(new THREE.Vector3(targetX, targetY, targetZ));
            }
            
            return { points, targets };
        }
    };
    
    // 注册所有路径
    cameraPaths.spiral = spiralPath;
    cameraPaths.swing = swingPath;
    cameraPaths.random = randomPath;
    cameraPaths.closeup = closeupPath;
    cameraPaths.flyby = flybyPath;
}

// 贝塞尔插值函数
function bezierInterpolation(p0, p1, p2, p3, t) {
    const oneMinusT = 1 - t;
    return Math.pow(oneMinusT, 3) * p0 + 
           3 * Math.pow(oneMinusT, 2) * t * p1 + 
           3 * oneMinusT * Math.pow(t, 2) * p2 + 
           Math.pow(t, 3) * p3;
}

// 生成所有相机路径
function generateAllCameraPaths() {
    for (const pathName in cameraPaths) {
        const path = cameraPaths[pathName];
        const { points, targets } = path.create();
        path.points = points;
        path.targets = targets;
        
        // 创建可视化路径线
        if (path.line) {
            scene.remove(path.line);
        }
        
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const pathMaterial = new THREE.LineBasicMaterial({ 
            color: 0x444444, 
            transparent: true, 
            opacity: 0.3 
        });
        path.line = new THREE.Line(pathGeometry, pathMaterial);
        path.line.visible = false;
        scene.add(path.line);
    }
}

// 设置当前相机路径
function setCameraPath(pathName) {
    if (!cameraPaths[pathName]) {
        console.warn(`路径 "${pathName}" 不存在`);
        return;
    }
    
    // 如果已经是当前路径，不做任何操作
    if (activeCameraPath && activeCameraPath === cameraPaths[pathName]) {
        return;
    }
    
    // 如果需要平滑过渡
    if (cameraParams.smoothTransition && activeCameraPath) {
        // 保存当前位置和目标
        transitionFromPosition.copy(camera.position);
        
        // 计算当前目标点
        const currentTargetOffset = new THREE.Vector3();
        if (cameraParams.lookAtCenter) {
            currentTargetOffset.copy(cameraParams.lookAtOffset);
        } else {
            // 如果不看向中心，则尝试读取当前的目标点
            if (activeCameraPath) {
                const currentPathPos = getPathPosition(activeCameraPath, lastPathUpdateTime);
                if (currentPathPos && currentPathPos.target) {
                    currentTargetOffset.copy(currentPathPos.target);
                }
            }
        }
        transitionFromTarget.copy(currentTargetOffset);
        
        // 设置目标位置和注视点
        const newPathPos = getPathPosition(cameraPaths[pathName], 0);
        if (newPathPos) {
            transitionToPosition.copy(newPathPos.position);
            transitionToTarget.copy(newPathPos.target);
        }
        
        // 开始过渡
        cameraTransitioning = true;
        transitionStartTime = clock.getElapsedTime();
    }
    
    // 设置新的活动路径
    activeCameraPath = cameraPaths[pathName];
    lastPathUpdateTime = 0;
    
    // 更新路径线可见性
    for (const name in cameraPaths) {
        const path = cameraPaths[name];
        if (path.line) {
            path.line.visible = (name === pathName);
        }
    }
}

// 在路径上获取相机位置
function getPathPosition(path, time) {
    if (!path || !path.points || path.points.length === 0) {
        return null;
    }
    
    const points = path.points;
    const targets = path.targets;
    
    // 计算索引
    const totalPoints = points.length;
    const wrappedIndex = Math.floor(time) % totalPoints;
    const nextIndex = (wrappedIndex + 1) % totalPoints;
    const fraction = time - Math.floor(time);
    
    // 在两点之间插值
    const position = new THREE.Vector3();
    position.lerpVectors(points[wrappedIndex], points[nextIndex], fraction);
    
    // 计算注视点
    let target;
    if (cameraParams.lookAtCenter) {
        target = cameraParams.lookAtOffset.clone();
    } else if (targets && targets.length > 0) {
        target = new THREE.Vector3();
        const targetA = targets[wrappedIndex];
        const targetB = targets[nextIndex];
        target.lerpVectors(targetA, targetB, fraction);
    } else {
        target = new THREE.Vector3();
    }
    
    return { position, target };
}

// 更新相机位置
function updateCameraPosition(time) {
    if (!cameraParams.autoCamera || !activeCameraPath) {
        return;
    }
    
    // 如果正在过渡中
    if (cameraTransitioning) {
        const elapsed = time - transitionStartTime;
        const duration = cameraParams.transitionDuration;
        
        if (elapsed >= duration) {
            // 过渡结束
            cameraTransitioning = false;
        } else {
            // 使用平滑的过渡函数
            const t = elapsed / duration;
            const smoothT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            // 插值位置和目标
            const position = new THREE.Vector3();
            position.lerpVectors(transitionFromPosition, transitionToPosition, smoothT);
            
            const target = new THREE.Vector3();
            target.lerpVectors(transitionFromTarget, transitionToTarget, smoothT);
            
            // 应用新的位置和注视点
            camera.position.copy(position);
            
            if (cameraParams.lookAtCenter) {
                camera.lookAt(target);
            }
            
            // 禁用轨道控制器更新
            controls.enabled = false;
            
            return;
        }
    }
    
    // 检查是否需要随机跳转
    if (cameraParams.randomJump) {
        const jumpElapsed = time - lastJumpTime;
        if (jumpElapsed > cameraParams.jumpInterval) {
            // 随机设置路径时间
            lastPathUpdateTime = Math.random() * activeCameraPath.points.length;
            lastJumpTime = time;
        }
    }
    
    // 更新路径进度
    const pathSpeed = cameraParams.pathSpeed;
    lastPathUpdateTime += pathSpeed * 0.05;
    
    // 获取当前路径位置
    const pathPos = getPathPosition(activeCameraPath, lastPathUpdateTime);
    if (!pathPos) return;
    
    // 平滑混合轨道控制器和路径动画
    const weight = cameraParams.pathWeight;
    
    // 保存轨道控制器的当前位置
    const orbitPosition = controls.object.position.clone();
    
    // 混合位置
    camera.position.lerpVectors(orbitPosition, pathPos.position, weight);
    
    // 更新相机视野
    camera.fov = cameraParams.cameraFov;
    camera.updateProjectionMatrix();
    
    // 如果需要看向中心
    if (cameraParams.lookAtCenter) {
        camera.lookAt(pathPos.target);
    }
    
    // 通知轨道控制器相机位置已更改
    controls.update();
}

// 控制渲染循环的标志，在最开始已声明，此处不再重新声明

// 启动渲染循环
function startRendering() {
    if (!isRendering) {
        isRendering = true;
        requestAnimationFrame(animate);

    }
}

// 停止渲染循环
function stopRendering() {
    isRendering = false;

}

// animate
function animate() {
    if (!isRendering) return;
    
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    
    // 每隔一段时间更新一次场景环境反射
    if (Math.floor(time * 2) % 10 === 0) {
        updateSceneEnvironment();
    }
    
    // 处理所有活跃小球的闪烁效果，统一使用一种闪烁逻辑
    if (activeSpheres.length > 0) {
        for (const sphere of activeSpheres) {
            if (!sphere.userData.active) continue;
            
            let flickerValue = 0;
            
            if (params.enableFlicker) {
                // 正常闪烁模式 - 使用正弦函数产生平滑的闪烁
                flickerValue = Math.abs(Math.sin(time * Math.PI * params.flickerFrequency));
            } else if (params.enableStepperSync && sphere.userData.flickerStartTime) {
                // 步进器触发的闪烁 - 使用时间衰减
                const elapsed = time - sphere.userData.flickerStartTime;
                
                // 如果在闪烁持续时间内
                if (elapsed < params.stepperFlickerDuration) {
                    // 瞬间点亮，然后缓慢淡出 (指数衰减)
                    flickerValue = Math.pow(1 - (elapsed / params.stepperFlickerDuration), 1.5);
                } else {
                    // 闪烁结束，移除标记
                    delete sphere.userData.flickerStartTime;
                    // 使用0表示不闪烁
                    flickerValue = 0;
                }
            } else {
                // 不闪烁
                flickerValue = 0;
            }
            
            // 根据闪烁值应用发光效果
            if (flickerValue > 0) {
                // 瞬间达到最高亮度，然后根据闪烁值渐变回正常亮度
                const maxIntensity = params.stepperFlickerIntensity; // 最大发光强度
                const normalIntensity = 2.0; // 正常发光强度
                
                // 计算当前强度 - 从最高开始，逐渐降低
                const intensity = normalIntensity + flickerValue * (maxIntensity - normalIntensity);
                
                // 应用发光强度
                sphere.material.emissiveIntensity = intensity;
                
                // 同步更新小球对应的光源强度
                if (sphereLights.has(sphere)) {
                    const light = sphereLights.get(sphere);
                    light.intensity = intensity * params.lightIntensity / 2;
                }
            } else if (!params.enableFlicker && !sphere.userData.flickerStartTime) {
                // 如果不是正在闪烁，设置为常规发光状态
                sphere.material.emissiveIntensity = 2.0;
                
                // 更新光源
                if (sphereLights.has(sphere)) {
                    const light = sphereLights.get(sphere);
                    light.intensity = params.lightIntensity;
                }
            }
        }
    }
    
    // 更新光源
    updateLights();
    
    // 添加微小的动态效果
    addSubtleMovement();
    
    // 更新跟踪小球
    updateTrackingBall(time);
    
    // 更新相机路径动画
    updateCameraPosition(time);
    
    // 更新焦点
    updateFocus(time);
    
    controls.update();
    composer.render();
}

// 创建地板
let floor = null;
const floorTextureLoader = new THREE.TextureLoader();

function createFloor() {
    // 移除现有地板（如果存在）
    if (floor) {
        scene.remove(floor);
    }
    
    // 如果地板不可见，则直接返回
    if (!params.floorVisible) {
        return;
    }
    
    // 加载地板贴图
    floorTextureLoader.load('floor.jpg', (texture) => {
        // 设置贴图重复
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat); // 贴图重复次数
        
        // 创建法线贴图以增强细节
        const normalMap = floorTextureLoader.load('floor.jpg', (normalTexture) => {
            // 将普通贴图当作法线贴图使用
            normalTexture.wrapS = THREE.RepeatWrapping;
            normalTexture.wrapT = THREE.RepeatWrapping;
            normalTexture.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);
        });
        
        // 创建地板平面 - 使用更大的几何体细分以获得更好的反射效果
        const floorGeometry = new THREE.PlaneGeometry(params.floorSize, params.floorSize, 32, 32);
        
        // 使用MeshPhysicalMaterial代替MeshStandardMaterial，获得更好的物理特性
        const floorMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            normalMap: normalMap,
            normalScale: new THREE.Vector2(0.3, 0.3), // 降低法线影响
            side: THREE.DoubleSide,
            transparent: true,
            opacity: params.floorOpacity,
            roughness: 1 - params.floorReflectivity, // 反射率影响粗糙度
            metalness: 0.1,      // 降低金属感
            reflectivity: params.floorReflectivity * 1.5, // 增强反射
            clearcoat: 0.5,      // 添加清漆效果
            clearcoatRoughness: 0.2, // 清漆粗糙度
        });
        
        // 增加亮度效果
        floorMaterial.map.encoding = THREE.sRGBEncoding; // 使用sRGB编码提高亮度
        floorMaterial.color = new THREE.Color(params.floorBrightness, params.floorBrightness, params.floorBrightness); // 设置颜色以增加亮度
        
        floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = Math.PI / 2; // 使平面水平放置
        floor.position.y = params.floorHeight;
        
        // 接收阴影
        floor.receiveShadow = true;
        
        scene.add(floor);
        
        // 创建雾效果增强无限延伸的感觉 - 使用更轻微的雾
        scene.fog = new THREE.FogExp2(0x000000, 0.005);
    }, 
    // 加载进度处理
    undefined, 
    // 加载错误处理
    (error) => {
        console.error('地板贴图加载失败:', error);
        // 加载失败时创建一个默认地板
        createDefaultFloor();
    });
}

// 创建默认地板（无贴图）
function createDefaultFloor() {
    const floorGeometry = new THREE.PlaneGeometry(params.floorSize, params.floorSize, 32, 32);
    const floorMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x202020), // 使用深灰色作为基色
        side: THREE.DoubleSide,
        transparent: true,
        opacity: params.floorOpacity,
        roughness: 1 - params.floorReflectivity,
        metalness: 0.1, // 降低金属感
        reflectivity: params.floorReflectivity * 1.5, // 增强反射
        clearcoat: 0.5, // 添加清漆效果
        clearcoatRoughness: 0.2, // 清漆粗糙度
    });
    
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = params.floorHeight;
    floor.receiveShadow = true;
    
    scene.add(floor);
    
    // 创建雾效果增强无限延伸的感觉 - 使用更轻微的雾
    scene.fog = new THREE.FogExp2(0x000000, 0.005);
}

// 更新地板参数
function updateFloor() {
    if (!floor) return;
    
    floor.position.y = params.floorHeight;
    floor.scale.set(params.floorSize/30, params.floorSize/30, 1);
    
    if (floor.material) {
        // 更新基本属性
        floor.material.opacity = params.floorOpacity;
        floor.material.roughness = 1 - params.floorReflectivity;
        
        // 更新物理材质特有的属性
        if (floor.material.type === 'MeshPhysicalMaterial') {
            floor.material.reflectivity = params.floorReflectivity * 1.5;
            floor.material.metalness = 0.1; // 保持金属感低
            floor.material.clearcoat = 0.5; // 保持清漆效果
            floor.material.clearcoatRoughness = 0.2; // 清漆粗糙度
        } else {
            // 如果是标准材质
            floor.material.metalness = 0.1;
        }
        
        // 更新亮度
        if (floor.material.map) {
            floor.material.color.setScalar(params.floorBrightness);
        } else {
            // 对于没有贴图的地板，使用深灰色
            floor.material.color.set(0x202020);
            // 根据亮度调整颜色
            floor.material.color.multiplyScalar(params.floorBrightness);
        }
        
        // 更新贴图重复
        if (floor.material.map) {
            floor.material.map.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);
            if (floor.material.normalMap) {
                floor.material.normalMap.repeat.set(params.floorTextureRepeat, params.floorTextureRepeat);
            }
            floor.material.needsUpdate = true;
        }
    }
    
    // 更新雾效果
    if (scene.fog) {
        scene.fog.density = 0.005 / (params.floorSize / 100); // 根据地板大小调整雾的密度
    }
}

// 初始化场景环境贴图
updateSceneEnvironment();

// 创建地板
createFloor();

// 确保初始化时创建跟踪球，无论焦点跟踪是否启用
createTrackingBall();

// 创建相机路径
createCameraPaths();

// 由于自动运镜默认开启，所以初始化时生成所有路径并设置初始路径
generateAllCameraPaths();
setCameraPath(cameraParams.currentPath);

// 确保渲染通道按照bloomFirst参数正确排列
if (!bokehParams.bloomFirst) {
    // 重新排列渲染通道，先景深后泛光
    composer.passes = [
        composer.passes[0], // RenderPass
        bokehPass,          // BokehPass
        bloomPass           // BloomPass
    ];
}

// 确保bokehPass启用状态正确
bokehPass.enabled = bokehParams.enabled;

// 初始化焦点显示
if (params.customFocusEnabled && params.customFocusBallIndex >= 0) {
    // 如果启用了自定义焦点，则禁用跟踪球焦点
    params.focusTrackingEnabled = false;
    // 突出显示自定义焦点球
    highlightCustomFocusBall();
}

// 调用animate()一次以启动渲染循环
// 即使初始时隐藏场景，也需要调用一次，这样当显示时才能恢复
requestAnimationFrame(animate);

// 突出显示当前选中的自定义焦点球
function highlightCustomFocusBall() {
    // 首先重置所有小球的辉光效果
    for (let i = 0; i < allSpheres.length; i++) {
        const sphere = allSpheres[i];
        // 如果球已经是活跃状态（被点亮），则不改变它的外观
        if (!sphere.userData.active) {
            // 还原为初始状态
            if (sphere.userData.wasHighlighted) {
                // 移除之前的高亮效果
                sphere.userData.wasHighlighted = false;
                // 使用默认辉光
                sphere.material.emissiveIntensity = params.inactiveBrightness;
            }
        }
    }
    
    // 如果自定义焦点未启用或未选择球，则直接返回
    if (!params.customFocusEnabled || params.customFocusBallIndex < 0 || params.customFocusBallIndex >= allSpheres.length) {
        return;
    }
    
    // 获取选中的小球
    const selectedSphere = allSpheres[params.customFocusBallIndex];
    
    // 如果球是活跃状态，不改变它
    if (selectedSphere.userData.active) {
        return;
    }
    
    // 给选中的小球添加高亮效果
    selectedSphere.userData.wasHighlighted = true;
    selectedSphere.material.emissiveIntensity = 0.5; // 中等亮度，让用户知道这是被选中的球
    
    // 示意性动画效果：轻微放大被选中的球
    const originalScale = selectedSphere.userData.originalScale;
    if (!originalScale) {
        selectedSphere.userData.originalScale = selectedSphere.scale.clone();
    }
    
    // 稍微放大选中的球
    const scale = selectedSphere.userData.originalScale.clone().multiplyScalar(1.1);
    selectedSphere.scale.copy(scale);
}

// 更新场景中的焦点
function updateFocus(time) {
    // 如果景深效果未启用，则不更新焦点
    if (!bokehParams.enabled || !bokehPass) {
        return;
    }
    
    // 如果启用了焦点跟踪功能，使用跟踪球作为焦点
    if (params.focusTrackingEnabled && trackingBall) {
        const distanceToCamera = camera.position.distanceTo(trackingBall.position);
        bokehPass.uniforms["focus"].value = distanceToCamera + params.focusOffset;
    } 
    // 否则，如果启用了自定义焦点，使用选中的小球作为焦点
    else if (params.customFocusEnabled && params.customFocusBallIndex >= 0 && params.customFocusBallIndex < allSpheres.length) {
        const focusBall = allSpheres[params.customFocusBallIndex];
        const distanceToCamera = camera.position.distanceTo(focusBall.position);
        bokehPass.uniforms["focus"].value = distanceToCamera + params.customFocusOffset;
    }
}

// 存储步进器状态
const stepperState = {
    lastBeat: -1,          // 上一拍
    lastStep: -1,          // 上一步
    activePresets: new Set(), // 当前激活的预设
    beatInterval: 500,     // 默认拍子间隔（毫秒）
    stepCount: 16,         // 默认步数
    isPlaying: false,      // 步进器是否正在播放
};

// 添加直接通信接口
// 这个函数可以直接从步进器JS中调用，无需依赖事件系统
window.syncBallWithStepper = function(beat, step, preset, active) {
    // 日志输出，用于调试

    
    // 更新步进器状态
    stepperState.lastBeat = beat;
    stepperState.lastStep = step;
    stepperState.isPlaying = true;
    
    // 记录激活的预设
    if (active) {
        stepperState.activePresets.add(preset);
    } else {
        stepperState.activePresets.delete(preset);
    }
    
    // 如果启用了与步进器同步
    if (params.enableStepperSync) {
        // 获取当前激活的小球
        const activeSphere = allSpheres[preset];
        
        if (activeSphere) {
            // 触发与rhythm-beat事件相同的处理逻辑
            handleStepperEvent(beat, step, preset, active);
        } else {
            console.warn(`预设${preset}对应的小球不存在，已跳过`);
        }
    }
    
    // 触发自定义事件以便其他组件可以响应
    const event = new CustomEvent('stepper-sync', {
        detail: { beat, step, preset, active, timestamp: performance.now() }
    });
    window.dispatchEvent(event);
    
    return true; // 返回成功状态
};

// 处理步进器事件的主要函数
function handleStepperEvent(beat, step, preset, active) {
    // 标记为步进器控制的小球
    const activeSphere = allSpheres[preset];
    if (!activeSphere) return;
    
    activeSphere.userData.stepperControlled = true;
    
    // 根据步进器事件的active状态，设置小球的活跃状态
    const wasActive = activeSphere.userData.active;
    const shouldBeActive = params.rememberStepperPattern ? 
                           stepperState.activePresets.has(preset) : active;
    
    // 更新小球状态
    if (shouldBeActive !== wasActive) {
        if (shouldBeActive) {
            // 激活小球 - 使用普通闪烁的设置，不额外放大
            activeSphere.material.emissiveIntensity = 2.0;
            activeSphere.material.emissive.copy(activeSphere.material.color);
            activeSphere.userData.active = true;
            activeSphere.userData.stepperActive = true;
            
            // 如果不在活跃数组中，添加进去
            if (!activeSpheres.includes(activeSphere)) {
                activeSpheres.push(activeSphere);
            }
            
            // 创建光源
            if (!sphereLights.has(activeSphere)) {
                createLightForSphere(activeSphere);
            }
        } else {
            // 关闭小球
            activeSphere.material.emissiveIntensity = params.inactiveBrightness;
            activeSphere.userData.active = false;
            activeSphere.userData.stepperActive = false;
            
            // 移除光源
            removeLightForSphere(activeSphere);
            
            // 从活跃小球数组中移除
            const index = activeSpheres.indexOf(activeSphere);
            if (index !== -1) {
                activeSpheres.splice(index, 1);
            }
        }
    }
    
    // 触发闪烁 - 添加防抖，避免短时间内多次触发闪烁
    if (activeSphere.userData.active && active) {
        const currentTime = clock.getElapsedTime();
        
        // 检查距离上次闪烁是否已经过了足够的时间（增加防抖间隔到0.3秒）
        // 这可以防止在高分辨率设置下的多次闪烁问题
        if (!activeSphere.userData.lastFlickerTime || 
            currentTime - activeSphere.userData.lastFlickerTime > 0.3) {
            // 记录本次闪烁时间
            activeSphere.userData.lastFlickerTime = currentTime;
            activeSphere.userData.flickerStartTime = currentTime;
            
            // 立即应用最高亮度，实现瞬间点亮效果
            activeSphere.material.emissiveIntensity = params.stepperFlickerIntensity;
            
            // 强制限制动画的持续时间
            setTimeout(() => {
                if (activeSphere && activeSphere.userData) {
                    // 在动画结束后重置发光状态
                    if (activeSphere.userData.active) {
                        activeSphere.material.emissiveIntensity = 2.0;
                    } else {
                        activeSphere.material.emissiveIntensity = params.inactiveBrightness;
                    }
                }
            }, 300); // 300毫秒后重置发光状态
        } else {
            // 忽略这次闪烁请求，因为与上次闪烁时间太近

        }
    }
}

// 初始化步进器小球的绑定关系
function setupStepperBalls() {
    // 获取预设颜色信息并设置小球颜色

    
    // 确保全局有8个小球对应8个预设
    if (allSpheres.length >= 8) {

        
        // 添加全局API以便步进器可以直接激活特定小球
        window.activatePresetSphere = function(presetIndex, active) {
            if (presetIndex >= 0 && presetIndex < 8) {
                // 使用我们的函数来激活小球
                activateSphere(presetIndex, active);
                return true;
            }
            return false;
        };
        
        // 告诉步进器我们已经准备好了

        // 获取预设颜色数组
        const presetColors = [];
        for (let i = 0; i < 8; i++) {
            if (i < allSpheres.length) {
                const color = allSpheres[i].material.color.getHexString();
                presetColors.push(`#${color}`);
            }
        }
        
        // 触发一个事件，通知步进器我们已经准备好了
        const readyEvent = new CustomEvent('threejs-integration-ready', {
            detail: {
                presetColors: presetColors,
                timestamp: performance.now()
            }
        });
        window.dispatchEvent(readyEvent);
    } else {
        console.warn("没有足够的小球来映射预设");
    }
}

// 修改audio-sequencer.js文件中的代码，添加直接调用
// 将这个函数添加到script标签中注入到HTML页面
function injectStepperCode() {
    const script = document.createElement('script');
    script.textContent = `
        // 用于防抖处理的最后触发时间记录
        const lastSyncTimes = new Map();
        
        // 扩展节拍函数以直接调用Three.js场景
        const originalBeat = AudioSequencer.prototype.beat;
        AudioSequencer.prototype.beat = function() {
            // 调用原始beat方法
            originalBeat.call(this);
            
            // 添加direct sync调用
            if (this.isPlaying && typeof window.syncBallWithStepper === 'function') {
                // 获取当前步进索引
                const ui = window.ui || { stepCount: 16, currentPattern: 0 };
                const stepIndex = this.currentBeat % ui.stepCount;
                const beat = Math.floor(this.currentBeat / 4);
                
                // 获取当前时间用于防抖处理
                const now = performance.now();
                
                // 获取分辨率相关参数
                const resIndex = ui.resolution ? ui.resolution.currentIndex : 3; // 默认1/32
                // 显著增加最小间隔，特别是高分辨率下
                const minInterval = [500, 400, 300, 200][resIndex] || 300; // 不同分辨率下的最小间隔(毫秒)
                
                // 获取所有预设模式
                const presetPatterns = window.presetPatterns || [];
                
                // 1. 遍历所有预设模式，检查每个预设的当前步骤是否激活
                for (let presetIndex = 0; presetIndex < presetPatterns.length; presetIndex++) {
                    // 检查预设是否存在且有节点
                    if (presetPatterns[presetIndex] && presetPatterns[presetIndex].length > 0) {
                        const presetNode = presetPatterns[presetIndex][0];
                        
                        // 生成该预设的唯一键，用于防抖
                        const presetKey = \`preset_\${presetIndex}\`;
                        const lastTime = lastSyncTimes.get(presetKey) || 0;
                        
                        // 检查是否已经过了最小间隔
                        if (now - lastTime >= minInterval) {
                            // 检查当前步骤是否激活
                            if (presetNode.alpha && presetNode.alpha[stepIndex] > 0.5) {
                                // 如果激活，则发送同步信号
                                window.syncBallWithStepper(
                                    beat,          // 小节
                                    stepIndex,     // 步进
                                    presetIndex,   // 预设索引
                                    true           // 激活
                                );
                                // 更新最后触发时间
                                lastSyncTimes.set(presetKey, now);
                            } else {
                                // 如果未激活，发送未激活状态（这个不受防抖限制）
                                window.syncBallWithStepper(
                                    beat,          // 小节
                                    stepIndex,     // 步进
                                    presetIndex,   // 预设索引
                                    false          // 未激活
                                );
                            }
                        }
                    }
                }
                
                // 2. 检查当前正在编辑的nodes
                if (typeof nodes !== 'undefined' && nodes.length > 0) {
                    for (let i = 0; i < nodes.length; i++) {
                        if (nodes[i].alpha) {
                            // 获取节点的预设索引，默认为当前预设
                            const nodePresetIndex = nodes[i].presetIndex !== undefined ? 
                                                   nodes[i].presetIndex : ui.currentPattern;
                            
                            // 生成该节点的唯一键，用于防抖
                            const nodeKey = \`node_\${i}_\${nodePresetIndex}\`;
                            const lastTime = lastSyncTimes.get(nodeKey) || 0;
                            
                            // 检查是否已经过了最小间隔
                            if (now - lastTime >= minInterval) {
                                // 如果当前步进是活跃的，发送同步信号
                                const isActive = nodes[i].alpha[stepIndex] > 0.5;
                                if (isActive) {
                                    window.syncBallWithStepper(
                                        beat,             // 小节
                                        stepIndex,        // 步进
                                        nodePresetIndex,  // 节点的预设索引
                                        isActive          // 是否激活
                                    );
                                    // 更新最后触发时间
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

// 初始化步进器小球映射
// 在创建了所有小球后调用这个函数
setupStepperBalls();

// 尝试注入代码以增强audio-sequencer.js
setTimeout(injectStepperCode, 1000);

// 监听节拍事件，用于处理步进器触发
window.addEventListener('rhythm-beat', (event) => {
    if (event.detail) {
        const { beat, step, preset, active, timestamp } = event.detail;
        
        // 记录事件，可用于调试

        
        // 更新步进器状态
        stepperState.lastBeat = beat;
        stepperState.lastStep = step;
        stepperState.isPlaying = true;
        
        // 记录激活的预设
        if (active) {
            stepperState.activePresets.add(preset);
        } else {
            stepperState.activePresets.delete(preset);
        }
        
        // 如果启用了与步进器同步
        if (params.enableStepperSync) {
            // 处理事件
            handleStepperEvent(beat, step, preset, active);
        }
        
        // 如果有已定义的activatePresetSphere函数，则调用它
        if (typeof activatePresetSphere === 'function') {
            // 仅传递信息，由该函数决定如何处理
            activatePresetSphere(preset, active);
        }
    }
});

// 监听步进器停止事件
window.addEventListener('rhythm-stop', () => {
    stepperState.isPlaying = false;

    
    // 如果不记住模式，则清除所有步进器控制的小球
    if (!params.rememberStepperPattern) {
        // 遍历所有小球，关闭所有步进器控制的小球
        for (const sphere of allSpheres) {
            if (sphere.userData.stepperControlled && sphere.userData.active) {
                // 关闭小球
                sphere.material.emissiveIntensity = params.inactiveBrightness;
                sphere.userData.active = false;
                sphere.userData.stepperActive = false;
                
                // 移除光源
                removeLightForSphere(sphere);
                
                // 从活跃小球数组中移除
                const index = activeSpheres.indexOf(sphere);
                if (index !== -1) {
                    activeSpheres.splice(index, 1);
                }
            }
        }
        
        // 清空激活的预设
        stepperState.activePresets.clear();
    }
});

// 监听集成就绪事件
window.addEventListener('rhythm-integration-ready', (event) => {
    if (event.detail) {
        const { presetColors, timestamp } = event.detail;
        

        
        // 调用设置预设球函数
        setupPresetSpheres();
    }
});

// 添加一个更简单直接的函数来激活小球
function activateSphere(index, active) {
    // 安全检查
    if (index < 0 || index >= allSpheres.length) {
        console.warn(`无效的小球索引: ${index}`);
        return;
    }
    
    // 获取目标小球
    const sphere = allSpheres[index];
    
    // 移除防重复调用逻辑，确保每次调用都能激活小球
    // 即使小球状态没有变化，也允许重新触发激活效果
    // 这样可以确保即使小球不在视野内，音符也能正常播放
    

    
    if (active) {
        // 激活小球 - 设置最高发光强度，实现瞬间点亮效果
        sphere.material.emissiveIntensity = params.stepperFlickerIntensity;
        sphere.material.emissive.copy(sphere.material.color);
        sphere.userData.active = true;
        
        // 创建光源
        if (!sphereLights.has(sphere)) {
            createLightForSphere(sphere);
        }
        
        // 添加到活跃小球数组（如果尚未包含）
        if (!activeSpheres.includes(sphere)) {
            activeSpheres.push(sphere);
        }
        
        // 添加闪烁效果的时间标记，确保每次都更新时间标记
        const currentTime = clock.getElapsedTime();
        sphere.userData.lastFlickerTime = currentTime;
        sphere.userData.flickerStartTime = currentTime;
        
        // 标记为步进器控制的小球
        sphere.userData.stepperControlled = true;
        sphere.userData.stepperActive = true;
    } else {
        // 关闭小球 - 减弱发光
        sphere.material.emissiveIntensity = params.inactiveBrightness;
        sphere.userData.active = false;
        sphere.userData.stepperActive = false;
        
        // 移除光源
        removeLightForSphere(sphere);
        
        // 从活跃小球数组中移除
        const sphereIndex = activeSpheres.indexOf(sphere);
        if (sphereIndex !== -1) {
            activeSpheres.splice(sphereIndex, 1);
        }
    }
}

// 将简化函数暴露到全局
window.activateSphere = activateSphere;

// 添加一个flashSphere函数，用于直接触发小球的瞬间高亮闪烁
function flashSphere(index) {
    // 安全检查
    if (index < 0 || index >= allSpheres.length) {
        console.warn(`无效的小球索引: ${index}`);
        return;
    }
    
    // 获取目标小球
    const sphere = allSpheres[index];
    
    // 立即应用最大亮度
    sphere.material.emissiveIntensity = params.stepperFlickerIntensity;
    
    // 设置闪烁开始时间点为当前时间
    sphere.userData.flickerStartTime = clock.getElapsedTime();
    sphere.userData.lastFlickerTime = sphere.userData.flickerStartTime;
    

}

// 将flashSphere函数暴露到全局
window.flashSphere = flashSphere;

// 添加更新相机路径速度的函数
function updateCameraPathSpeed(speed) {
    // 更新相机参数中的路径速度
    cameraParams.pathSpeed = speed;
    
    // 更新GUI控制器的值（如果存在）
    if (gui) {
        // 查找路径速度控制器并更新显示
        for (const folder of gui.folders) {
            if (folder._title === '运镜控制') {
                for (const controller of folder.controllers) {
                    if (controller.property === 'pathSpeed') {
                        controller.updateDisplay();
                        break;
                    }
                }
                break;
            }
        }
    }
    
    // 记录日志

}

// 将函数暴露给全局window对象，以便Sketch.js调用
window.updateCameraPathSpeed = updateCameraPathSpeed;

// 根据步进器播放状态设置相机自动运镜模式
function setCameraAutoModeFromStepper(isPlaying) {
    // 设置自动运镜状态与步进器播放状态同步
    cameraParams.autoCamera = isPlaying;
    
    // 如果启用自动运镜，确保相机路径已创建
    if (isPlaying && !activeCameraPath) {
        generateAllCameraPaths();
        setCameraPath(cameraParams.currentPath);
    }
    
    // 更新GUI显示（如果存在）
    if (cameraFolder && cameraAutoController) {
        cameraAutoController.setValue(cameraParams.autoCamera);
        cameraAutoController.updateDisplay();
    }
}

// 暴露函数给全局作用域
window.setCameraAutoModeFromStepper = setCameraAutoModeFromStepper;

// 添加场景显示/隐藏控制功能
let sceneVisible = false; // 默认场景隐藏

// 隐藏场景的函数
function hideScene() {
    if (renderer) {
        renderer.domElement.style.display = 'none';
    }
    sceneVisible = false;
    
    // 停止渲染循环以节省资源
    stopRendering();
}

// 显示场景的函数
function showScene() {
    if (renderer) {
        renderer.domElement.style.display = 'block';
    }
    sceneVisible = true;
    
    // 恢复渲染循环
    startRendering();
}

// 切换场景显示/隐藏状态的函数
function toggleSceneVisibility() {
    if (sceneVisible) {
        hideScene();
    } else {
        showScene();
        // 如果场景已经很长时间没有渲染（可能是第一次显示），需要启动动画循环
        if (!isRendering) {
            startRendering();
        }
    }
    return sceneVisible; // 返回当前状态，方便调用者使用
}

// 暴露函数到全局作用域
window.toggleSceneVisibility = toggleSceneVisibility;
window.showScene = showScene;
window.hideScene = hideScene;

// 添加手动触发resize的全局函数
window.resizeThreeScene = function() {
    // 延迟一帧执行resize，确保DOM布局已经完成
    requestAnimationFrame(() => {
        onWindowResize();
    });
};

// 添加ResizeObserver来监听three-container的尺寸变化
if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            // 当three-container尺寸变化时，触发resize
            onWindowResize();
        }
    });
    
    // 观察three-container
    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
        resizeObserver.observe(threeContainer);
    }
}

// 初始化时隐藏场景并停止渲染
hideScene();