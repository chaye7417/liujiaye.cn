/**
 * ColyseusDialogs.js - 对话框组件
 * 包含插槽选择对话框和连接设置对话框
 */

import {
  colyseusConnected, colyseusRoom, colyseusRoomName,
  colyseusSlotStates, sessionId,
  colyseusDialogVisible,
  setColyseusDialogVisible, setColyseusRoomName
} from './NetworkState.js';
import { showNotification, showCustomMessage } from './ColyseusNotifications.js';

// ---- 插槽选择对话框 ----

/**
 * 弹窗UI入口：点击联网协作按钮后弹出
 */
export function showColyseusDialog() {
  if (colyseusDialogVisible) return;
  setColyseusDialogVisible(true);

  const existingDialog = document.getElementById('colyseus-slot-dialog');
  if (existingDialog && existingDialog.parentNode) {
    existingDialog.parentNode.removeChild(existingDialog);
  }

  if (colyseusConnected && colyseusRoom) {
    showNotification("正在获取最新房间信息...", "normal");
    colyseusRoom.send("requestRoomState", { timestamp: Date.now() });
    setTimeout(() => { _createSlotDialog(); }, 300);
  } else {
    _createSlotDialog();
  }
}

/**
 * 关闭插槽选择弹窗
 */
export function closeColyseusDialog() {
  setColyseusDialogVisible(false);
  const dialog = document.getElementById('colyseus-slot-dialog');
  if (dialog) dialog.style.display = 'none';
}

function _createSlotDialog() {
  let dialog = document.getElementById('colyseus-slot-dialog');
  if (dialog) { dialog.style.display = 'block'; return; }

  if (colyseusConnected && colyseusRoom &&
      (!colyseusSlotStates.data.slots || Object.keys(colyseusSlotStates.data.slots).length === 0)) {
    console.warn("插槽数据可能不完整，尝试再次请求...");
  }

  dialog = document.createElement('div');
  dialog.id = 'colyseus-slot-dialog';
  Object.assign(dialog.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(40, 40, 40, 0.97)', padding: '24px 20px 16px 20px',
    borderRadius: '12px', boxShadow: '0 0 32px rgba(0,0,0,0.5)', zIndex: '9999',
    minWidth: '340px', maxWidth: '90vw', color: '#fff', fontFamily: 'Arial, sans-serif'
  });

  // 房间名
  if (window.colyseusWelcomeRoomName) {
    const rn = document.createElement('div');
    rn.id = 'colyseus-room-name-display';
    rn.textContent = `当前房间: ${window.colyseusWelcomeRoomName}`;
    Object.assign(rn.style, { textAlign: 'center', marginBottom: '10px', color: '#fff' });
    dialog.appendChild(rn);
  }

  // 标题
  const title = document.createElement('h2');
  title.textContent = '选择一个插槽进行控制';
  title.style.textAlign = 'center';
  title.style.marginBottom = '12px';
  dialog.appendChild(title);

  // 用户信息
  const userInfo = document.createElement('div');
  userInfo.textContent = `会话ID: ${sessionId || ''} | 用户名: ${colyseusSlotStates.username}`;
  Object.assign(userInfo.style, { textAlign: 'center', fontSize: '13px', color: '#ccc', marginBottom: '10px' });
  dialog.appendChild(userInfo);

  // 说明文字
  const helpText = document.createElement('div');
  helpText.textContent = colyseusSlotStates.mySlot !== -1
    ? `你当前控制插槽 ${colyseusSlotStates.mySlot + 1}。点击其他插槽可以更换控制。`
    : "请选择一个插槽进行控制，或进入观看模式。";
  Object.assign(helpText.style, { textAlign: 'center', fontSize: '14px', color: '#eee', marginBottom: '16px' });
  dialog.appendChild(helpText);

  // 插槽按钮
  _buildSlotButtons(dialog);
  _buildActionButtons(dialog);

  document.body.appendChild(dialog);
}

