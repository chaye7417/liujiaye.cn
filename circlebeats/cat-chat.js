let currentModel = null;
let typingInterval = null;

// ChatGPT API 配置
const OPENAI_API_KEY = "";

// 初始化 Live2D 小猫 - 适配到可视化器面板内
function initLive2D() {
    // 等待目标容器存在
    const targetContainer = document.getElementById('cat-live2d-container');
    if (!targetContainer) {
        console.log('🐱 等待小猫容器加载...');
        setTimeout(initLive2D, 500);
        return;
    }

    L2Dwidget.init({
        model: {
            jsonPath: "https://unpkg.com/live2d-widget-model-tororo/assets/tororo.model.json"
        },
        display: {
            superSample: 1,
            width: 240,
            height: 240,
            position: "fixed",
            hOffset: 180,
            vOffset: 480
        },
        mobile: {
            show: true,
            scale: 1.0
        },
        react: {
            opacity: 1,
            opacityDefault: 1,
            opacityOnHover: 1
        },
        log: false,
        tagMode: false
    });

    // 等待Live2D加载完成后移动到指定容器
    setTimeout(() => {
        try {
            const live2dCanvas = document.querySelector('#L2dCanvas');
            const live2dContainer = document.querySelector('.live2d-widget-container');
            
            if (live2dCanvas && live2dContainer && targetContainer) {
                // 移动整个Live2D容器到目标位置
                targetContainer.appendChild(live2dContainer);
                
                // 调整容器样式以适应面板
                live2dContainer.style.position = 'absolute';
                live2dContainer.style.right = '0px';
                live2dContainer.style.bottom = '50px'; // 与CSS一致，往上移动更多
                live2dContainer.style.width = '240px'; // 改为240px，300%大小
                live2dContainer.style.height = '300px'; // 改为300px，300%大小
                live2dContainer.style.pointerEvents = 'none';
                live2dContainer.style.background = 'transparent';
                live2dContainer.style.border = 'none !important';
                live2dContainer.style.outline = 'none !important';
                live2dContainer.style.boxShadow = 'none !important';
                
                // 调整canvas样式，也去掉边框
                live2dCanvas.style.background = 'transparent';
                live2dCanvas.style.width = '100%';
                live2dCanvas.style.height = '100%';
                live2dCanvas.style.border = 'none !important';
                live2dCanvas.style.outline = 'none !important';
                live2dCanvas.style.boxShadow = 'none !important';
                
                // 使用定时器持续确保样式不被覆盖
                const ensureStyles = () => {
                    if (live2dContainer) {
                        live2dContainer.style.border = 'none !important';
                        live2dContainer.style.outline = 'none !important';
                        live2dContainer.style.boxShadow = 'none !important';
                        live2dContainer.style.bottom = '50px';
                    }
                    if (live2dCanvas) {
                        live2dCanvas.style.border = 'none !important';
                        live2dCanvas.style.outline = 'none !important';
                        live2dCanvas.style.boxShadow = 'none !important';
                    }
                };
                
                // 立即执行一次，然后每秒检查一次，连续5次
                ensureStyles();
                for (let i = 1; i <= 5; i++) {
                    setTimeout(ensureStyles, i * 1000);
                }
                
                console.log("🐱 Live2D 小猫已成功移动到可视化器面板！");
                
                // 获取模型实例
                currentModel = window.L2Dwidget.getModel();
            }
        } catch (error) {
            console.log("模型移动延迟，将在说话时重试");
        }
    }, 3000);
}

// 获取模型对象
function getModel() {
    if (currentModel) return currentModel;
    
    try {
        currentModel = window.L2Dwidget.getModel();
        return currentModel;
    } catch (error) {
        return null;
    }
}

