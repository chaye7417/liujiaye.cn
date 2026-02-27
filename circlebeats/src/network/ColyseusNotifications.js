/**
 * ColyseusNotifications.js - 通知与状态指示器
 * 包含通知弹窗、连接进度条、连接状态显示、错误提示
 */

import {
  colyseusConnected, colyseusRoomName, colyseusServerUrl,
  colyseusSlotStates, sessionId, connectionSuccessful,
  connectionRetryCount, maxConnectionRetries,
  setConnectionRetryCount
} from './NetworkState.js';

// ---- 通知系统 ----

/**
 * 显示通知
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型: "normal" | "error" | "success"
 */
export function showNotification(message, type = "normal") {
  const existingNotifications = document.querySelectorAll('.colyseus-notification');
  let notificationExists = false;

  for (let i = 0; i < existingNotifications.length; i++) {
    if (existingNotifications[i].textContent === message) {
      const notification = existingNotifications[i];
      const timerId = notification.getAttribute('data-timer-id');
      if (timerId) clearTimeout(parseInt(timerId));
      const newTimerId = setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(30px)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
            repositionNotifications();
          }
        }, 300);
      }, 3000);
      notification.setAttribute('data-timer-id', newTimerId.toString());
      notificationExists = true;
      break;
    }
  }

  if (!notificationExists) {
    const notificationCount = existingNotifications.length;
    const notification = document.createElement('div');
    notification.className = 'colyseus-notification';
    Object.assign(notification.style, {
      position: 'fixed', top: `${20 + notificationCount * 60}px`, right: '20px',
      padding: '10px 15px', borderRadius: '4px', color: '#fff', zIndex: '10000',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)', transition: 'all 0.3s ease-in-out',
      minWidth: '200px', maxWidth: '300px', wordWrap: 'break-word', fontSize: '13px'
    });
    if (type === "error") notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
    else if (type === "success") notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
    else notification.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
    notification.textContent = message;

    const timerId = setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(30px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
          repositionNotifications();
        }
      }, 300);
    }, 3000);
    notification.setAttribute('data-timer-id', timerId.toString());
    document.body.appendChild(notification);
  }
}

function repositionNotifications() {
  const notifications = document.querySelectorAll('.colyseus-notification');
  notifications.forEach((note, index) => {
    note.style.top = `${20 + index * 60}px`;
  });
}

/**
 * 自定义消息提示函数，替代alert
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型: 'info' | 'error' | 'warning'
 */
export function showCustomMessage(message, type = 'info') {
  let messageBox = document.getElementById('colyseus-custom-message');
  if (messageBox) document.body.removeChild(messageBox);

  messageBox = document.createElement('div');
  messageBox.id = 'colyseus-custom-message';
  Object.assign(messageBox.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    padding: '20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    zIndex: '10001', minWidth: '300px', maxWidth: '80%', textAlign: 'center',
    fontFamily: 'Arial, sans-serif', transition: 'opacity 0.3s'
  });
  if (type === 'error') { messageBox.style.backgroundColor = 'rgba(220, 53, 69, 0.95)'; messageBox.style.color = 'white'; }
  else if (type === 'warning') { messageBox.style.backgroundColor = 'rgba(255, 193, 7, 0.95)'; messageBox.style.color = 'black'; }
  else { messageBox.style.backgroundColor = 'rgba(40, 40, 40, 0.95)'; messageBox.style.color = 'white'; }

  const messageText = document.createElement('div');
  messageText.innerHTML = message;
  messageText.style.marginBottom = '15px';
  messageBox.appendChild(messageText);

  const closeButton = document.createElement('button');
  Object.assign(closeButton.style, {
    padding: '8px 20px', backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer'
  });
  closeButton.textContent = '确定';
  closeButton.onclick = () => {
    messageBox.style.opacity = '0';
    setTimeout(() => { if (messageBox.parentNode) messageBox.parentNode.removeChild(messageBox); }, 300);
  };
  messageBox.appendChild(closeButton);
  document.body.appendChild(messageBox);

  setTimeout(() => {
    if (messageBox.parentNode) {
      messageBox.style.opacity = '0';
      setTimeout(() => { if (messageBox.parentNode) messageBox.parentNode.removeChild(messageBox); }, 300);
    }
  }, 5000);
}

