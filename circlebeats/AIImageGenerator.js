/**
 * AIImageGenerator.js - Stability AI 图像生成器
 * 连接Stability AI的Sketch API，基于音乐瀑布流生成AI图像
 */

class AIImageGenerator {
    constructor() {
        this.apiKey = 'sk-yDcJGj25FOBtIgGmXlTHegh69jeIN0DnIxXW1seImdA3cqRb';
        this.apiEndpoint = 'https://api.stability.ai/v2beta/stable-image/control/sketch';
        this.videoApiEndpoint = 'https://api.stability.ai/v2beta/image-to-video';
        this.videoResultEndpoint = 'https://api.stability.ai/v2beta/image-to-video/result';
        this.isGenerating = false;
        this.isGeneratingVideo = false;
        this.generatedImages = [];
        this.generatedVideos = [];
        this.activeVideoGenerations = new Map(); // 存储正在生成的视频ID
        
        // 默认生成参数
        this.defaultSettings = {
            control_strength: 0.8,  // Scribble模式下建议更高的控制强度
            output_format: 'png',
            style_preset: 'cinematic',
            seed: 0
        };
        
        // 视频生成默认参数
        this.defaultVideoSettings = {
            seed: 0,
            cfg_scale: 1.8,  // 视频与原图的相似度
            motion_bucket_id: 127  // 动作强度，1-255，127为中等
        };
        
        // 预设的音乐主题prompt - 中文说明 + 英文原文，保留优质提示词并新增
        this.musicPrompts = [
            {
                chinese: "宁静田园风景（默认）",
                english: "peaceful landscape where musical note blocks become trees and bushes, piano roll bars forming river banks and mountain ridges, soft natural colors following rhythm patterns"
            },
            {
                chinese: "禅意音乐庭院",
                english: "zen garden where sand patterns follow musical waves, minimalist landscape with rocks representing strong beats, peaceful and meditative"
            },
            {
                chinese: "音乐光束",
                english: "light rays and beams where musical notes become streams of colored light, maintaining the flow and timing, glowing effects on dark background"
            },
            {
                chinese: "水中倒影",
                english: "water reflection scene where musical bars create ripples and waves on water surface, maintaining the rhythm pattern and note positions"
            },
            {
                chinese: "音符变火焰",
                english: "fire and flame visualization where musical notes become dancing flames, each beat creating flickering fire patterns, warm orange and red colors"
            },
            {
                chinese: "音乐阶梯",
                english: "stone steps and stairs where musical notes become individual steps, maintaining the pitch height relationships, architectural stone textures"
            },
            {
                chinese: "音符变宝石",
                english: "precious gems and crystals where each musical note becomes a sparkling jewel, maintaining positions and timing, brilliant reflective surfaces"
            },
            {
                chinese: "音乐城墙",
                english: "ancient brick walls where musical bars become stone blocks and bricks, maintaining the grid structure, weathered stone textures"
            },
            {
                chinese: "音符变气泡",
                english: "underwater bubbles where musical notes become floating air bubbles, maintaining the flow and rhythm, transparent spheres rising through water"
            },
            {
                chinese: "音乐藤蔓",
                english: "climbing vines and ivy where musical lines become growing plant tendrils, maintaining the flow patterns, green botanical textures"
            },
            {
                chinese: "音符变羽毛",
                english: "floating feathers where musical notes become soft bird feathers, maintaining the airflow and rhythm, delicate texture and movement"
            },
            {
                chinese: "音乐冰晶",
                english: "ice crystals and frost where musical patterns become frozen ice formations, maintaining the geometric structure, crystalline blue and white"
            },
            {
                chinese: "音符变烟雾",
                english: "smoke and mist where musical notes become wisps of vapor, maintaining the flow and dissipation patterns, ethereal gray and white"
            },
            {
                chinese: "音乐铁轨",
                english: "railway tracks where musical bars become parallel train rails, maintaining the rhythm spacing, industrial metal textures"
            },
            {
                chinese: "音符变螺旋",
                english: "spiral patterns where musical notes create swirling helix formations, maintaining the rhythm timing, mathematical precision"
            },
            {
                chinese: "音乐织网",
                english: "spider web patterns where musical lines become intricate web structures, maintaining the grid connections, silken thread textures"
            },
            {
                chinese: "音符变沙丘",
                english: "desert sand dunes where musical waves become rolling sandy hills, maintaining the flow patterns, golden sand textures"
            },
            {
                chinese: "音乐电路",
                english: "electronic circuit board where musical notes become electronic components and traces, maintaining the grid layout, tech green and copper"
            },
            {
                chinese: "音符变刺绣",
                english: "embroidered fabric where musical notes become colorful thread stitches, maintaining the pattern structure, textile art textures"
            },
            {
                chinese: "音乐琴弦",
                english: "guitar or harp strings where musical bars become taut wire strings, maintaining the spacing and tension, metallic string reflections"
            },
            // 新增音乐提示项
            {
                chinese: "折纸节奏",
                english: "folded paper landscape where rhythmic patterns form origami-like layers, creases aligned with timing, geometric elegance without explicit musical notes"
            },
            {
                chinese: "时钟齿轮节拍",
                english: "interlocking clock gears turning in sync with rhythm, conveying tempo through mechanical rotation and structure, no visible musical notation"
            },
            {
                chinese: "丝带气流",
                english: "flowing silk ribbons carried by invisible wind, weaving through space in rhythm-based patterns, soft motion suggesting musical dynamics without note symbols"
            },
            {
                chinese: "玻璃塔旋律",
                english: "glass towers built with layered transparency and harmonic structure, shimmering reflections suggesting vertical melodies without explicit music symbols"
            },
            {
                chinese: "岩层韵律",
                english: "sedimentary rock layers shaped by rhythmic erosion, each layer representing temporal flow, earthy textures without any visible music notation"
            }
        ];
        
        this.init();
    }
    
    init() {
        this.createUI();
        this.setupEventListeners();
        console.log('🎨 AI图像生成器已初始化');
    }
    