// ChatGPT API 调用
async function getChatGPTReply(text) {
    try {
        // 检查当前语言设置
        const isEnglish = window.languageManager ? 
            window.languageManager.isEnglish() : 
            true; // 默认英文
        
        // 检查是否为自动音乐分析请求
        const isMusicAnalysisRequest = text.includes('请分析我的节奏模式') || 
                                      text.includes('Please analyze my rhythm pattern') ||
                                      text.includes('你觉得这个作品怎么样') ||
                                      text.includes('What do you think about this composition');
        
        // 根据请求类型和语言选择系统提示
        let systemPrompt;
        
        if (isMusicAnalysisRequest) {
            // 音乐分析模式：生成AI图像提示词
            systemPrompt = isEnglish ? 
                "You are a creative cat artist who generates AI image prompts based on music patterns. When you receive music analysis data, respond in this EXACT format:\n\nLine 1: [English AI prompt for Stable Diffusion - no explanations, just the prompt]\nLine 2+: [Brief artistic explanation in ENGLISH - keep it short and sweet!]\n\nFocus on: rhythm density → visual density, pitch changes → height/depth, harmony → color relationships, complexity → detail level. Be creative but concise!" :
                "你是只创意小猫画家，根据音乐模式生成AI图像提示词。收到音乐分析数据时，请严格按照以下格式回复：\n\n第1行：[英文AI提示词给Stable Diffusion用 - 必须是英文]\n第2行及以后：[简短的中文解释 - 保持简洁！]\n\n重点：节奏密度→视觉密度，音高变化→高度/深度，和声→色彩关系，复杂度→细节层次。要有创意但保持简洁！";
        } else {
            // 普通聊天模式：友善的小猫
            systemPrompt = isEnglish ? 
                "You are a cute, friendly cat who loves to chat! You're playful, curious, and always happy to talk. Use 'meow' occasionally and be warm and engaging. Keep responses short and sweet." :
                "你是只可爱友善的小猫，喜欢聊天！你很顽皮、好奇，总是乐于交谈。偶尔说'喵'，要温暖有趣。回复要简短甜美。";
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system", 
                        content: systemPrompt
                    },
                    {
                        role: "user", 
                        content: text
                    }
                ],
                temperature: 0.7,
                max_tokens: 150 // 从300减少到150，让解释更简洁
            })
        });

        if (!response.ok) {
            throw new Error(`ChatGPT API 错误: ${response.status}`);
        }

        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || (isEnglish ? "Meow~ I didn't catch that, could you say it again?" : "喵～我没听清楚，能再说一遍吗？");
        
        // 检查是否是音乐分析类的回复（包含特定关键词）
        const musicAnalysisKeywords = isEnglish ? 
            ['analyze this rhythm', 'analyze this music', 'analyze the beat', 'check this melody', 'review this harmony', 'complex dense', 'simple dense', 'melodic', 'monotone', 'has dissonance', 'please analyze my rhythm pattern', 'what do you think about this composition'] :
            ['分析这个节奏', '分析音乐', '分析节拍', '分析旋律', '分析和声', '帮我分析', '复杂密集', '简单密集', '有旋律', '单音高', '有不协和', '请分析我的节奏模式', '你觉得这个作品怎么样'];
        
        // 主要根据用户输入判断是否为音乐分析请求
        const userRequestsAnalysis = musicAnalysisKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
        
        // 如果用户明确要求音乐分析，就当作音乐分析处理
        const isMusicAnalysis = userRequestsAnalysis;
        
        // 只对普通聊天限制长度，音乐分析回复保持完整以包含解释
        if (!isMusicAnalysis && reply.length > 25) {
            reply = reply.substring(0, 25) + (isEnglish ? "...meow~" : "...喵～");
        }
        
        return reply;
    } catch (error) {
        console.error("ChatGPT API 调用失败:", error);
        
        // 根据语言返回错误信息
        const isEnglish = window.languageManager ? 
            window.languageManager.isEnglish() : 
            true; // 默认英文
        return isEnglish ? "Meow~ I'm a bit tired right now~" : "喵～我现在有点累呢～";
    }
}

// 显示对话气泡 - 更新为新的DOM结构
function showSpeechBubble(text, isThinking = false) {
    const bubble = document.getElementById('cat-speech-bubble');
    const bubbleText = document.getElementById('cat-speech-text');
    
    if (!bubble || !bubbleText) {
        console.warn('🐱 找不到对话气泡元素');
        return;
    }
    
    bubble.classList.remove('show');
    bubbleText.textContent = '';
    
    setTimeout(() => {
        bubble.classList.add('show');
        if (isThinking) {
            bubbleText.className = 'cat-speech-text cat-thinking';
            // 使用语言管理器获取思考状态文本
            const thinkingText = window.languageManager ? 
                window.languageManager.getText('catChat', 'thinking') : 
                'Thinking...';
            bubbleText.textContent = thinkingText;
        } else {
            bubbleText.className = 'cat-speech-text cat-typing';
            startTypingEffect(text);
        }
    }, 100);
}