// ---- 连接进度条 ----

/**
 * 显示连接进度条
 */
export function showConnectionProgress() {
  let progressContainer = document.getElementById('colyseus-progress-container');
  if (progressContainer) { progressContainer.style.display = 'flex'; return; }

  progressContainer = document.createElement('div');
  progressContainer.id = 'colyseus-progress-container';
  Object.assign(progressContainer.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', flexDirection: 'column', zIndex: '10000'
  });

  const progressBox = document.createElement('div');
  Object.assign(progressBox.style, {
    backgroundColor: 'rgba(40, 40, 40, 0.97)', padding: '30px',
    borderRadius: '12px', textAlign: 'center', color: '#fff', width: '400px'
  });

  const progressTitle = document.createElement('h3');
  progressTitle.id = 'colyseus-progress-title';
  progressTitle.textContent = '正在连接到服务器...';
  progressTitle.style.marginBottom = '20px';

  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, { width: '100%', height: '10px', backgroundColor: '#333', borderRadius: '5px', overflow: 'hidden' });
  const progressIndicator = document.createElement('div');
  progressIndicator.id = 'colyseus-progress-indicator';
  Object.assign(progressIndicator.style, { width: '0%', height: '100%', backgroundColor: '#4CAF50', transition: 'width 0.2s' });

  const serverInfoDiv = document.createElement('div');
  Object.assign(serverInfoDiv.style, { marginTop: '10px', fontSize: '12px', color: '#ccc' });
  serverInfoDiv.innerHTML = `<div>服务器: <span style="color:#fff">${colyseusServerUrl}</span></div>
    <div>房间: <span style="color:#fff">${colyseusRoomName}</span></div>
    <div>用户名: <span style="color:#fff">${colyseusSlotStates.username}</span></div>`;

  const debugInfo = document.createElement('div');
  debugInfo.id = 'colyseus-debug-info';
  Object.assign(debugInfo.style, {
    marginTop: '15px', fontSize: '12px', color: '#aaa', width: '100%',
    wordWrap: 'break-word', textAlign: 'left', height: '120px', overflow: 'auto',
    backgroundColor: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '4px'
  });
  debugInfo.innerHTML = '<div>正在初始化连接...</div>';

  const retryButton = document.createElement('button');
  retryButton.id = 'colyseus-retry-button';
  retryButton.textContent = '重试连接';
  Object.assign(retryButton.style, {
    marginTop: '20px', padding: '8px 20px', backgroundColor: '#3f51b5',
    color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'none'
  });
  retryButton.addEventListener('click', () => {
    hideConnectionProgress(true);
    setTimeout(() => { if (window.connectToColyseus) window.connectToColyseus(); }, 500);
  });

  const cancelButton = document.createElement('button');
  cancelButton.id = 'colyseus-cancel-button';
  cancelButton.textContent = '取消';
  Object.assign(cancelButton.style, {
    marginTop: '10px', padding: '6px 15px', backgroundColor: 'transparent',
    color: '#ccc', border: '1px solid #666', borderRadius: '4px', cursor: 'pointer'
  });
  cancelButton.addEventListener('click', () => hideConnectionProgress(true));

  progressBar.appendChild(progressIndicator);
  progressBox.appendChild(progressTitle);
  progressBox.appendChild(progressBar);
  progressBox.appendChild(serverInfoDiv);
  progressBox.appendChild(debugInfo);
  progressBox.appendChild(retryButton);
  progressBox.appendChild(cancelButton);
  progressContainer.appendChild(progressBox);
  document.body.appendChild(progressContainer);

  // 模拟进度增长
  let progress = 0;
  let lastPhase = '';
  const progressInterval = setInterval(() => {
    progress += 5;
    if (progress > 90) clearInterval(progressInterval);
    const indicator = document.getElementById('colyseus-progress-indicator');
    if (indicator) indicator.style.width = `${progress}%`;
    const di = document.getElementById('colyseus-debug-info');
    if (di) {
      let phase = progress < 30 ? '初始化WebSocket连接...' :
                  progress < 60 ? '等待服务器响应...' :
                  progress < 85 ? '等待欢迎消息...' : '准备完成连接...';
      if (phase !== lastPhase) { di.innerHTML += `<div>${phase}</div>`; lastPhase = phase; di.scrollTop = di.scrollHeight; }
    }
  }, 400);
  progressContainer.dataset.intervalId = progressInterval;

  setTimeout(() => {
    const retryBtn = document.getElementById('colyseus-retry-button');
    if (retryBtn && !colyseusConnected) {
      const di = document.getElementById('colyseus-debug-info');
      if (di) { di.innerHTML += '<div style="color:orange">连接似乎需要较长时间，您可以尝试重试...</div>'; di.scrollTop = di.scrollHeight; }
      retryBtn.style.display = 'inline-block';
    }
  }, 10000);
}