function _buildSlotButtons(dialog) {
  const container = document.createElement('div');
  Object.assign(container.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '18px' });

  const colors = ['#FF5252','#FF9800','#FFEB3B','#4CAF50','#2196F3','#673AB7','#E91E63','#00BCD4'];
  for (let i = 0; i < 8; i++) {
    const isOccupied = colyseusSlotStates.data.slots[i] != null;
    const isMySlot = isOccupied && colyseusSlotStates.data.slots[i] === sessionId;
    const isControlled = colyseusSlotStates.mySlot === i;
    const slotUsername = colyseusSlotStates.data.slotNames[i] || '未知用户';
    const baseColor = colors[i];
    const slotColor = isControlled ? baseColor : (isOccupied && !isMySlot ? '#555' : '#333');
    const borderColor = isControlled ? baseColor : (isMySlot ? baseColor : 'transparent');

    const btn = document.createElement('div');
    Object.assign(btn.style, {
      padding: '12px 0', width: '95px', borderRadius: '8px',
      cursor: isOccupied && !isMySlot ? 'not-allowed' : 'pointer',
      background: slotColor, color: '#fff', fontWeight: isControlled ? 'bold' : 'normal',
      boxShadow: isControlled ? `0 0 10px ${baseColor}` : 'none',
      border: `2px solid ${borderColor}`, margin: '0 2px', fontSize: '16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', position: 'relative', transition: 'all 0.2s ease'
    });

    const num = document.createElement('div');
    num.textContent = `插槽 ${i + 1}`;
    num.style.fontWeight = 'bold';
    num.style.fontSize = '15px';
    btn.appendChild(num);

    const status = document.createElement('div');
    Object.assign(status.style, { fontSize: '12px', marginTop: '5px', color: '#eee' });
    if (isControlled) { status.textContent = '✓ 正在控制'; status.style.color = '#8fff8f'; }
    else if (isMySlot) { status.textContent = '可以恢复控制'; status.style.color = '#8fffff'; }
    else if (isOccupied) {
      status.textContent = '被占用'; status.style.color = '#ffaaaa';
      const tooltip = document.createElement('div');
      tooltip.textContent = slotUsername;
      Object.assign(tooltip.style, {
        position: 'absolute', bottom: '-25px', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.8)', padding: '3px 6px', borderRadius: '4px',
        fontSize: '11px', whiteSpace: 'nowrap', display: 'none', zIndex: '10000'
      });
      btn.appendChild(tooltip);
      btn.onmouseover = () => { tooltip.style.display = 'block'; };
      btn.onmouseout = () => { tooltip.style.display = 'none'; };
    } else { status.textContent = '可用'; status.style.color = '#aaaaaa'; }
    btn.appendChild(status);

    if (!isOccupied || isMySlot) {
      btn.onclick = () => {
        if (window.selectColyseusSlot) window.selectColyseusSlot(i);
        closeColyseusDialog();
      };
      btn.onmouseover = () => { btn.style.background = isControlled ? baseColor : '#444'; btn.style.boxShadow = `0 0 8px ${baseColor}`; };
      btn.onmouseout = () => { btn.style.background = slotColor; btn.style.boxShadow = isControlled ? `0 0 10px ${baseColor}` : 'none'; };
    }
    container.appendChild(btn);
  }
  dialog.appendChild(container);
}

