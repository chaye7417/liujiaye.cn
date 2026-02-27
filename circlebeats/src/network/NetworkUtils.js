/**
 * NetworkUtils.js - 网络工具函数
 * 包含节流(throttle)、防抖等通用工具函数
 */

/**
 * 通用节流函数：确保高频调用（如拖拽ADSR/滤波器）不会在每次mousemove时都发送WebSocket消息
 * 在delay时间内最多执行一次，且保证最后一次调用一定会被执行（trailing call）
 *
 * @param {Function} fn - 要节流的函数
 * @param {number} delay - 节流延迟时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  let timer = null;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn.apply(this, args);
      }, delay - (now - lastCall));
    }
  };
}