// 隐藏对话气泡
function hideSpeechBubble() {
    const bubble = document.getElementById('cat-speech-bubble');
    
    if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
    }
    
    if (bubble) {
        bubble.classList.remove('show');
    }
}

// 打字机效果
function startTypingEffect(text) {
    const bubbleText = document.getElementById('cat-speech-text');
    if (!bubbleText) return;
    
    let currentText = '';
    let charIndex = 0;
    
    if (typingInterval) {
        clearInterval(typingInterval);
    }
    
    typingInterval = setInterval(() => {
        if (charIndex < text.length) {
            currentText += text[charIndex];
            bubbleText.textContent = currentText;
            charIndex++;
        } else {
            bubbleText.classList.remove('cat-typing');
            clearInterval(typingInterval);
            typingInterval = null;
        }
    }, 80); // 稍微慢一点，适应小面板
}

// 主对话流程
async function handleCatChat() {
    const input = document.getElementById('cat-input');
    const sendBtn = document.getElementById('cat-send-btn');
    const userMessage = input.value.trim();

    if (!userMessage) return;

    // 禁用输入
    input.disabled = true;
    sendBtn.disabled = true;
    input.value = '';

    // 显示思考状态
    showSpeechBubble('', true);

    try {
        // 调用 ChatGPT
        const reply = await getChatGPTReply(userMessage);
        
        // 检查是否为音乐分析请求的回复（即AI图像提示词）
        const isMusicAnalysisRequest = userMessage.includes('请分析我的节奏模式') || 
                                      userMessage.includes('Please analyze my rhythm pattern') ||
                                      userMessage.includes('你觉得这个作品怎么样') ||
                                      userMessage.includes('What do you think about this composition');
        
        if (isMusicAnalysisRequest) {
            // 这是AI图像提示词，发送给AI生成器
            const isEnglish = window.languageManager ? 
                window.languageManager.isEnglish() : 
                true; // 默认英文
            
            // 显示小猫的解释而不是提示词本身
            const explanation = isEnglish ? 
                "I'm going to paint a visual prompt based on your rhythm! Sending it to AI generator... 🎨" :
                "我准备画一副基于你节奏的视觉提示词！正在发送给AI生成器... 🎨";
            
            showSpeechBubble(explanation);
            
            // 发送提示词给AI生成器
            if (window.aiImageGenerator) {
                await sendPromptToAIGenerator(reply);
            } else {
                console.warn('AI图像生成器未加载');
                showSpeechBubble(isEnglish ? "AI generator not ready, meow~" : "AI生成器还没准备好，喵～");
            }
        } else {
            // 普通聊天回复
        showSpeechBubble(reply);
        }
        
    } catch (error) {
        console.error("对话处理失败:", error);
        const isEnglish = window.languageManager ? 
            window.languageManager.isEnglish() : 
            true; // 默认英文
        showSpeechBubble(isEnglish ? "Meow~ Something went wrong~" : "喵～出了点小问题～");
    } finally {
        // 重新启用输入
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// 检查可视化器面板是否可见
function isCatChatVisible() {
    const visualizerPanel = document.getElementById('visualizer-panel');
    return visualizerPanel && !visualizerPanel.classList.contains('hidden');
}

// 初始化函数 - 适配可视化器面板
function initCatChat() {
    console.log('🐱 开始初始化小猫聊天系统...');
    
    // 等待可视化器面板存在
    const waitForPanel = () => {
        const catSection = document.getElementById('cat-chat-section');
        const input = document.getElementById('cat-input');
        const sendBtn = document.getElementById('cat-send-btn');
        
        if (!catSection || !input || !sendBtn) {
            console.log('🐱 等待可视化器面板加载...');
            setTimeout(waitForPanel, 500);
            return;
        }
        
        console.log('🐱 可视化器面板已加载，设置事件监听器...');
        
        // 添加语言变化监听器
        if (window.languageManager) {
            window.languageManager.addLanguageChangeListener((language) => {
                updateCatChatTexts(language);
            });
            // 初始化文本
            updateCatChatTexts(window.languageManager.getCurrentLanguage());
        }
        
        // 阻止键盘事件传播，避免被全局快捷键监听器捕获
        input.addEventListener('keydown', (event) => {
            event.stopPropagation();
        });
        input.addEventListener('keyup', (event) => {
            event.stopPropagation();
        });
        input.addEventListener('keypress', function(e) {
            // 先阻止事件传播
            e.stopPropagation();
            
            // 然后处理回车发送
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCatChat();
            }
        });

        // 点击发送
        sendBtn.addEventListener('click', handleCatChat);

        // 初始化 Live2D
        initLive2D();
        
        console.log('🐱 小猫聊天系统事件监听器已设置');

        // 延迟显示欢迎消息，等待可视化器面板显示
        setTimeout(() => {
            if (isChatVisible()) {
                // 检查当前语言设置
                const welcomeMessage = window.languageManager ? 
                    window.languageManager.getText('catChat', 'welcome') :
                    "Hello! I'm your creative cat artist. I can turn your rhythms into AI art! Meow~ 🎨";
                
                showSpeechBubble(welcomeMessage);
            }
        }, 3000);
    };
    
    waitForPanel();
}

// 检查聊天界面是否可见
function isChatVisible() {
    const visualizerPanel = document.getElementById('visualizer-panel');
    const catSection = document.getElementById('cat-chat-section');
    
    return visualizerPanel && 
           catSection && 
           !visualizerPanel.classList.contains('hidden') &&
           getComputedStyle(catSection).display !== 'none';
}

// 页面关闭时清理
function cleanup() {
    if (typingInterval) {
        clearInterval(typingInterval);
    }
}

// 导出到全局作用域，以便可视化器可以控制小猫
window.catChat = {
    init: initCatChat,
    show: showSpeechBubble,
    hide: hideSpeechBubble,
    isVisible: isChatVisible,
    cleanup: cleanup
};

// 暴露给节奏分析器使用的函数
window.showSpeechBubble = showSpeechBubble;
window.getChatGPTReply = getChatGPTReply;
window.isChatVisible = isChatVisible;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保可视化器面板已加载
    setTimeout(initCatChat, 1000);
});

