/**
 * NetworkState.js - 共享网络状态
 * 存储所有Colyseus连接相关的共享变量，供各模块引用
 */

// 全局调试开关，默认关闭
window.debugColyseus = false;

// 添加一个全局变量，用于追踪在总览模式中是否存在拖拽操作
window.isDraggingInOverview = false;

// Colyseus连接相关变量
export let colyseusClient = null;
export let colyseusRoom = null;
export let colyseusConnected = false;
export let colyseusRoomName = "rhythm_room";
export let colyseusServerUrl = "wss://liujiaye.cn:2567";
export let sessionId = null;
export let dialogVisible = false;
export let isConnecting = false;
export let connectionRetryCount = 0;
export let connectionSuccessful = false;

// 定义节奏数据同步的计数器，用于检测变更
export let syncCounter = 0;
export let lastSyncedStates = Array(8).fill(null);

// 插槽选择相关变量
export const colyseusSlotStates = {
  data: {
    slots: {},
    slotNames: {},
    presets: [],
    synthParams: [],
    bpm: 120
  },
  mySlot: -1,
  username: "用户" + Math.floor(Math.random() * 1000),
  currentSessionId: null
};

// 弹窗UI相关
export let colyseusDialogVisible = false;

// 最大重试次数
export let maxConnectionRetries = 3;

// ---- setter 函数，用于从其他模块修改状态 ----

export function setColyseusClient(val) { colyseusClient = val; }
export function setColyseusRoom(val) { colyseusRoom = val; }
export function setColyseusConnected(val) { colyseusConnected = val; }
export function setColyseusRoomName(val) { colyseusRoomName = val; }
export function setColyseusServerUrl(val) { colyseusServerUrl = val; }
export function setSessionId(val) { sessionId = val; }
export function setDialogVisible(val) { dialogVisible = val; }
export function setIsConnecting(val) { isConnecting = val; }
export function setConnectionRetryCount(val) { connectionRetryCount = val; }
export function setConnectionSuccessful(val) { connectionSuccessful = val; }
export function setSyncCounter(val) { syncCounter = val; }
export function setColyseusDialogVisible(val) { colyseusDialogVisible = val; }