    createUI() {
        // 创建AI生图控制面板
        this.panel = document.createElement('div');
        this.panel.id = 'ai-generator-panel';
        this.panel.className = 'ai-generator-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 320px;
            background: rgba(20, 20, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 15px;
            z-index: 1001;
            display: none;
            font-family: monospace;
            color: white;
            backdrop-filter: blur(10px);
        `;
        
        this.panel.innerHTML = `
            <div class="ai-panel-header">
                <h3 style="margin: 0 0 10px 0; color: #4CAF50;">🎨🎬 AI图像&视频生成器</h3>
                <button id="ai-panel-close" style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
            </div>
            
            <div class="ai-controls">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 12px;">🎨 选择艺术风格:</label>
                    <select id="ai-prompt-select" style="width: 100%; padding: 5px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 3px;">
                        ${this.musicPrompts.map((prompt, index) => 
                            `<option value="${index}">${prompt.chinese}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 12px;">✏️ 或输入自定义描述:</label>
                    <textarea id="ai-custom-prompt" placeholder="输入您想要的图像风格描述..." style="width: 100%; height: 60px; padding: 5px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; resize: vertical;"></textarea>
                </div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-size: 12px;">🎛️ 控制强度:</label>
                        <input type="range" id="ai-control-strength" min="0" max="1" step="0.1" value="0.8" style="width: 100%;">
                        <span id="ai-strength-value" style="font-size: 10px; color: #ccc;">0.8</span>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-size: 12px;">🎨 风格:</label>
                        <select id="ai-style-preset" style="width: 100%; padding: 3px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; font-size: 11px;">
                            <option value="digital-art">数字艺术</option>
                            <option value="anime">动漫</option>
                            <option value="fantasy-art">奇幻艺术</option>
                            <option value="cinematic" selected>电影感</option>
                            <option value="3d-model">3D模型</option>
                            <option value="neon-punk">霓虹朋克</option>
                            <option value="analog-film">胶片</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 12px;">🚫 避免的元素:</label>
                    <input type="text" id="ai-negative-prompt" placeholder="要避免的视觉元素..." value="blur, distorted, ugly, low quality, text, watermark" style="width: 100%; padding: 5px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 3px;">
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button id="ai-generate-btn" style="flex: 1; padding: 10px; background: linear-gradient(45deg, #4CAF50, #45a049); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        🎨 生成AI图像
                    </button>
                    <button id="ai-random-seed-btn" style="padding: 10px; background: rgba(255,152,0,0.8); color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🎲
                    </button>
                </div>
                
                <!-- 图生成视频区域 -->
                <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
                    <div style="font-size: 12px; color: #ccc; margin-bottom: 8px;">🎬 图像生成视频</div>
                    
                    <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 3px; font-size: 10px;">📹 相似度:</label>
                            <input type="range" id="ai-video-cfg-scale" min="0" max="10" step="0.2" value="1.8" style="width: 100%;">
                            <span id="ai-video-cfg-value" style="font-size: 9px; color: #aaa;">1.8</span>
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 3px; font-size: 10px;">🏃 运动强度:</label>
                            <input type="range" id="ai-video-motion" min="1" max="255" step="1" value="127" style="width: 100%;">
                            <span id="ai-video-motion-value" style="font-size: 9px; color: #aaa;">127</span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="display: flex; align-items: center; font-size: 10px; gap: 5px;">
                            <input type="checkbox" id="ai-video-loop-mode" checked style="margin: 0;">
                            🔄 循环模式 (降低运动强度，优化循环效果)
                        </label>
                    </div>
                    
                    <div style="display: flex; gap: 5px;">
                        <button id="ai-generate-video-btn" style="flex: 1; padding: 8px; background: linear-gradient(45deg, #9C27B0, #8E24AA); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 11px;">
                            🎬 图像生成视频
                        </button>
                        <button id="ai-video-random-seed-btn" style="padding: 8px; background: rgba(156, 39, 176, 0.8); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 11px;">
                            🎲
                        </button>
                    </div>
                    
                    <div id="ai-video-status" style="margin-top: 8px; font-size: 10px; color: #ddd; min-height: 12px;"></div>
                </div>
                
                <div id="ai-status" style="margin-top: 10px; font-size: 11px; color: #ccc; min-height: 15px;"></div>
            </div>
            
            <div id="ai-gallery" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; max-height: 200px; overflow-y: auto;">
                <div style="font-size: 12px; color: #ccc; margin-bottom: 5px;">📸 图像历史:</div>
                <div id="ai-gallery-content" style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px;"></div>
                
                <div style="font-size: 12px; color: #ccc; margin-bottom: 5px;">🎬 视频历史:</div>
                <div id="ai-video-gallery-content" style="display: flex; flex-wrap: wrap; gap: 5px;">
                    <div style="color: #666; font-size: 10px; padding: 5px;">暂无视频</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        // 创建生成图像显示区域
        this.imageDisplay = document.createElement('div');
        this.imageDisplay.id = 'ai-image-display';
        this.imageDisplay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border-radius: 10px;
            padding: 20px;
            z-index: 1002;
            display: none;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
        `;
        
        document.body.appendChild(this.imageDisplay);
    }
    
    setupEventListeners() {
        // 关闭面板
        document.getElementById('ai-panel-close').addEventListener('click', () => {
            this.hidePanel();
        });
        
        // 控制强度滑块
        const strengthSlider = document.getElementById('ai-control-strength');
        const strengthValue = document.getElementById('ai-strength-value');
        strengthSlider.addEventListener('input', (e) => {
            strengthValue.textContent = e.target.value;
        });
        
        // 随机种子按钮
        document.getElementById('ai-random-seed-btn').addEventListener('click', () => {
            this.defaultSettings.seed = Math.floor(Math.random() * 4294967294);
            this.updateStatus(`🎲 新种子: ${this.defaultSettings.seed}`);
        });
        
        // 生成按钮
        document.getElementById('ai-generate-btn').addEventListener('click', () => {
            this.generateImage();
        });
        
        // 视频相关控件事件监听器
        const videoCfgSlider = document.getElementById('ai-video-cfg-scale');
        const videoCfgValue = document.getElementById('ai-video-cfg-value');
        videoCfgSlider.addEventListener('input', (e) => {
            videoCfgValue.textContent = e.target.value;
        });
        
        const videoMotionSlider = document.getElementById('ai-video-motion');
        const videoMotionValue = document.getElementById('ai-video-motion-value');
        videoMotionSlider.addEventListener('input', (e) => {
            videoMotionValue.textContent = e.target.value;
        });
        
        // 视频随机种子按钮
        document.getElementById('ai-video-random-seed-btn').addEventListener('click', () => {
            this.defaultVideoSettings.seed = Math.floor(Math.random() * 4294967294);
            this.updateVideoStatus(`🎲 新视频种子: ${this.defaultVideoSettings.seed}`);
        });
        
        // 生成视频按钮
        document.getElementById('ai-generate-video-btn').addEventListener('click', () => {
            this.generateVideo();
        });
        
        // 循环模式切换
        const loopModeCheckbox = document.getElementById('ai-video-loop-mode');
        loopModeCheckbox.addEventListener('change', (e) => {
            this.onLoopModeToggle(e.target.checked);
        });
        
        // 点击背景关闭图像显示
        this.imageDisplay.addEventListener('click', (e) => {
            if (e.target === this.imageDisplay) {
                this.hideImageDisplay();
            }
        });
        
        // ESC键关闭面板和图像显示
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePanel();
                this.hideImageDisplay();
            }
            // G键快速生成
            else if (e.key === 'g' || e.key === 'G') {
                if (this.panel.style.display === 'block') {
                    this.generateImage();
                }
            }
        });
    }
    
    showPanel() {
        this.panel.style.display = 'block';
        this.updateStatus('🎨 AI生图面板已打开');
    }
    
    hidePanel() {
        this.panel.style.display = 'none';
    }
    
    togglePanel() {
        if (this.panel.style.display === 'none' || this.panel.style.display === '') {
            this.showPanel();
        } else {
            this.hidePanel();
        }
    }
    
    updateStatus(message) {
        const statusEl = document.getElementById('ai-status');
        if (statusEl) {
            statusEl.textContent = message;
            console.log(`AI生成器: ${message}`);
        }
    }
    
    updateVideoStatus(message) {
        const statusEl = document.getElementById('ai-video-status');
        if (statusEl) {
            statusEl.textContent = message;
            console.log(`AI视频生成器: ${message}`);
        }
    }
    
