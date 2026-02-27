/**
 * PostProcessing.js
 * Bloom、Bokeh 后处理、环境贴图、composer 管理
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { scene, camera, renderer, pmremGenerator, gui } from './SceneSetup.js';

// ---- Effect Composer ----
export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// ---- Bloom ----
export const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85
);
bloomPass.threshold = 0;
bloomPass.strength = 1.3;
bloomPass.radius = 1;
composer.addPass(bloomPass);

// ---- Bokeh 参数 ----
export const bokehParams = {
    focus: 10.0,
    aperture: 0.0025,
    maxblur: 0.013,
    enabled: true,
    bloomFirst: false,
    width: window.innerWidth * 1.5,
    height: window.innerHeight * 1.5,
    dof: true,
};

// ---- 创建 BokehPass ----
export const createBokehPass = () => {
    const pass = new BokehPass(scene, camera, {
        focus: bokehParams.focus,
        aperture: bokehParams.aperture,
        maxblur: bokehParams.maxblur,
        width: bokehParams.width,
        height: bokehParams.height,
    });

    if (pass.materialBokeh && pass.materialBokeh.fragmentShader) {
        const srcSampler = 'for ( int i = 0; i < KERNEL_SIZE; i ++ ) {';
        const newSampler = 'for ( int i = 0; i < KERNEL_SIZE * 2; i ++ ) {';
        pass.materialBokeh.fragmentShader =
            pass.materialBokeh.fragmentShader.replace(srcSampler, newSampler);
        pass.materialBokeh.fragmentShader =
            pass.materialBokeh.fragmentShader.replace(
                'gl_FragColor = texture2D( tColor, vUv.xy ) * max( 1.0, color.r * 1.5 );',
                'gl_FragColor = texture2D( tColor, vUv.xy ) * max( 1.0, color.r * 2.0 );'
            );
        pass.materialBokeh.needsUpdate = true;
    }

    pass.enabled = bokehParams.enabled;
    return pass;
};

export let bokehPass = createBokehPass();
composer.addPass(bokehPass);

/** 替换当前的 bokehPass（用于切换高质量模式） */
export function replaceBokehPass(newPass) {
    bokehPass = newPass;
}

// ---- 环境反射 ----
export function updateSceneEnvironment() {
    scene.background = new THREE.Color(0x000000);
    const sceneEnv = pmremGenerator.fromScene(scene).texture;
    scene.environment = sceneEnv;
}

// ---- 更新 composer 尺寸（用于 resize） ----
export function updateComposerSize(width, height) {
    composer.setSize(width, height);

    bokehParams.width = width * 1.5;
    bokehParams.height = height * 1.5;

    if (bokehPass && typeof bokehPass === 'object') {
        if (bokehPass.renderTargetDepth && typeof bokehPass.renderTargetDepth.setSize === 'function') {
            bokehPass.renderTargetDepth.setSize(bokehParams.width, bokehParams.height);
        }
        if (bokehPass.renderTargetColor && typeof bokehPass.renderTargetColor.setSize === 'function') {
            bokehPass.renderTargetColor.setSize(bokehParams.width, bokehParams.height);
        }
    }
}

// ---- GUI：Bloom ----
const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(bloomPass, 'threshold', 0.0, 1.0).name('Threshold');
bloomFolder.add(bloomPass, 'strength', 0.0, 3.0).name('Strength');
bloomFolder.add(bloomPass, 'radius', 0.0, 1.0).name('Radius');

// ---- GUI：景深 ----
const bokehFolder = gui.addFolder('景深效果');
bokehFolder.add(bokehParams, 'enabled').name('启用景深').onChange(value => {
    bokehPass.enabled = value;
    if (bokehParams.bloomFirst) {
        composer.passes = [composer.passes[0], bloomPass, bokehPass];
    } else {
        composer.passes = [composer.passes[0], bokehPass, bloomPass];
    }
});
bokehFolder.add(bokehParams, 'focus', 1, 50).name('焦点距离').onChange(value => {
    bokehPass.uniforms['focus'].value = value;
}).listen();
bokehFolder.add(bokehParams, 'aperture', 0.0001, 0.01, 0.0001).name('光圈大小').onChange(value => {
    bokehPass.uniforms['aperture'].value = value;
});
bokehFolder.add(bokehParams, 'maxblur', 0, 0.05, 0.001).name('最大模糊').onChange(value => {
    bokehPass.uniforms['maxblur'].value = value;
});
bokehFolder.add(bokehParams, 'bloomFirst').name('泛光在前').onChange(value => {
    if (value) {
        composer.passes = [composer.passes[0], bloomPass, bokehPass];
    } else {
        composer.passes = [composer.passes[0], bokehPass, bloomPass];
    }
});

bokehFolder.add(bokehParams, 'dof').name('高质量光斑').onChange(() => {
    const index = composer.passes.findIndex(pass => pass === bokehPass);
    if (index === -1) return;

    const oldSettings = {
        focus: bokehPass.uniforms.focus.value,
        aperture: bokehPass.uniforms.aperture.value,
        maxblur: bokehPass.uniforms.maxblur.value,
        enabled: bokehPass.enabled,
    };

    composer.passes.splice(index, 1);
    const newBokehPass = createBokehPass();
    newBokehPass.uniforms.focus.value = oldSettings.focus;
    newBokehPass.uniforms.aperture.value = oldSettings.aperture;
    newBokehPass.uniforms.maxblur.value = oldSettings.maxblur;
    newBokehPass.enabled = oldSettings.enabled;
    composer.passes.splice(index, 0, newBokehPass);
    replaceBokehPass(newBokehPass);
});

// ---- GUI：Renderer ----
const toneMappingFolder = gui.addFolder('Renderer');
toneMappingFolder.add(renderer, 'toneMappingExposure', 0.1, 3).name('Exposure');

// ---- 初始化渲染通道顺序 ----
export function initPassOrder() {
    if (!bokehParams.bloomFirst) {
        composer.passes = [composer.passes[0], bokehPass, bloomPass];
    }
    bokehPass.enabled = bokehParams.enabled;
}
