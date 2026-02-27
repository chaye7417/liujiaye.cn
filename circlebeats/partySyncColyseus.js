/**
 * partySyncColyseus.js - 使用Colyseus进行多用户协作的联网模式
 * 该脚本负责处理与Colyseus服务器的连接、数据同步和用户插槽管理
 *
 * 重构说明：实际逻辑已拆分到 src/network/ 目录下的各模块文件中：
 *   - NetworkState.js  - 共享状态变量
 *   - NetworkUtils.js  - 工具函数（throttle等）
 *   - ColyseusClient.js - 连接管理（connect/disconnect/reconnect/心跳）
 *   - SlotSync.js      - 插槽管理（claim/release/状态同步）
 *   - ParamsSync.js    - 参数同步（合成器参数/BPM/pattern/八度信息）
 *   - ColyseusUI.js    - UI弹窗（连接状态/房间信息/用户列表）
 *   - index.js         - 桶文件（汇总导出并挂载到window）
 *
 * 此文件仅作为入口，通过动态 import 加载模块化代码。
 */

import('./src/network/index.js').catch(err => {
  console.error('加载网络模块失败:', err);
});