    onLoopModeToggle(isLoopMode) {
        const motionSlider = document.getElementById('ai-video-motion');
        const motionValue = document.getElementById('ai-video-motion-value');
        const cfgSlider = document.getElementById('ai-video-cfg-scale');
        const cfgValue = document.getElementById('ai-video-cfg-value');
        
        if (isLoopMode) {
            // 启用循环模式：建议更温和的设置
            if (parseInt(motionSlider.value) > 100) {
                motionSlider.value = 80; // 建议更低的运动强度
                motionValue.textContent = '80';
            }
            if (parseFloat(cfgSlider.value) < 2.0) {
                cfgSlider.value = 2.2; // 建议更高的相似度
                cfgValue.textContent = '2.2';
            }
            this.updateVideoStatus('🔄 循环模式已启用，参数已优化为循环友好设置');
        } else {
            // 禁用循环模式：恢复正常设置
            if (parseInt(motionSlider.value) < 100) {
                motionSlider.value = 127; // 恢复默认运动强度
                motionValue.textContent = '127';
            }
            if (parseFloat(cfgSlider.value) > 2.0) {
                cfgSlider.value = 1.8; // 恢复默认相似度
                cfgValue.textContent = '1.8';
            }
            this.updateVideoStatus('📹 循环模式已禁用，恢复正常视频设置');
        }
        
        console.log(`🔄 循环模式切换: ${isLoopMode ? '启用' : '禁用'}`);
    }
    
