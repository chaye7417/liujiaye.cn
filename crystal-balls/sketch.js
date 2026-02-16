let scene, camera, renderer, controls;
let balls = [];
let platform;
let composer;
let socket;
let maxBalls = 10;
let reverbAmount = 0.3;
let nextBallTime = 0;
const radius = 500;

// Tone.js相关变量
let polySynth;
let reverb;

// 初始化 Tone.js
function initTone() {
    // 初始化混响效果器
    reverb = new Tone.Reverb({
        decay: 1.5,
        wet: reverbAmount
    }).toDestination();
    
    // 预先加载混响
    reverb.generate().then(() => {
        console.log("Reverb ready");
    });
    
    // 创建复音合成器，能够同时发出多个音符
    polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
            type: "sine"
        },
        envelope: {
            attack: 0,      // 攻击时间设为0
            decay: 0.2,
            sustain: 0.3,
            release: 1.0
        },
        volume: -10 // 降低整体音量，避免多个音符同时播放时过载
    }).connect(reverb);
    
    console.log("PolySynth initialized");
}

// 触发声音函数
function triggerSound(size, bounceCount, pan) {
    if (Tone.context.state !== "running") {
        Tone.context.resume();
    }
    
    // 大幅提高整体音高
    // 调整基础音符到更高的八度，同时保持尺寸对音高的影响
    const baseNote = 84 - Math.floor(size * 1.2);  // 尺寸越大，音高越低，但整体音高提高了
    const note = Tone.Frequency(baseNote - bounceCount, "midi").toNote();
    
    // 弹跳力度映射到音量
    const velocity = Math.max(0.05, 1 - bounceCount * 0.1);  // 减缓音量衰减速度
    
    // 设置混响量
    reverb.wet.value = reverbAmount;
    
    // 创建一个唯一的ID用于此次声音事件
    const soundId = `ball-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // 创建专门用于这个音符的声像
    const individualPanner = new Tone.Panner(pan).connect(reverb);
    
    // 为这个特定的声音创建一个临时的单音合成器
    const tempSynth = new Tone.Synth({
        oscillator: {
            type: "sine"
        },
        envelope: {
            attack: 0,
            decay: 0.2,
            sustain: 0.3,
            release: 1.0
        }
    }).connect(individualPanner);
    
    // 设置音量
    tempSynth.volume.value = Tone.gainToDb(velocity);
    
    // 触发音符
    tempSynth.triggerAttackRelease(note, "32n", undefined, velocity);
    
    // 在音符结束后释放资源
    setTimeout(() => {
        tempSynth.dispose();
        individualPanner.dispose();
    }, 1000); // 1秒后释放，确保声音完全播放结束
    
    // 打印声音信息以便调试
    console.log(`Sound: size=${size}, note=${note}, pan=${pan.toFixed(2)}, id=${soundId}`);
}

// 初始化 Socket.IO
function initSocket() {
    socket = io();
}

function init() {
    try {
        initSocket();
        initTone();  // 初始化Tone.js
        
        // 创建场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a192f);
        scene.fog = new THREE.Fog(0x0a192f, 1000, 3000);

        // 调整相机位置和视角
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        camera.position.set(1000, 1000, 1000);
        camera.lookAt(0, 200, 0);

        // 创建渲染器
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x0a192f, 1);
        document.body.appendChild(renderer.domElement);

        console.log('Renderer created successfully');

        // 添加轨道控制器
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;

        // 设置光照
        setupLights();
        
        // 创建平台
        createPlatform();
        
        // 设置后期处理
        setupPostProcessing();

        // 设置事件监听
        setupEventListeners();

        // 设置窗口大小调整
        window.addEventListener('resize', onWindowResize, false);

        // 创建立方体环境贴图
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter
        });
        const cubeCamera = new THREE.CubeCamera(0.1, 5000, cubeRenderTarget);
        scene.add(cubeCamera);

        // 将环境贴图保存为全局变量
        window.envMap = cubeRenderTarget.texture;

        console.log('Scene initialized successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

function setupEventListeners() {
    // 获取并设置滑块事件
    const maxBallsSlider = document.getElementById("maxBalls");
    const reverbSlider = document.getElementById("reverb");

    maxBallsSlider.addEventListener("input", function() {
        maxBalls = parseInt(this.value);
        document.getElementById("maxBallsValue").textContent = maxBalls;
    });

    reverbSlider.addEventListener("input", function() {
        reverbAmount = parseFloat(this.value);
        document.getElementById("reverbValue").textContent = reverbAmount.toFixed(1);
        if (reverb) {
            reverb.wet.value = reverbAmount;
        }
    });
    
    // 添加点击事件启动音频上下文
    document.addEventListener('click', () => {
        if (Tone.context.state !== "running") {
            Tone.context.resume();
        }
    });
}

function setupLights() {
    // 调整环境光
    const ambientLight = new THREE.AmbientLight(0x172a45, 0.4);
    scene.add(ambientLight);

    // 主光源
    const mainLight = new THREE.DirectionalLight(0x64ffda, 0.8);
    mainLight.position.set(200, 400, 200);
    scene.add(mainLight);

    // 补光
    const fillLight1 = new THREE.DirectionalLight(0x7f9cf5, 0.4);
    fillLight1.position.set(-200, 200, -200);
    scene.add(fillLight1);

    // 添加点光源增加氛围
    const pointLight = new THREE.PointLight(0x64ffda, 0.5, 1000);
    pointLight.position.set(0, 500, 0);
    scene.add(pointLight);
}

function createPlatform() {
    const segments = 48;
    
    // 创建径向线
    const radialLines = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const points = [];
        const opacities = []; // 存储每个点的透明度
        
        // 为每条径向线创建点和对应的透明度
        for (let r = 0; r <= radius + 100; r += 5) {  // 延长一点以实现平滑淡出
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const y = 400 - Math.pow(r/radius, 2) * 200;
            points.push(new THREE.Vector3(x, y, z));
            
            // 计算透明度
            const fadeStart = radius - 50;  // 开始淡出的位置
            const opacity = r > fadeStart ? 
                Math.max(0, 1 - (r - fadeStart) / 100) : 1;  // 线性淡出
            opacities.push(opacity);
        }
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // 添加透明度属性
        const alphas = new Float32Array(opacities);
        lineGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        
        // 使用自定义着色器材质
        const lineMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x64ffda) },
                baseOpacity: { value: 0.2 },
                glowIntensity: { value: 0.0 }
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                void main() {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float baseOpacity;
                uniform float glowIntensity;
                varying float vAlpha;
                void main() {
                    gl_FragColor = vec4(color, (baseOpacity + glowIntensity) * vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.userData.baseOpacity = 0.2;
        line.userData.glowTime = 0;
        scene.add(line);
        radialLines.push(line);
    }

    // 创建环形线，使用类似的淡出效果
    const circles = [];
    for (let r = 0; r <= radius; r += radius/24) {
        const points = [];
        const opacities = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const y = 400 - Math.pow(r/radius, 2) * 200;
            points.push(new THREE.Vector3(x, y, z));
            
            // 圆环的透明度基于半径
            const fadeStart = radius - 50;
            const opacity = r > fadeStart ? 
                Math.max(0, 1 - (r - fadeStart) / 100) : 1;
            opacities.push(opacity);
        }

        const circleGeometry = new THREE.BufferGeometry().setFromPoints(points);
        circleGeometry.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(opacities), 1));

        const circleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x64ffda) },
                baseOpacity: { value: 0.2 },
                glowIntensity: { value: 0.0 }
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                void main() {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float baseOpacity;
                uniform float glowIntensity;
                varying float vAlpha;
                void main() {
                    gl_FragColor = vec4(color, (baseOpacity + glowIntensity) * vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const circle = new THREE.Line(circleGeometry, circleMaterial);
        circle.userData.baseOpacity = 0.2;
        circle.userData.glowTime = 0;
        scene.add(circle);
        circles.push(circle);
    }

    // 修改发光更新逻辑
    platform = {
        radialLines: radialLines,
        circles: circles,
        glowNearbyGrid: function(position, radius = 200) {
            const x = position.x;
            const z = position.z;
            
            // 点亮径向线
            this.radialLines.forEach(line => {
                const points = line.geometry.attributes.position.array;
                let minDist = Infinity;
                // 计算碰撞点到线的最短距离
                for(let i = 0; i < points.length; i += 3) {
                    const dx = points[i] - x;
                    const dz = points[i + 2] - z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    minDist = Math.min(minDist, dist);
                }
                // 如果在发光范围内，更新发光强度
                if(minDist < radius) {
                    const intensity = Math.pow(1 - (minDist / radius), 2);  // 平方函数使发光更集中
                    line.material.uniforms.glowIntensity.value = intensity * 3.0;  // 增强发光效果
                }
            });

            // 点亮圆环
            this.circles.forEach(circle => {
                const circleRadius = Math.sqrt(x * x + z * z);  // 碰撞点到中心的距离
                const points = circle.geometry.attributes.position.array;
                const circleR = Math.sqrt(points[0] * points[0] + points[2] * points[2]);  // 圆环的半径
                const dist = Math.abs(circleRadius - circleR);  // 碰撞点到圆环的距离
                
                // 如果在发光范围内，更新发光强度
                if(dist < radius * 0.5) {  // 使用更小的范围使圆环发光更集中
                    const intensity = Math.pow(1 - (dist / (radius * 0.5)), 2);
                    circle.material.uniforms.glowIntensity.value = intensity * 3.0;
                }
            });
        },
        update: function() {
            // 更新所有线条的发光效果
            [...this.radialLines, ...this.circles].forEach(line => {
                if (line.material.uniforms && line.material.uniforms.glowIntensity.value > 0) {
                    // 使用更慢的衰减
                    line.material.uniforms.glowIntensity.value *= 0.95;
                }
            });
        }
    };
}

function setupPostProcessing() {
    composer = new THREE.EffectComposer(renderer);
    
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 增强泛光效果
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.0,
        0.5,
        0.7
    );
    composer.addPass(bloomPass);
}

class Ball {
    constructor(x, y, z, radius) {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        
        // 同时添加反射和发光效果
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.0,
            envMapIntensity: 2.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            reflectivity: 1.0,
            emissive: 0x64ffda,
            emissiveIntensity: 0.0,
            transparent: true,
            opacity: 0.0
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y, z);
        
        // 创建专用的环境贴图相机
        this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter
        });
        this.cubeCamera = new THREE.CubeCamera(0.1, 5000, this.cubeRenderTarget);
        
        // 先添加相机再添加球体，确保环境贴图能正确捕捉场景
        scene.add(this.cubeCamera);
        scene.add(this.mesh);

        // 立即更新一次环境贴图
        this.updateEnvironmentMap();
        this.mesh.material.envMap = this.cubeRenderTarget.texture;
        this.mesh.material.needsUpdate = true;

        // 添加属性
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.radius = radius;
        this.bounceCount = 0;
        this.friction = 0.95; // 减小摩擦系数，原为0.99
        this.restitution = 0.85; // 添加弹性系数，控制反弹强度
        this.minVelocity = 0.8; // 添加最小速度阈值，防止小球停滞
        this.fadeState = 'in';
        this.fadeTime = 0;
        this.glowTime = 0;
        this.lastBounceTime = 0; // 添加最后一次弹跳时间记录
    }

    update() {
        // 始终更新环境贴图
        this.updateEnvironmentMap();

        // 处理淡入淡出
        if (this.fadeState === 'in') {
            this.fadeTime += 0.05;
            this.mesh.material.opacity = this.fadeTime;
            if (this.fadeTime >= 1) {
                this.fadeTime = 1;
                this.fadeState = 'visible';
            }
        } else if (this.fadeState === 'out') {
            this.fadeTime -= 0.05;
            this.mesh.material.opacity = this.fadeTime;
            if (this.fadeTime <= 0) {
                this.remove();
                return false;
            }
        }

        // 更新发光效果
        if (this.glowTime > 0) {
            this.glowTime -= 0.1;
            this.mesh.material.emissiveIntensity = this.glowTime;
        }

        // 物理更新
        this.velocity.y -= 0.5; // 重力加速度
        
        // 应用最小速度阈值 - 防止小球速度过低导致的"粘滞"
        const speedXZ = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (speedXZ > 0 && speedXZ < this.minVelocity) {
            // 如果水平速度过低但不为零，稍微加速以防止停滞
            const speedUpFactor = this.minVelocity / speedXZ;
            this.velocity.x *= speedUpFactor;
            this.velocity.z *= speedUpFactor;
        }
        
        // 更新位置
        this.mesh.position.add(this.velocity);

        // 获取平台高度和碰撞检测
        const x = this.mesh.position.x;
        const z = this.mesh.position.z;
        const dist = Math.sqrt(x * x + z * z);
        const platformY = 400 - Math.pow(dist/radius, 2) * 200;

        // 碰撞检测
        if (this.mesh.position.y - this.radius < platformY) {
            // 防止穿透平台
            this.mesh.position.y = platformY + this.radius + 0.1; // 添加微小偏移避免精度问题
            
            // 计算法线
            const normal = new THREE.Vector3(
                x / radius,
                1,
                z / radius
            ).normalize();

            // 反弹和滑动
            if (Math.abs(this.velocity.y) > 0.5) {
                const dot = this.velocity.dot(normal);
                this.velocity.sub(normal.multiplyScalar(dot * (1 + this.restitution)));
                
                // 确保速度不会过低导致粘滞
                const currentSpeed = this.velocity.length();
                if (currentSpeed < this.minVelocity) {
                    this.velocity.normalize().multiplyScalar(this.minVelocity);
                } else {
                    // 正常的速度衰减
                    this.velocity.multiplyScalar(0.9); // 减小衰减率，原为0.8
                }
                
                // 防止短时间内多次触发弹跳
                const currentTime = Date.now();
                if (currentTime - this.lastBounceTime > 100) { // 100毫秒内不重复触发
                    // 触发发光效果
                    this.glowTime = 2.0;
                    this.mesh.material.emissiveIntensity = this.glowTime;
                    
                    // 计算归一化的x位置，用于声像定位
                    // 使用更精确的声像映射，确保声像与位置完全对应
                    const panValue = THREE.MathUtils.clamp(
                        THREE.MathUtils.mapLinear(x, -radius, radius, -1, 1),
                        -1,
                        1
                    );
                    
                    // 使用Tone.js直接触发声音
                    triggerSound(
                        this.radius,
                        this.bounceCount,
                        panValue
                    );
                    
                    this.bounceCount++;
                    this.lastBounceTime = currentTime;

                    // 触发网格发光效果
                    platform.glowNearbyGrid(this.mesh.position, 200);
                }
            } else {
                // 当水平速度较低时给一个随机方向的小推力，防止球停滞
                if (speedXZ < 0.5) {
                    const randomAngle = Math.random() * Math.PI * 2;
                    this.velocity.x += Math.cos(randomAngle) * 0.5;
                    this.velocity.z += Math.sin(randomAngle) * 0.5;
                }
                
                // 滑动处理
                const tangent = new THREE.Vector3(z, 0, -x).normalize();
                const currentSpeed = this.velocity.length();
                this.velocity.copy(tangent.multiplyScalar(currentSpeed));
                this.velocity.multiplyScalar(this.friction);
            }
        }

        // 如果球体几乎静止并且在平台上，给一个小的随机推力
        const totalSpeed = this.velocity.length();
        if (totalSpeed < 0.3 && Math.abs(this.mesh.position.y - (platformY + this.radius)) < 1) {
            const randomAngle = Math.random() * Math.PI * 2;
            this.velocity.x = Math.cos(randomAngle) * this.minVelocity;
            this.velocity.z = Math.sin(randomAngle) * this.minVelocity;
            this.velocity.y = 1; // 给一个向上的推力
        }

        // 检查是否超出边界
        if (dist > radius + 100 || this.mesh.position.y < -1000) {
            if (this.fadeState !== 'out') {
                this.fadeState = 'out';  // 开始淡出
            }
        }

        return true;
    }

    updateEnvironmentMap() {
        const currentOpacity = this.mesh.material.opacity;
        this.mesh.visible = false;
        this.cubeCamera.position.copy(this.mesh.position);
        this.cubeCamera.update(renderer, scene);
        this.mesh.visible = true;
        this.mesh.material.opacity = currentOpacity;
        this.mesh.material.envMap = this.cubeRenderTarget.texture;
    }

    remove() {
        scene.remove(this.mesh);
        scene.remove(this.cubeCamera);
        if (this.cubeRenderTarget) {
            this.cubeRenderTarget.dispose();
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

function generateBall() {
    if (balls.length < maxBalls && Date.now() > nextBallTime) {
        const radius = THREE.MathUtils.randFloat(10, 35);
        const ball = new Ball(
            THREE.MathUtils.randFloat(-200, 200),
            800,
            THREE.MathUtils.randFloat(-200, 200),
            radius
        );
        balls.push(ball);
        nextBallTime = Date.now() + THREE.MathUtils.randFloat(3, 150);
    }
}

function animate() {
    try {
        requestAnimationFrame(animate);
        
        // 生成新球
        generateBall();
        
        // 更新球体
        balls = balls.filter(ball => ball.update());
        
        // 更新控制器
        controls.update();
        
        // 渲染场景
        renderer.render(scene, camera);
        
        // 后期处理
        if (composer) {
            composer.render();
        }

        // 更新平台发光效果
        platform.update();
    } catch (error) {
        console.error('Error during animation:', error);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// 创建渐变纹理
function createGradientTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // 创建渐变
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0a192f');    // 深蓝色顶部
    gradient.addColorStop(0.5, '#172a45');   // 中间色
    gradient.addColorStop(1, '#0a192f');    // 深蓝色底部

    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 512);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// 创建背景网格
function createBackgroundMesh(texture) {
    const geometry = new THREE.PlaneGeometry(5000, 5000);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -2000;
    mesh.rotation.z = Math.PI; // 旋转以适应场景
    return mesh;
}

// 初始化场景
init();
animate();