function _buildActionButtons(dialog) {
  const isInViewMode = colyseusSlotStates.mySlot === -1;

  // 观看模式按钮
  const viewBtn = document.createElement('button');
  viewBtn.textContent = isInViewMode ? '✓ 当前为观看模式' : '进入观看模式 (不控制任何插槽)';
  Object.assign(viewBtn.style, {
    width: '100%', padding: '12px', marginBottom: '12px',
    background: isInViewMode ? '#8e24aa' : '#9C27B0', color: '#fff', border: 'none',
    borderRadius: '6px', cursor: 'pointer', fontWeight: isInViewMode ? 'bold' : 'normal',
    boxShadow: isInViewMode ? '0 0 8px #9C27B0' : 'none'
  });
  viewBtn.onmouseover = () => { viewBtn.style.background = '#aa2fbf'; viewBtn.style.boxShadow = '0 0 8px #9C27B0'; };
  viewBtn.onmouseout = () => { viewBtn.style.background = isInViewMode ? '#8e24aa' : '#9C27B0'; viewBtn.style.boxShadow = isInViewMode ? '0 0 8px #9C27B0' : 'none'; };
  viewBtn.onclick = () => { if (window.enterColyseusViewMode) window.enterColyseusViewMode(); closeColyseusDialog(); };
  dialog.appendChild(viewBtn);

  // 断开连接按钮
  const disconnectBtn = document.createElement('button');
  disconnectBtn.textContent = '断开连接';
  Object.assign(disconnectBtn.style, { width: '100%', padding: '10px', marginBottom: '10px', background: '#F44336', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' });
  disconnectBtn.onmouseover = () => { disconnectBtn.style.background = '#d32f2f'; };
  disconnectBtn.onmouseout = () => { disconnectBtn.style.background = '#F44336'; };
  disconnectBtn.onclick = () => { if (window.disconnectFromColyseus) window.disconnectFromColyseus(); closeColyseusDialog(); };
  dialog.appendChild(disconnectBtn);

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  Object.assign(closeBtn.style, { width: '100%', padding: '10px', background: '#555', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' });
  closeBtn.onmouseover = () => { closeBtn.style.background = '#666'; };
  closeBtn.onmouseout = () => { closeBtn.style.background = '#555'; };
  closeBtn.onclick = closeColyseusDialog;
  dialog.appendChild(closeBtn);
}

// ---- 连接设置对话框 ----

/**
 * 创建连接信息输入对话框
 */
export function createConnectionDialog() {
  let dialog = document.getElementById('colyseus-connection-dialog');
  if (dialog) { dialog.style.display = 'block'; return; }

  dialog = document.createElement('div');
  dialog.id = 'colyseus-connection-dialog';
  Object.assign(dialog.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(40, 40, 40, 0.97)', padding: '24px 20px 16px 20px',
    borderRadius: '12px', boxShadow: '0 0 32px rgba(0,0,0,0.5)', zIndex: '9999',
    minWidth: '340px', maxWidth: '90vw', color: '#fff', fontFamily: 'Arial, sans-serif'
  });

  const title = document.createElement('h2');
  title.textContent = '联网协作设置';
  Object.assign(title.style, { textAlign: 'center', marginBottom: '20px' });
  dialog.appendChild(title);

  const serverInfo = document.createElement('div');
  serverInfo.textContent = '选择一个预设房间名称或直接输入房间名称';
  Object.assign(serverInfo.style, { textAlign: 'center', fontSize: '12px', marginBottom: '15px', color: '#aaa' });
  dialog.appendChild(serverInfo);

  // 用户名
  _appendLabel(dialog, '用户名:');
  const usernameInput = _createInput('colyseus-username-input', colyseusSlotStates.username);
  usernameInput.style.marginBottom = '15px';
  dialog.appendChild(usernameInput);

  // 房间选择
  _appendLabel(dialog, '房间名称:');
  const roomSelect = _createRoomSelect();
  dialog.appendChild(roomSelect);

  const roomInput = _createInput('colyseus-room-input', colyseusRoomName, '请输入自定义房间名');
  roomInput.style.marginBottom = '20px';
  roomInput.style.display = 'none';
  dialog.appendChild(roomInput);

  roomSelect.addEventListener('change', () => {
    roomInput.style.display = roomSelect.value === 'custom' ? 'block' : 'none';
    if (roomSelect.value === 'custom') roomInput.focus();
  });

  dialog.addEventListener('click', (e) => e.stopPropagation());

  // 连接按钮
  const connectBtn = document.createElement('button');
  connectBtn.id = 'colyseus-connect-btn';
  connectBtn.textContent = '连接';
  Object.assign(connectBtn.style, { width: '100%', padding: '10px', marginBottom: '10px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' });
  connectBtn.onclick = () => {
    const username = document.getElementById('colyseus-username-input').value.trim();
    const rs = document.getElementById('colyseus-room-select');
    const ci = document.getElementById('colyseus-room-input');
    const roomName = rs.value === 'custom' ? ci.value.trim() : rs.value;
    if (!username) { showCustomMessage('请输入用户名', "warning"); return; }
    if (!roomName) { showCustomMessage('请选择或输入房间名称', "warning"); return; }
    colyseusSlotStates.username = username;
    setColyseusRoomName(roomName);
    closeConnectionDialog();
    if (window.connectToColyseus) window.connectToColyseus();
  };
  dialog.appendChild(connectBtn);

  // 取消按钮
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  Object.assign(cancelBtn.style, { width: '100%', padding: '10px', background: '#555', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' });
  cancelBtn.onclick = closeConnectionDialog;
  dialog.appendChild(cancelBtn);

  document.body.appendChild(dialog);
  usernameInput.focus();
  setTimeout(() => usernameInput.focus(), 100);
}

export function closeConnectionDialog() {
  const dialog = document.getElementById('colyseus-connection-dialog');
  if (dialog) dialog.style.display = 'none';
}

// ---- 辅助函数 ----

function _appendLabel(parent, text) {
  const label = document.createElement('div');
  label.textContent = text;
  label.style.marginBottom = '5px';
  parent.appendChild(label);
}

function _createInput(id, value, placeholder) {
  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  input.value = value || '';
  if (placeholder) input.placeholder = placeholder;
  Object.assign(input.style, { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' });
  input.addEventListener('keydown', (e) => e.stopPropagation());
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('keypress', (e) => e.stopPropagation());
  return input;
}

function _createRoomSelect() {
  const select = document.createElement('select');
  select.id = 'colyseus-room-select';
  Object.assign(select.style, { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #555', marginBottom: '10px', backgroundColor: '#222', color: '#fff' });
  const rooms = [
    { value: "rhythm_room", label: "默认房间 (rhythm_room)" },
    { value: "custom_room", label: "自定义房间" },
    { value: "music_room", label: "音乐房间" },
    { value: "party_room", label: "派对房间" },
    { value: "jam_room", label: "即兴演奏房间" },
    { value: "band_room", label: "乐队房间" }
  ];
  for (let i = 1; i <= 10; i++) rooms.push({ value: `rhythm_room_${i}`, label: `节奏房间 ${i}` });
  rooms.push({ value: "custom", label: "- 输入自定义房间名 -" });
  rooms.forEach(r => { const o = document.createElement('option'); o.value = r.value; o.textContent = r.label; select.appendChild(o); });
  select.value = "rhythm_room";
  select.addEventListener('keydown', (e) => e.stopPropagation());
  return select;
}