    async generateImage() {
        if (this.isGenerating) {
            this.updateStatus('⏳ 正在生成中，请稍候...');
            return;
        }
        
        // 检查音乐可视化器是否可用
        if (!window.musicVisualizer || !window.musicVisualizer.isEnabled) {
            this.updateStatus('❌ 请先启动音乐可视化器 (按V键)');
            return;
        }
        
        // 获取当前瀑布流图像
        const canvasDataURL = window.musicVisualizer.getCanvasDataURL();
        if (!canvasDataURL) {
            this.updateStatus('❌ 无法获取瀑布流图像，请确保瀑布流正在显示');
            return;
        }
        
        // 验证图像数据有效性
        const validation = this.validateWaterfallImage(canvasDataURL);
        if (!validation.valid) {
            this.updateStatus(`❌ 瀑布流图像验证失败: ${validation.error}`);
            console.error('❌ 图像验证失败:', validation.error);
            return;
        }
        
        console.log('✅ 瀑布流图像验证通过，开始生成AI图像');
        
        this.isGenerating = true;
        this.updateStatus('🎨 正在使用Scribble模式基于瀑布流生成AI图像...');
        
        // 更新右侧面板状态
        this.showLoadingInPanel();
        
        // 更新按钮状态
        const generateBtn = document.getElementById('ai-generate-btn');
        const originalText = generateBtn.textContent;
        generateBtn.textContent = '⏳ 生成中...';
        generateBtn.disabled = true;
        
        try {
            // 准备请求参数
            const prompt = this.getPrompt();
            const settings = this.getSettings();
            
            console.log('🎵 使用Scribble模式处理瀑布流图像，提示词:', prompt);
            console.log('🎛️ Scribble控制强度:', settings.control_strength);
            
            // 也记录中文说明便于调试
            const chinesePrompt = this.getChinesePrompt();
            console.log('🎨 选择的风格:', chinesePrompt);
            
            // 验证canvas数据URL
            console.log('📊 原始Canvas数据URL长度:', canvasDataURL.length);
            console.log('📊 Canvas数据URL前缀:', canvasDataURL.substring(0, 50));
            
            // 将canvas数据URL转换为Blob
            const imageBlob = await this.dataURLToBlob(canvasDataURL);
            console.log('📊 转换后的图像Blob信息:');
            console.log('  - 大小:', imageBlob.size, 'bytes');
            console.log('  - 类型:', imageBlob.type);
            
            // 验证图像大小（API要求）
            if (imageBlob.size === 0) {
                throw new Error('图像数据为空，无法发送到API');
            }
            
            if (imageBlob.size > 10 * 1024 * 1024) { // 10MB限制
                console.warn('⚠️ 图像大小超过10MB，可能会被API拒绝');
            }
            
            // 创建FormData
            const formData = new FormData();
            formData.append('image', imageBlob, 'waterfall.png');
            formData.append('prompt', prompt);
            formData.append('control_strength', settings.control_strength);
            formData.append('output_format', settings.output_format);
            formData.append('style_preset', settings.style_preset);
            formData.append('seed', settings.seed);
            
            if (settings.negative_prompt) {
                formData.append('negative_prompt', settings.negative_prompt);
            }
            
            // 日志FormData内容
            console.log('📤 发送到API的参数:');
            for (let [key, value] of formData.entries()) {
                if (key === 'image') {
                    console.log(`  - ${key}: [Blob] ${value.size} bytes, ${value.type}`);
                } else {
                    console.log(`  - ${key}: ${value}`);
                }
            }
            
            this.updateStatus('📡 发送瀑布流到Stability AI Scribble模式...');
            
            // 发送请求
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'image/*',
                    'stability-client-id': 'music-visualizer-app',
                    'stability-client-version': '1.0.0'
                },
                body: formData
            });
            
            console.log('📡 API响应状态:', response.status, response.statusText);
            console.log('📡 API响应头:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                let errorText;
                try {
                    errorText = await response.text();
                    console.error('❌ API错误响应:', errorText);
                } catch (e) {
                    errorText = `无法读取错误信息: ${e.message}`;
                }
                
                // 尝试解析JSON错误信息
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.errors && errorJson.errors.length > 0) {
                        console.error('❌ API错误详情:', errorJson.errors);
                        throw new Error(`API错误: ${errorJson.errors[0]}`);
                    }
                } catch (jsonError) {
                    // 如果不是JSON，直接使用原始错误文本
                }
                
                throw new Error(`API请求失败 (${response.status}): ${errorText}`);
            }
            
            // 检查响应内容类型
            const contentType = response.headers.get('content-type');
            console.log('📥 响应内容类型:', contentType);
            
            if (!contentType || !contentType.includes('image/')) {
                console.warn('⚠️ 响应不是图像类型，可能有问题');
            }
            
            // 处理响应
            const imageArrayBuffer = await response.arrayBuffer();
            console.log('📥 接收到的图像大小:', imageArrayBuffer.byteLength, 'bytes');
            
            if (imageArrayBuffer.byteLength === 0) {
                throw new Error('API返回了空的图像数据');
            }
            
            const imageBlob2 = new Blob([imageArrayBuffer], { type: `image/${settings.output_format}` });
            const imageURL = URL.createObjectURL(imageBlob2);
            
            console.log('✅ 图像URL创建成功:', imageURL.substring(0, 50) + '...');
            
            // 启动瀑布流诞生动画
            this.startWaterfallBirthAnimation(imageURL);
            
            // 延迟显示生成的图像到右侧面板（等动画完成）
            setTimeout(() => {
                this.displayImageInPanel(imageURL, prompt, settings);
            }, 4500); // 诞生动画1.5秒 + 飞行动画2秒 + 放大动画1秒
            
            // 添加到历史记录
            this.addToGallery(imageURL, prompt);
            
            // 添加到生成图像数组（供视频生成使用）
            this.generatedImages.push(imageURL);
            
            this.updateStatus(`✅ Scribble模式基于瀑布流的AI图像生成成功! 种子: ${settings.seed}`);
            
        } catch (error) {
            console.error('❌ AI图像生成失败:', error);
            console.error('❌ 错误堆栈:', error.stack);
            this.updateStatus(`❌ 生成失败: ${error.message}`);
            this.hideLoadingInPanel();
            
            // 如果有瀑布流动画正在进行，停止它
            if (window.musicVisualizer && window.musicVisualizer.aiImageAnimation.isActive) {
                window.musicVisualizer.aiImageAnimation.isActive = false;
                window.musicVisualizer.aiImageAnimation.birthEffect.active = false;
                window.musicVisualizer.aiImageAnimation.flyingImage.active = false;
                window.musicVisualizer.aiImageAnimation.expandingImage.active = false;
                // 隐藏动画容器
                if (window.musicVisualizer.aiImageAnimation.container) {
                    window.musicVisualizer.aiImageAnimation.container.style.display = 'none';
                }
                // 停止动画循环
                if (window.musicVisualizer.aiImageAnimation.animationFrame) {
                    cancelAnimationFrame(window.musicVisualizer.aiImageAnimation.animationFrame);
                    window.musicVisualizer.aiImageAnimation.animationFrame = null;
                }
            }
        } finally {
            this.isGenerating = false;
            generateBtn.textContent = originalText;
            generateBtn.disabled = false;
        }
    }
    
    getPrompt() {
        const customPrompt = document.getElementById('ai-custom-prompt').value.trim();
        if (customPrompt) {
            return customPrompt;
        }
        
        const selectedIndex = document.getElementById('ai-prompt-select').value;
        return this.musicPrompts[selectedIndex]?.english || this.musicPrompts[0].english;
    }
    
    getSettings() {
        return {
            control_strength: parseFloat(document.getElementById('ai-control-strength').value),
            output_format: 'png',
            style_preset: document.getElementById('ai-style-preset').value,
            seed: this.defaultSettings.seed,
            negative_prompt: document.getElementById('ai-negative-prompt').value.trim()
        };
    }
    
    getVideoSettings() {
        const isLoopMode = document.getElementById('ai-video-loop-mode').checked;
        const baseCfgScale = parseFloat(document.getElementById('ai-video-cfg-scale').value);
        const baseMotion = parseInt(document.getElementById('ai-video-motion').value);
        
        let finalCfgScale = baseCfgScale;
        let finalMotion = baseMotion;
        
        if (isLoopMode) {
            // 循环模式优化：提高相似度，降低运动强度
            finalCfgScale = Math.min(10, baseCfgScale + 0.5); // 提高相似度
            finalMotion = Math.max(1, Math.round(baseMotion * 0.6)); // 降低运动强度到60%
            
            console.log('🔄 循环模式优化:');
            console.log(`  - 相似度: ${baseCfgScale} → ${finalCfgScale} (更保守)`);
            console.log(`  - 运动强度: ${baseMotion} → ${finalMotion} (更温和)`);
        }
        
        return {
            seed: this.defaultVideoSettings.seed,
            cfg_scale: finalCfgScale,
            motion_bucket_id: finalMotion,
            loop_mode: isLoopMode
        };
    }
    
    async generateVideo() {
        if (this.isGeneratingVideo) {
            this.updateVideoStatus('⏳ 正在生成视频中，请稍候...');
            return;
        }
        
        // 检查是否有AI生成的图像可以用来生成视频
        if (this.generatedImages.length === 0) {
            this.updateVideoStatus('❌ 请先生成一张AI图像再转换为视频');
            return;
        }
        
        // 使用最新生成的图像
        const latestImageURL = this.generatedImages[this.generatedImages.length - 1];
        
        this.isGeneratingVideo = true;
        this.updateVideoStatus('🎬 正在基于AI图像生成视频...');
        
        // 更新按钮状态
        const generateVideoBtn = document.getElementById('ai-generate-video-btn');
        const originalText = generateVideoBtn.textContent;
        generateVideoBtn.textContent = '⏳ 生成中...';
        generateVideoBtn.disabled = true;
        
        try {
                         // 获取视频生成设置
             const videoSettings = this.getVideoSettings();
             
             console.log('🎬 开始视频生成，设置:', videoSettings);
             console.log('🖼️ 使用图像URL:', latestImageURL.substring(0, 50) + '...');
             
             if (videoSettings.loop_mode) {
                 this.updateVideoStatus('🔄 循环模式视频生成中 - 优化参数以获得更好的循环效果...');
             }
            
                         // 将图像URL转换为Blob
             let imageBlob = await this.urlToBlob(latestImageURL);
             console.log('📊 原始图像Blob信息:');
             console.log('  - 大小:', imageBlob.size, 'bytes');
             console.log('  - 类型:', imageBlob.type);
             
             // 验证图像尺寸（API要求特定尺寸）
             const imageDimensions = await this.getImageDimensions(latestImageURL);
             console.log('📐 图像尺寸:', imageDimensions);
             
             // 检查尺寸是否符合要求并智能选择最佳尺寸
             const supportedDimensions = [
                 { width: 1024, height: 576, ratio: 1024/576, name: '16:9横向' },
                 { width: 576, height: 1024, ratio: 576/1024, name: '9:16竖向' },
                 { width: 768, height: 768, ratio: 1, name: '1:1正方形' }
             ];
             
             const currentRatio = imageDimensions.width / imageDimensions.height;
             
             const isValidDimension = supportedDimensions.some(dim => 
                 dim.width === imageDimensions.width && dim.height === imageDimensions.height
             );
             
             if (!isValidDimension) {
                 // 根据长宽比智能选择最佳目标尺寸
                 const bestDimension = this.selectBestDimensionForVideo(currentRatio, supportedDimensions);
                 
                 console.log(`⚠️ 图像尺寸${imageDimensions.width}x${imageDimensions.height}不符合要求`);
                 console.log(`📐 原图比例: ${currentRatio.toFixed(2)}, 选择目标: ${bestDimension.name} (${bestDimension.width}x${bestDimension.height})`);
                 this.updateVideoStatus(`🔧 调整图像尺寸为${bestDimension.name} (${bestDimension.width}x${bestDimension.height})...`);
                 
                 const resizedImageBlob = await this.resizeImageForVideo(latestImageURL, bestDimension.width, bestDimension.height);
                 if (resizedImageBlob) {
                     // 使用调整后的图像
                     imageBlob = resizedImageBlob;
                     console.log(`✅ 图像尺寸调整成功，新尺寸: ${bestDimension.width}x${bestDimension.height}`);
                     console.log('📊 调整后图像Blob信息:');
                     console.log('  - 大小:', imageBlob.size, 'bytes');
                     console.log('  - 类型:', imageBlob.type);
                 } else {
                     throw new Error(`无法调整图像尺寸，请生成1024x576、576x1024或768x768尺寸的图像`);
                 }
             }
             
             // 创建FormData
             const formData = new FormData();
             formData.append('image', imageBlob, 'ai-generated.png');
            formData.append('seed', videoSettings.seed);
            formData.append('cfg_scale', videoSettings.cfg_scale);
            formData.append('motion_bucket_id', videoSettings.motion_bucket_id);
            
            // 日志FormData内容
            console.log('📤 发送到视频API的参数:');
            for (let [key, value] of formData.entries()) {
                if (key === 'image') {
                    console.log(`  - ${key}: [Blob] ${value.size} bytes, ${value.type}`);
                } else {
                    console.log(`  - ${key}: ${value}`);
                }
            }
            
            this.updateVideoStatus('📡 发送图像到Stability AI视频生成API...');
            
            // 发送视频生成请求
            const response = await fetch(this.videoApiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'stability-client-id': 'music-visualizer-app',
                    'stability-client-version': '1.0.0'
                },
                body: formData
            });
            
            console.log('📡 视频API响应状态:', response.status, response.statusText);
            console.log('📡 视频API响应头:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                let errorText;
                try {
                    errorText = await response.text();
                    console.error('❌ 视频API错误响应:', errorText);
                } catch (e) {
                    errorText = `无法读取错误信息: ${e.message}`;
                }
                
                // 尝试解析JSON错误信息
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.errors && errorJson.errors.length > 0) {
                        console.error('❌ 视频API错误详情:', errorJson.errors);
                        throw new Error(`视频API错误: ${errorJson.errors[0]}`);
                    }
                } catch (jsonError) {
                    // 如果不是JSON，直接使用原始错误文本
                }
                
                throw new Error(`视频API请求失败 (${response.status}): ${errorText}`);
            }
            
            // 获取生成ID
            const responseData = await response.json();
            const generationId = responseData.id;
            
            if (!generationId) {
                throw new Error('API没有返回生成ID');
            }
            
            console.log('✅ 视频生成已启动，ID:', generationId);
            this.updateVideoStatus(`🎬 视频生成已启动 (ID: ${generationId.substring(0, 8)}...)，正在轮询状态...`);
            
            // 存储生成ID
            this.activeVideoGenerations.set(generationId, {
                startTime: Date.now(),
                imageURL: latestImageURL,
                settings: videoSettings
            });
            
            // 开始轮询检查状态
            this.pollVideoGenerationStatus(generationId);
            
        } catch (error) {
            console.error('❌ AI视频生成失败:', error);
            console.error('❌ 错误堆栈:', error.stack);
            this.updateVideoStatus(`❌ 视频生成失败: ${error.message}`);
        } finally {
            this.isGeneratingVideo = false;
            generateVideoBtn.textContent = originalText;
            generateVideoBtn.disabled = false;
        }
    }
    
    async pollVideoGenerationStatus(generationId) {
        const maxPollingTime = 10 * 60 * 1000; // 10分钟最大轮询时间
        const pollInterval = 10 * 1000; // 10秒轮询间隔
        const startTime = Date.now();
        
        const poll = async () => {
            try {
                const response = await fetch(`${this.videoResultEndpoint}/${generationId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Accept': 'video/*',
                        'stability-client-id': 'music-visualizer-app',
                        'stability-client-version': '1.0.0'
                    }
                });
                
                console.log('🔍 轮询视频状态响应:', response.status, response.statusText);
                
                if (response.status === 202) {
                    // 仍在处理中
                    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
                    this.updateVideoStatus(`⏳ 视频生成中... (已等待 ${elapsedTime}s)`);
                    
                    // 检查是否超时
                    if (Date.now() - startTime < maxPollingTime) {
                        setTimeout(poll, pollInterval);
                    } else {
                        throw new Error('视频生成超时，请稍后再试');
                    }
                } else if (response.status === 200) {
                    // 生成完成
                    console.log('✅ 视频生成完成！');
                    
                    const videoArrayBuffer = await response.arrayBuffer();
                    console.log('📥 接收到的视频大小:', videoArrayBuffer.byteLength, 'bytes');
                    
                    if (videoArrayBuffer.byteLength === 0) {
                        throw new Error('API返回了空的视频数据');
                    }
                    
                    const videoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
                    const videoURL = URL.createObjectURL(videoBlob);
                    
                    console.log('✅ 视频URL创建成功:', videoURL.substring(0, 50) + '...');
                    
                    // 获取生成信息
                    const genInfo = this.activeVideoGenerations.get(generationId);
                    
                    // 添加到生成历史
                    this.generatedVideos.push({
                        url: videoURL,
                        id: generationId,
                        timestamp: Date.now(),
                        settings: genInfo ? genInfo.settings : null,
                        sourceImage: genInfo ? genInfo.imageURL : null
                    });
                    
                                         // 显示视频
                     this.displayGeneratedVideo(videoURL, generationId, genInfo ? genInfo.settings : null);
                     
                     // 添加到视频历史记录
                     this.addVideoToGallery(videoURL, generationId);
                     
                     // 清理生成记录
                     this.activeVideoGenerations.delete(generationId);
                    
                                         const totalTime = Math.round((Date.now() - startTime) / 1000);
                     const isLoopMode = genInfo && genInfo.settings && genInfo.settings.loop_mode;
                     this.updateVideoStatus(`✅ ${isLoopMode ? '循环' : ''}视频生成成功！耗时 ${totalTime}s ${isLoopMode ? '🔄' : '🎬'}`);
                    
                } else if (response.status === 404) {
                    throw new Error('生成ID不存在或已过期');
                } else {
                    const errorText = await response.text();
                    throw new Error(`获取视频结果失败 (${response.status}): ${errorText}`);
                }
                
            } catch (error) {
                console.error('❌ 轮询视频状态失败:', error);
                this.updateVideoStatus(`❌ 轮询失败: ${error.message}`);
                this.activeVideoGenerations.delete(generationId);
            }
        };
        
        // 开始轮询
        poll();
    }
    
    async urlToBlob(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            if (!blob || blob.size === 0) {
                throw new Error('转换后的Blob为空');
            }
            
            return blob;
        } catch (error) {
            console.error('❌ URL转Blob失败:', error);
            throw new Error(`URL转换失败: ${error.message}`);
        }
    }
    
    async getImageDimensions(imageURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = () => {
                reject(new Error('无法加载图像以获取尺寸'));
            };
            img.src = imageURL;
        });
    }
    
    selectBestDimensionForVideo(currentRatio, supportedDimensions) {
        // 计算每个支持尺寸与当前比例的差距
        const ratioDistances = supportedDimensions.map(dim => ({
            ...dim,
            distance: Math.abs(dim.ratio - currentRatio)
        }));
        
        // 选择比例最接近的尺寸
        const bestDimension = ratioDistances.reduce((best, current) => 
            current.distance < best.distance ? current : best
        );
        
        console.log('📊 比例匹配分析:');
        ratioDistances.forEach(dim => {
            console.log(`  - ${dim.name}: 比例${dim.ratio.toFixed(2)}, 距离${dim.distance.toFixed(3)} ${dim === bestDimension ? '← 最佳' : ''}`);
        });
        
        return bestDimension;
    }
    
    async resizeImageForVideo(imageURL, targetWidth, targetHeight) {
        try {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    
                    // 计算保持比例的缩放
                    const sourceRatio = img.width / img.height;
                    const targetRatio = targetWidth / targetHeight;
                    
                    let drawWidth, drawHeight, offsetX, offsetY;
                    
                    if (sourceRatio > targetRatio) {
                        // 原图更宽，以高度为准
                        drawHeight = targetHeight;
                        drawWidth = drawHeight * sourceRatio;
                        offsetX = (targetWidth - drawWidth) / 2;
                        offsetY = 0;
                    } else {
                        // 原图更高，以宽度为准
                        drawWidth = targetWidth;
                        drawHeight = drawWidth / sourceRatio;
                        offsetX = 0;
                        offsetY = (targetHeight - drawHeight) / 2;
                    }
                    
                    // 使用黑色背景填充
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, targetWidth, targetHeight);
                    
                    // 绘制居中的图像
                    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                    
                    // 转换为Blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('无法创建调整后的图像Blob'));
                        }
                    }, 'image/png');
                };
                img.onerror = () => {
                    reject(new Error('无法加载图像进行尺寸调整'));
                };
                img.src = imageURL;
            });
        } catch (error) {
            console.error('❌ 图像尺寸调整失败:', error);
            return null;
        }
    }
    
    displayGeneratedVideo(videoURL, generationId, settings) {
        // 创建视频显示对话框
        const videoDisplay = document.createElement('div');
        videoDisplay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border-radius: 10px;
            padding: 20px;
            z-index: 1003;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;
        
        const isLoopMode = settings && settings.loop_mode;
        
        videoDisplay.innerHTML = `
            <div style="text-align: center; color: white; margin-bottom: 15px;">
                <h3 style="margin: 0 0 10px 0; color: #9C27B0;">🎬 AI生成的视频 ${isLoopMode ? '🔄' : ''}</h3>
                <div style="font-size: 12px; color: #ccc;">
                    生成ID: ${generationId.substring(0, 8)}...
                    ${settings ? `| 相似度: ${settings.cfg_scale} | 运动强度: ${settings.motion_bucket_id}` : ''}
                    ${isLoopMode ? ' | 🔄 循环优化' : ''}
                </div>
            </div>
            <video 
                controls 
                autoplay 
                loop 
                muted
                playsinline
                style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); ${isLoopMode ? 'border: 2px solid #9C27B0;' : ''}"
                onloadeddata="this.currentTime = 0; if(${isLoopMode}) { this.play(); }"
            >
                <source src="${videoURL}" type="video/mp4">
                您的浏览器不支持视频播放。
            </video>
            ${isLoopMode ? `
            <div style="margin-top: 10px; font-size: 11px; color: #9C27B0; text-align: center;">
                🔄 循环模式：此视频经过优化，适合无缝循环播放
            </div>
            ` : ''}
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                <button onclick="aiImageGenerator.downloadVideo('${videoURL}', 'ai-generated-${isLoopMode ? 'loop-' : ''}video-${generationId.substring(0, 8)}')" style="padding: 8px 15px; background: #9C27B0; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    📥 下载视频
                </button>
                ${isLoopMode ? `
                <button onclick="aiImageGenerator.createLoopPreview('${videoURL}')" style="padding: 8px 15px; background: #673AB7; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    🔄 循环预览
                </button>
                ` : ''}
                <button onclick="this.parentElement.parentElement.remove()" style="padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    ❌ 关闭
                </button>
            </div>
        `;
        
        document.body.appendChild(videoDisplay);
        
        // 点击背景关闭
        videoDisplay.addEventListener('click', (e) => {
            if (e.target === videoDisplay) {
                document.body.removeChild(videoDisplay);
            }
        });
        
        console.log('✅ 视频已显示在对话框中');
    }
    
         downloadVideo(videoURL, filename) {
         const link = document.createElement('a');
         link.href = videoURL;
         link.download = `${filename}.mp4`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         console.log('📥 视频下载已开始');
     }
     
     createLoopPreview(videoURL) {
         // 创建循环预览窗口
         const loopPreview = document.createElement('div');
         loopPreview.style.cssText = `
             position: fixed;
             top: 50%;
             left: 50%;
             transform: translate(-50%, -50%);
             background: rgba(0, 0, 0, 0.98);
             border-radius: 15px;
             padding: 30px;
             z-index: 1004;
             max-width: 95vw;
             max-height: 95vh;
             display: flex;
             flex-direction: column;
             align-items: center;
             border: 3px solid #9C27B0;
             box-shadow: 0 0 30px rgba(156, 39, 176, 0.5);
         `;
         
         loopPreview.innerHTML = `
             <div style="text-align: center; color: white; margin-bottom: 20px;">
                 <h2 style="margin: 0 0 10px 0; color: #9C27B0;">🔄 循环视频预览</h2>
                 <div style="font-size: 14px; color: #ccc; margin-bottom: 10px;">
                     连续播放展示循环效果
                 </div>
                 <div style="display: flex; gap: 10px; align-items: center; justify-content: center; margin-bottom: 10px;">
                     <button id="loop-play-btn" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">▶️ 播放</button>
                     <button id="loop-pause-btn" style="padding: 5px 10px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer;">⏸️ 暂停</button>
                     <span style="color: #9C27B0; font-size: 12px;">循环计数: <span id="loop-counter">0</span></span>
                 </div>
             </div>
             
             <div style="position: relative;">
                 <video 
                     id="loop-preview-video"
                     autoplay 
                     loop 
                     muted
                     playsinline
                     style="max-width: 80vw; max-height: 60vh; border-radius: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.7); border: 2px solid #9C27B0;"
                 >
                     <source src="${videoURL}" type="video/mp4">
                 </video>
                 
                 <div style="position: absolute; top: 10px; right: 10px; background: rgba(156, 39, 176, 0.9); color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; backdrop-filter: blur(5px);">
                     🔄 循环中
                 </div>
             </div>
             
             <div style="margin-top: 20px; display: flex; gap: 15px; justify-content: center;">
                 <button id="loop-download-btn" style="padding: 10px 20px; background: #9C27B0; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                     📥 下载循环视频
                 </button>
                 <button onclick="this.parentElement.parentElement.remove()" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                     ❌ 关闭预览
                 </button>
             </div>
         `;
         
         document.body.appendChild(loopPreview);
         
         // 添加事件监听器
         const video = loopPreview.querySelector('#loop-preview-video');
         const playBtn = loopPreview.querySelector('#loop-play-btn');
         const pauseBtn = loopPreview.querySelector('#loop-pause-btn');
         const downloadBtn = loopPreview.querySelector('#loop-download-btn');
         const counter = loopPreview.querySelector('#loop-counter');
         
         let loopCount = 0;
         
         // 监听视频循环
         video.addEventListener('ended', () => {
             loopCount++;
             counter.textContent = loopCount;
             video.currentTime = 0;
             video.play();
         });
         
         // 由于设置了loop属性，我们需要手动计数
         video.addEventListener('timeupdate', () => {
             // 检测是否接近结尾（最后0.1秒）
             if (video.duration - video.currentTime < 0.1 && video.currentTime > 0.5) {
                 if (video.getAttribute('data-last-loop') !== 'true') {
                     loopCount++;
                     counter.textContent = loopCount;
                     video.setAttribute('data-last-loop', 'true');
                 }
             } else if (video.currentTime < 0.5) {
                 video.setAttribute('data-last-loop', 'false');
             }
         });
         
         // 控制按钮
         playBtn.addEventListener('click', () => {
             video.play();
         });
         
         pauseBtn.addEventListener('click', () => {
             video.pause();
         });
         
         downloadBtn.addEventListener('click', () => {
             this.downloadVideo(videoURL, `ai-loop-video-${Date.now()}`);
         });
         
         // 点击背景关闭
         loopPreview.addEventListener('click', (e) => {
             if (e.target === loopPreview) {
                 document.body.removeChild(loopPreview);
             }
         });
         
         console.log('🔄 循环预览窗口已打开');
     }
     
     addVideoToGallery(videoURL, generationId) {
         const videoGallery = document.getElementById('ai-video-gallery-content');
         
         // 清除"暂无视频"提示
         if (videoGallery.children.length === 1 && videoGallery.children[0].textContent === '暂无视频') {
             videoGallery.innerHTML = '';
         }
         
         const videoThumbnail = document.createElement('div');
         videoThumbnail.style.cssText = `
             width: 60px;
             height: 40px;
             background: linear-gradient(45deg, #9C27B0, #8E24AA);
             border-radius: 5px;
             cursor: pointer;
             border: 2px solid transparent;
             transition: border-color 0.3s;
             display: flex;
             align-items: center;
             justify-content: center;
             color: white;
             font-size: 16px;
             position: relative;
         `;
         
         // 添加播放图标
         videoThumbnail.innerHTML = '▶️';
         videoThumbnail.title = `视频 ${generationId.substring(0, 8)}... (点击播放)`;
         
         videoThumbnail.addEventListener('click', () => {
             // 找到对应的视频信息
             const videoInfo = this.generatedVideos.find(v => v.id === generationId);
             this.displayGeneratedVideo(videoURL, generationId, videoInfo ? videoInfo.settings : null);
         });
         
         videoThumbnail.addEventListener('mouseenter', () => {
             videoThumbnail.style.borderColor = '#9C27B0';
         });
         
         videoThumbnail.addEventListener('mouseleave', () => {
             videoThumbnail.style.borderColor = 'transparent';
         });
         
         videoGallery.appendChild(videoThumbnail);
         
         // 限制历史记录数量
         if (videoGallery.children.length > 5) {
             videoGallery.removeChild(videoGallery.firstChild);
         }
         
         console.log('🎬 视频已添加到历史记录');
     }
    
    async dataURLToBlob(dataURL) {
        try {
            const response = await fetch(dataURL);
            const blob = await response.blob();
            
            // 验证blob是否有效
            if (!blob || blob.size === 0) {
                throw new Error('转换后的Blob为空');
            }
            
            // 验证是否为图像类型
            if (!blob.type.startsWith('image/')) {
                console.warn('⚠️ Blob类型不是图像:', blob.type);
            }
            
            return blob;
        } catch (error) {
            console.error('❌ dataURL转Blob失败:', error);
            throw new Error(`图像数据转换失败: ${error.message}`);
        }
    }
    
    // 验证瀑布流图像是否有效
    validateWaterfallImage(dataURL) {
        try {
            // 检查dataURL格式
            if (!dataURL || typeof dataURL !== 'string') {
                return { valid: false, error: '图像数据为空或格式错误' };
            }
            
            // 检查是否为valid dataURL
            if (!dataURL.startsWith('data:image/')) {
                return { valid: false, error: '不是有效的图像数据URL' };
            }
            
            // 检查数据长度
            if (dataURL.length < 1000) {
                return { valid: false, error: '图像数据太小，可能为空图像' };
            }
            
            return { valid: true };
        } catch (error) {
            return { valid: false, error: `验证失败: ${error.message}` };
        }
    }
    
    // 测试方法：显示原始瀑布流图像
    showOriginalWaterfallImage() {
        if (!window.musicVisualizer || !window.musicVisualizer.isEnabled) {
            console.error('❌ 音乐可视化器未启用');
            return;
        }
        
        const canvasDataURL = window.musicVisualizer.getCanvasDataURL();
        const validation = this.validateWaterfallImage(canvasDataURL);
        
        if (!validation.valid) {
            console.error('❌ 瀑布流图像无效:', validation.error);
            return;
        }
        
        console.log('✅ 瀑布流图像验证通过');
        
        // 创建预览窗口
        const previewWindow = document.createElement('div');
        previewWindow.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border-radius: 10px;
            padding: 20px;
            z-index: 1003;
            max-width: 90vw;
            max-height: 90vh;
        `;
        
        previewWindow.innerHTML = `
            <div style="text-align: center; color: white;">
                <h3 style="margin: 0 0 15px 0; color: #4CAF50;">🎵 当前瀑布流图像预览</h3>
                <img src="${canvasDataURL}" style="max-width: 100%; max-height: 60vh; border-radius: 8px; border: 2px solid #4CAF50;" />
                <div style="margin-top: 15px; font-size: 12px;">
                    <div>数据大小: ${canvasDataURL.length} 字符</div>
                    <div>格式: ${canvasDataURL.substring(5, canvasDataURL.indexOf(';'))}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 15px; padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    关闭预览
                </button>
            </div>
        `;
        
        document.body.appendChild(previewWindow);
        
        // 3秒后自动关闭
        setTimeout(() => {
            if (previewWindow.parentNode) {
                previewWindow.parentNode.removeChild(previewWindow);
            }
        }, 10000);
    }
    
    showLoadingInPanel() {
        // 保持当前图片显示，不显示加载文字，让用户好好观赏当前图片
        // 不做任何操作，保持面板内容不变
    }
    
    hideLoadingInPanel() {
        // 在新的设计中，我们不隐藏现有图片，保持当前状态
        // 如果发生错误，让用户继续观赏当前图片
    }
    
    displayImageInPanel(imageURL, prompt, settings) {
        // 在右侧面板显示生成的图像，只有旧图片淡出效果，新图片直接显示
        const aiContainer = document.getElementById('ai-image-container');
        if (!aiContainer) return;
        
        // 检查是否已经有图片内容
        const existingContent = aiContainer.querySelector('.ai-image-content');
        
        // 创建新的图片内容，直接显示（不需要淡入）
        const newImageContent = document.createElement('div');
        newImageContent.className = 'ai-image-content';
        newImageContent.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            opacity: 1;
        `;
        
        newImageContent.innerHTML = `
            <img src="${imageURL}" class="ai-image" style="flex: 1; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;" />
            <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 3px;">
                <button onclick="aiImageGenerator.downloadImage('${imageURL}', 'ai-waterfall')" 
                        style="width: 24px; height: 24px; background: rgba(76, 175, 80, 0.9); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;"
                        title="下载图像">📥</button>
                <button onclick="aiImageGenerator.showFullImageDialog('${imageURL}', '${this.getChinesePrompt()}', ${JSON.stringify(settings).replace(/"/g, '&quot;')})" 
                        style="width: 24px; height: 24px; background: rgba(33, 150, 243, 0.9); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;"
                        title="查看大图">🔍</button>
                <button onclick="aiImageGenerator.clearImageFromPanel()" 
                        style="width: 24px; height: 24px; background: rgba(244, 67, 54, 0.9); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;"
                        title="清除图像">❌</button>
            </div>
        `;
        
        // 确保容器有相对定位
        if (aiContainer.style.position !== 'relative') {
            aiContainer.style.position = 'relative';
        }
        
        // 直接添加新图片到容器（立即显示）
        aiContainer.appendChild(newImageContent);
        
        // 如果有旧图片，启动淡出动画
        if (existingContent) {
            existingContent.style.transition = 'opacity 1.5s ease-in-out';
            existingContent.style.opacity = '0';
            
            // 淡出完成后移除旧图片
            setTimeout(() => {
                if (existingContent.parentNode) {
                    existingContent.parentNode.removeChild(existingContent);
                }
            }, 1500);
        }
        
        console.log('✅ AI生成的图像已显示在右侧面板，旧图片正在淡出');
    }
    
    getChinesePrompt() {
        const customPrompt = document.getElementById('ai-custom-prompt').value.trim();
        if (customPrompt) {
            return customPrompt.length > 20 ? customPrompt.substring(0, 20) + '...' : customPrompt;
        }
        
        const selectedIndex = document.getElementById('ai-prompt-select').value;
        return this.musicPrompts[selectedIndex]?.chinese || this.musicPrompts[0].chinese;
    }
    
    clearImageFromPanel() {
        // 清除右侧面板的图像，实现淡出效果
        const aiContainer = document.getElementById('ai-image-container');
        if (aiContainer) {
            const existingContent = aiContainer.querySelector('.ai-image-content');
            if (existingContent) {
                existingContent.style.transition = 'opacity 1.0s ease-in-out';
                existingContent.style.opacity = '0';
                
                // 淡出完成后移除图片，恢复占位符
                setTimeout(() => {
                    aiContainer.innerHTML = `
                        <div class="ai-placeholder">
                            <div>🖼️ SD重绘图像将显示在这里</div>
                            <div style="margin-top: 6px; font-size: 10px;">捕获瀑布流后点击"🎨"</div>
                        </div>
                    `;
                }, 1000);
            }
        }
        console.log('🗑️ AI图像正在淡出清除');
    }
    
    showFullImageDialog(imageURL, prompt, settings) {
        // 显示大图对话框
        this.displayGeneratedImage(imageURL, prompt, settings);
    }
    
    displayGeneratedImage(imageURL, prompt, settings) {
        this.imageDisplay.innerHTML = `
            <div style="text-align: center; color: white;">
                <h3 style="margin: 0 0 15px 0; color: #4CAF50;">🎨 AI生成的图像</h3>
                <img src="${imageURL}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" />
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="aiImageGenerator.downloadImage('${imageURL}', 'ai-generated-waterfall')" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        📥 下载图像
                    </button>
                    <button onclick="aiImageGenerator.hideImageDisplay()" style="padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        ❌ 关闭
                    </button>
                </div>
            </div>
        `;
        
        this.imageDisplay.style.display = 'block';
    }
    
    hideImageDisplay() {
        this.imageDisplay.style.display = 'none';
    }
    
    addToGallery(imageURL, prompt) {
        const gallery = document.getElementById('ai-gallery-content');
        const thumbnail = document.createElement('div');
        
        // 获取中文说明用于工具提示
        const chinesePrompt = this.getChinesePrompt();
        
        thumbnail.style.cssText = `
            width: 60px;
            height: 60px;
            background-image: url(${imageURL});
            background-size: cover;
            background-position: center;
            border-radius: 5px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: border-color 0.3s;
        `;
        
        thumbnail.title = chinesePrompt;
        thumbnail.addEventListener('click', () => {
            this.displayGeneratedImage(imageURL, prompt, {});
        });
        
        thumbnail.addEventListener('mouseenter', () => {
            thumbnail.style.borderColor = '#4CAF50';
        });
        
        thumbnail.addEventListener('mouseleave', () => {
            thumbnail.style.borderColor = 'transparent';
        });
        
        gallery.appendChild(thumbnail);
        
        // 限制历史记录数量
        if (gallery.children.length > 10) {
            gallery.removeChild(gallery.firstChild);
        }
    }
    
    downloadImage(imageURL, filename) {
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = `${filename}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * 启动瀑布流AI图像诞生动画
     */
    startWaterfallBirthAnimation(imageURL) {
        // 检查音乐可视化器是否可用
        if (!window.musicVisualizer || !window.musicVisualizer.isEnabled) {
            console.warn('⚠️ 瀑布流可视化器未启用，跳过诞生动画');
            return;
        }
        
        // 找到AI图像容器作为目标
        let targetElement = document.getElementById('ai-image-container');
        if (!targetElement) {
            // 如果找不到专用容器，尝试查找右侧面板区域
            const rightPanel = document.querySelector('.ai-generator-panel');
            if (rightPanel) {
                // 创建一个临时目标元素在右侧面板中
                targetElement = document.createElement('div');
                targetElement.style.cssText = `
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    width: 100px;
                    height: 100px;
                    pointer-events: none;
                `;
                rightPanel.appendChild(targetElement);
                
                // 动画完成后移除临时元素
                setTimeout(() => {
                    if (targetElement.parentNode) {
                        targetElement.parentNode.removeChild(targetElement);
                    }
                }, 4000);
            } else {
                console.warn('⚠️ 未找到AI图像容器，使用默认目标位置');
                targetElement = null;
            }
        }
        
        console.log('🎬 启动瀑布流AI图像诞生动画');
        
        // 启动瀑布流动画
        window.musicVisualizer.startAIImageBirthAnimation(imageURL, targetElement);
        
        // 更新状态显示
        this.updateStatus('🎬 AI图像正在从瀑布流中诞生...');
    }
}