/**
 * 隐藏连接进度条
 * @param {boolean} force - 是否强制隐藏
 */
export function hideConnectionProgress(force = false) {
  if (window.colyseusProgressTimeout) { clearTimeout(window.colyseusProgressTimeout); window.colyseusProgressTimeout = null; }
  const pc = document.getElementById('colyseus-progress-container');
  if (pc) {
    if (pc.dataset.intervalId) { clearInterval(parseInt(pc.dataset.intervalId)); pc.dataset.intervalId = null; }
    const pi = document.getElementById('colyseus-progress-indicator');
    if (pi) pi.style.width = '100%';
    if (connectionSuccessful || force) {
      const di = document.getElementById('colyseus-debug-info');
      if (di) { di.innerHTML += '<div style="color:green">进度界面即将关闭...</div>'; di.scrollTop = di.scrollHeight; }
      setTimeout(() => { if (pc.parentNode) pc.parentNode.removeChild(pc); }, 500);
    }
  }
}

/**
 * 显示连接成功提示
 */
export function showConnectionSuccess() {
  if (document.getElementById('colyseus-success-container')) return;
  const pi = document.getElementById('colyseus-progress-indicator');
  if (pi) { pi.style.width = '100%'; pi.style.backgroundColor = '#4CAF50'; }
  const pt = document.getElementById('colyseus-progress-title');
  if (pt) { pt.textContent = '连接成功!'; pt.style.color = '#4CAF50'; }
  const di = document.getElementById('colyseus-debug-info');
  if (di) {
    di.innerHTML += '<div style="color:#4CAF50;font-weight:bold">✓ 连接成功!</div>';
    di.innerHTML += '<div>会话ID: ' + sessionId + '</div>';
    di.innerHTML += '<div>即将进入插槽选择...</div>';
    di.scrollTop = di.scrollHeight;
  }
  showNotification("已成功连接到节奏环协作服务器", "success");
  const retryBtn = document.getElementById('colyseus-retry-button');
  if (retryBtn) retryBtn.style.display = 'none';
  const cancelBtn = document.getElementById('colyseus-cancel-button');
  if (cancelBtn) { cancelBtn.textContent = '继续'; cancelBtn.style.backgroundColor = '#4CAF50'; cancelBtn.style.color = 'white'; cancelBtn.style.border = 'none'; }
}

/**
 * 显示连接失败错误
 * @param {string} errorMsg - 错误消息
 */
export function showConnectionError(errorMsg) {
  const pc = document.getElementById('colyseus-progress-container');
  if (pc) {
    const pt = document.getElementById('colyseus-progress-title');
    if (pt) { pt.textContent = '连接失败'; pt.style.color = '#F44336'; }
    const pi = document.getElementById('colyseus-progress-indicator');
    if (pi) { pi.style.width = '100%'; pi.style.backgroundColor = '#F44336'; }
    const di = document.getElementById('colyseus-debug-info');
    if (di) { di.innerHTML += `<div style="color:#F44336;font-weight:bold">✗ 连接失败: ${errorMsg || '未知错误'}</div>`; di.scrollTop = di.scrollHeight; }
    const retryBtn = document.getElementById('colyseus-retry-button');
    if (retryBtn) { retryBtn.style.display = 'inline-block'; retryBtn.style.backgroundColor = '#F44336'; retryBtn.style.color = 'white'; }
    const cancelBtn = document.getElementById('colyseus-cancel-button');
    if (cancelBtn) { cancelBtn.textContent = '关闭'; cancelBtn.style.backgroundColor = '#666'; cancelBtn.style.color = 'white'; cancelBtn.style.border = 'none'; }
    return;
  }
  // 备用错误容器
  _showFallbackError(errorMsg);
}