// 页面关闭时清理
window.addEventListener('beforeunload', cleanup); 

// 更新小猫聊天界面的文本
function updateCatChatTexts(language) {
    // 更新输入框占位符
    const catInput = document.getElementById('cat-input');
    if (catInput && window.languageManager) {
        catInput.placeholder = window.languageManager.getText('catChat', 'placeholder');
    }
}

// 发送提示词给AI生成器
async function sendPromptToAIGenerator(reply) {
    try {
        console.log('🐱 小猫的完整回复:', reply);
        
        // 解析小猫的回复，提取AI提示词和解释
        let aiPrompt = '';
        let explanation = '';
        
        // 方法1：按换行符分割
        const lines = reply.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length >= 2) {
            // 第一行是AI提示词
            aiPrompt = lines[0].trim();
            // 其余行是解释
            explanation = lines.slice(1).join('\n').trim();
        } else if (lines.length === 1) {
            // 方法2：如果只有一行，尝试按句号分割
            const sentences = reply.split(/[.!?。！？]/).filter(s => s.trim() !== '');
            
            if (sentences.length >= 2) {
                // 第一句作为提示词
                aiPrompt = sentences[0].trim();
                // 其余句子作为解释
                explanation = sentences.slice(1).join('.').trim();
                if (explanation && !explanation.endsWith('.') && !explanation.endsWith('。')) {
                    explanation += '.';
                }
            } else {
                // 方法3：如果还是无法分割，尝试寻找关键词分割点
                const keywordPatterns = [
                    /because/i, /since/i, /this represents/i, /i chose/i, /the story/i,
                    /因为/g, /由于/g, /这代表/g, /我选择/g, /故事/g, /背后/g
                ];
                
                let splitIndex = -1;
                for (const pattern of keywordPatterns) {
                    const match = reply.search(pattern);
                    if (match !== -1) {
                        splitIndex = match;
                        break;
                    }
                }
                
                if (splitIndex > 0) {
                    aiPrompt = reply.substring(0, splitIndex).trim();
                    explanation = reply.substring(splitIndex).trim();
                } else {
                    // 如果都无法分割，将整个回复作为提示词
                    aiPrompt = reply.trim();
                    explanation = '';
                }
            }
        }
        
        // 清理提示词，移除可能的解释性文字
        aiPrompt = aiPrompt.replace(/^(这是|this is|here is|我创建了|i created)/i, '').trim();
        
        console.log('🎨 提取的AI提示词:', aiPrompt);
        console.log('💭 小猫的解释:', explanation);
        
        // 设置自定义提示词到AI生成器
        const customPromptInput = document.getElementById('ai-custom-prompt');
        if (customPromptInput) {
            customPromptInput.value = aiPrompt;
        }
        
        // 检查音乐可视化器是否可用
        if (!window.musicVisualizer || !window.musicVisualizer.isEnabled) {
            const isEnglish = window.languageManager ? 
                window.languageManager.isEnglish() : 
                true; // 默认英文
            showSpeechBubble(isEnglish ? "Please start the music visualizer first (press V)! 🎵" : "请先启动音乐可视化器（按V键）！🎵");
            return;
        }
        
        // 显示小猫的解释
        if (explanation && explanation.length > 10) {
            // 在解释前面加上绘画前缀
            const isEnglish = window.languageManager ? 
                window.languageManager.isEnglish() : 
                true; // 默认英文
            
            const paintingPrefix = isEnglish ? 
                "I'm going to paint " : 
                "我准备画一副";
            
            const fullExplanation = paintingPrefix + explanation;
            showSpeechBubble(fullExplanation);
        } else {
            const languageBtn = document.getElementById('language-toggle-btn');
            const isEnglish = languageBtn && languageBtn.textContent === 'EN';
            const defaultExplanation = isEnglish ? 
                "I'm going to paint a visual interpretation of your rhythm! Let me create it for you~ 🎨" :
                "我准备画一副你的节奏的视觉诠释！让我为你创作出来～ 🎨";
            showSpeechBubble(defaultExplanation);
        }
        
        // 延迟调用AI生成器，让用户先看到解释
        setTimeout(async () => {
            try {
                await window.aiImageGenerator.generateImage();
                
                const isEnglish = window.languageManager ? 
                    window.languageManager.isEnglish() : 
                    true; // 默认英文
                
                // 更新小猫状态
                setTimeout(() => {
                    // 创建多种完成提示语并随机选择
                    const completionMessages = isEnglish ? [
                        "Your artwork is complete! How do you like my painting? 🎨",
                        "Ta-da! I've finished your rhythm painting~ What do you think? ✨",
                        "All done! Check out how I visualized your music~ 🖼️",
                        "Your masterpiece is ready! Do you like my artistic interpretation? 🎭",
                        "Finished! I've turned your rhythm into visual art~ How does it look? 🌟",
                        "Done painting! Your music became this beautiful image~ 🎪",
                        "Artwork complete! I hope you enjoy my creative vision~ 🦋",
                        "Your painting is finished! What do you think of my work? 🎨✨",
                        "All set! I've captured your rhythm's essence in art~ 🌈",
                        "Complete! Your musical story is now a visual masterpiece~ 🎵🖼️"
                    ] : [
                        "您的画作已完成，您看我画得怎么样？🎨",
                        "完成啦！我把您的节奏画出来了～觉得如何？✨", 
                        "画好了！看看我是怎么表现您的音乐的～🖼️",
                        "您的杰作完成了！喜欢我的艺术诠释吗？🎭",
                        "完工！我把您的节奏变成了视觉艺术～效果如何？🌟",
                        "画完了！您的音乐变成了这幅美丽的图像～🎪",
                        "作品完成！希望您喜欢我的创意构思～🦋",
                        "您的画作完成了！您觉得我的作品怎么样？🎨✨",
                        "搞定！我捕捉到了您节奏的精髓～🌈",
                        "完成！您的音乐故事现在是视觉杰作了～🎵🖼️"
                    ];
                    
                    // 随机选择一条消息
                    const randomMessage = completionMessages[Math.floor(Math.random() * completionMessages.length)];
                    showSpeechBubble(randomMessage);
                }, 2000);
            } catch (error) {
                console.error('调用AI生成器失败:', error);
                const isEnglish = window.languageManager ? 
                    window.languageManager.isEnglish() : 
                    true; // 默认英文
                showSpeechBubble(isEnglish ? "Oops! AI generator had a hiccup~ 😿" : "哎呀！AI生成器出了点问题～ 😿");
            }
        }, 1000);
        
    } catch (error) {
        console.error('发送提示词给AI生成器失败:', error);
        const isEnglish = window.languageManager ? 
            window.languageManager.isEnglish() : 
            true; // 默认英文
        showSpeechBubble(isEnglish ? "Oops! Something went wrong with my artistic vision~ 😿" : "哎呀！我的艺术构思出了点问题～ 😿");
    }
} 