// 初始化AI图像生成器
function initAIImageGenerator() {
    window.aiImageGenerator = new AIImageGenerator();
    
    // 添加全局切换函数
    window.toggleAIGenerator = () => {
        if (window.aiImageGenerator) {
            window.aiImageGenerator.togglePanel();
        }
    };
    
    // 添加调试和测试函数
    window.testWaterfallImage = () => {
        if (window.aiImageGenerator) {
            window.aiImageGenerator.showOriginalWaterfallImage();
        }
    };
    
    console.log('🎨 AI图像生成器已初始化（含图生视频功能）');
    console.log('💡 按A键打开AI生图面板，按G键快速生成图像');
    console.log('🎬 生成图像后可以点击"🎬 图像生成视频"按钮来生成视频');
    console.log('🔧 调试命令:');
    console.log('  testWaterfallImage() - 预览当前瀑布流图像');
    console.log('  window.aiImageGenerator.validateWaterfallImage(dataURL) - 验证图像数据');
    console.log('  window.aiImageGenerator.generateVideo() - 手动触发视频生成');
    console.log('  window.aiImageGenerator.generatedImages - 查看已生成的图像');
    console.log('  window.aiImageGenerator.generatedVideos - 查看已生成的视频');
    console.log('  window.musicVisualizer.getCanvasDataURL() - 获取原始图像数据');
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAIImageGenerator, 1200);
});

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initAIImageGenerator, 200);
} 