function _showFallbackError(errorMsg) {
  let ec = document.getElementById('colyseus-error-container');
  if (ec) { ec.style.display = 'flex'; return; }
  ec = document.createElement('div');
  ec.id = 'colyseus-error-container';
  Object.assign(ec.style, {
    position: 'fixed', top: '20px', right: '20px', backgroundColor: 'rgba(244, 67, 54, 0.9)',
    color: '#fff', padding: '15px 20px', borderRadius: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    zIndex: '9999', display: 'flex', flexDirection: 'column', transition: 'opacity 0.5s'
  });
  const msg = document.createElement('div');
  msg.innerHTML = `<strong>连接失败</strong><br/>${errorMsg || '服务器连接出错'}`;
  msg.style.marginBottom = '10px';
  const retryBtn = document.createElement('button');
  retryBtn.textContent = '重试连接';
  Object.assign(retryBtn.style, { padding: '5px 10px', backgroundColor: '#fff', color: '#F44336', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'center' });
  retryBtn.onclick = () => {
    if (ec.parentNode) ec.parentNode.removeChild(ec);
    if (connectionRetryCount < maxConnectionRetries) {
      setConnectionRetryCount(connectionRetryCount + 1);
      if (window.connectToColyseus) window.connectToColyseus();
    } else {
      showCustomMessage(`已达到最大重试次数(${maxConnectionRetries})，请稍后再试或检查服务器状态。`, "error");
      setConnectionRetryCount(0);
    }
  };
  ec.appendChild(msg);
  ec.appendChild(retryBtn);
  document.body.appendChild(ec);
  setTimeout(() => {
    if (ec.parentNode) { ec.style.opacity = '0'; setTimeout(() => { if (ec.parentNode) ec.parentNode.removeChild(ec); }, 500); }
  }, 7000);
}

// ---- 连接状态指示器 ----

export function createConnectionStatus() {
  let se = document.getElementById('colyseus-connection-status');
  if (se) return se;
  se = document.createElement('div');
  se.id = 'colyseus-connection-status';
  Object.assign(se.style, {
    position: 'fixed', bottom: '10px', right: '10px', padding: '5px 10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', color: '#fff', fontSize: '12px',
    borderRadius: '4px', zIndex: '9998'
  });
  se.textContent = '未连接';
  document.body.appendChild(se);
  return se;
}

export function updateConnectionStatus(status, details = '') {
  const se = createConnectionStatus();
  if (status === 'connecting') { se.textContent = '正在连接...'; se.style.backgroundColor = 'rgba(255, 152, 0, 0.7)'; }
  else if (status === 'connected') { se.textContent = `已连接 ${details ? '(' + details + ')' : ''}`; se.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; }
  else if (status === 'disconnected') { se.textContent = '未连接'; se.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; }
  else if (status === 'error') { se.textContent = `连接错误 ${details ? '(' + details + ')' : ''}`; se.style.backgroundColor = 'rgba(244, 67, 54, 0.7)'; }
}

export function showUserJoinedNotification(userSessionId) {
  const n = document.createElement('div');
  Object.assign(n.style, {
    position: 'fixed', bottom: '40px', right: '10px', padding: '5px 10px',
    backgroundColor: 'rgba(76, 175, 80, 0.7)', color: '#fff', fontSize: '12px',
    borderRadius: '4px', zIndex: '9997', opacity: '1', transition: 'opacity 0.5s'
  });
  n.textContent = '新用户加入房间';
  document.body.appendChild(n);
  setTimeout(() => { n.style.opacity = '0'; setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 500); }, 2000);
}

export function updateRoomNameDisplay(roomName, connectedClients) {
  if (!roomName) return;
  const rn = document.getElementById('colyseus-room-name-display');
  if (rn) rn.textContent = `当前房间: ${roomName} (${connectedClients}人在线)`;
  const se = document.getElementById('colyseus-connection-status');
  if (se) se.textContent = `已连接 (${connectedClients}人在线)`;
}
