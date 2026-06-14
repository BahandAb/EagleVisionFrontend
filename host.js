const SIGNALING_SERVER_URL = "https://api.eaglevision.dev";

// --- STATE ---
let socket = null;
let livekitRoom = null;
let localVideoTrack = null;
let canvasStream = null;
let cameraStream = null;
let hiddenVideo = null;

let sessionCode = "";
let adminKey = "";
let currentRoomID = "";

let cropEnabled = false;
let cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
let dragState = null;

let rafHandle = null;
let latestRoster = {};
let isFollowMode = false;
let isBroadcastMode = false;
let availableCameras = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  sessionCode = generateCode();
  document.getElementById('session-code-display').textContent = sessionCode;
  document.getElementById('stat-code').textContent = sessionCode;

  hiddenVideo = document.createElement('video');
  hiddenVideo.autoplay = true;
  hiddenVideo.muted = true;
  hiddenVideo.playsInline = true;
  hiddenVideo.style.display = 'none';
  document.body.appendChild(hiddenVideo);

  document.getElementById('regen-code-btn').addEventListener('click', regenerateCode);
  document.getElementById('start-btn').addEventListener('click', startSession);
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.getElementById('end-btn').addEventListener('click', endSession);
  document.getElementById('instruction-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendInstruction();
  });

  document.querySelectorAll('.act-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.dataset.panel));
  });

  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach(t => t.stop());
  } catch {
    showSetupError('Camera permission denied. Please allow camera access and reload.');
    return;
  }

  await populateCameraSelect();
  const firstId = document.getElementById('camera-select').value;
  if (firstId) await startPreview(firstId);

  document.getElementById('camera-select').addEventListener('change', () => {
    startPreview(document.getElementById('camera-select').value);
  });
  document.getElementById('resolution-select').addEventListener('change', () => {
    startPreview(document.getElementById('camera-select').value);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  document.addEventListener('fullscreenchange', () => {
    const icon = document.querySelector('#fullscreen-btn .material-icons');
    if (icon) icon.textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
  });
});

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function regenerateCode() {
  sessionCode = generateCode();
  document.getElementById('session-code-display').textContent = sessionCode;
}

async function populateCameraSelect() {
  const select = document.getElementById('camera-select');
  const prevVal = select.value;
  select.innerHTML = '';

  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  availableCameras = devices.filter(d => d.kind === 'videoinput');

  if (availableCameras.length === 0) {
    select.innerHTML = '<option value="">No cameras found</option>';
    return;
  }
  availableCameras.forEach((cam, i) => {
    const opt = document.createElement('option');
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${i + 1}`;
    select.appendChild(opt);
  });
  if (prevVal) select.value = prevVal;
}

function parseResolution() {
  const val = document.getElementById('resolution-select').value;
  const [w, h] = val.split('x').map(Number);
  return { width: w || 1280, height: h || 720 };
}

async function startPreview(deviceId) {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());

  const { width, height } = parseResolution();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height }
      }
    });
    document.getElementById('preview-video').srcObject = cameraStream;
    await populateCameraSelect();
    if (deviceId) document.getElementById('camera-select').value = deviceId;
  } catch (err) {
    showSetupError(`Camera error: ${err.message}`);
  }
}

async function startSession() {
  const btn = document.getElementById('start-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-icons">hourglass_top</span> Connecting…';

  if (!cameraStream) {
    showSetupError('No camera available. Allow camera access and try again.');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons">videocam</span> Start Session';
    return;
  }

  adminKey = document.getElementById('admin-key-input').value.trim()
    || String(Math.floor(1000 + Math.random() * 9000));
  currentRoomID = sessionCode;

  hiddenVideo.srcObject = cameraStream;
  await hiddenVideo.play().catch(() => {});

  startRenderLoop();

  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('session-screen').style.display = 'flex';
  document.getElementById('live-code-display').textContent = sessionCode;
  document.getElementById('stat-code').textContent = sessionCode;

  const { width, height } = parseResolution();
  document.getElementById('stat-resolution').textContent = `${width}×${height}`;

  const camLabel = document.getElementById('camera-select').selectedOptions[0]?.text || '—';
  document.getElementById('stat-camera').textContent = camLabel;

  buildCamSwitchBar();
  connectSocket(currentRoomID, adminKey);
}

function startRenderLoop() {
  const canvas = document.getElementById('host-canvas');
  const ctx = canvas.getContext('2d');

  function render() {
    const vw = hiddenVideo.videoWidth;
    const vh = hiddenVideo.videoHeight;

    if (vw && vh) {
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }
      if (cropEnabled) {
        ctx.drawImage(
          hiddenVideo,
          cropRect.x * vw, cropRect.y * vh,
          cropRect.w * vw, cropRect.h * vh,
          0, 0, canvas.width, canvas.height
        );
      } else {
        ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
      }
    }
    rafHandle = requestAnimationFrame(render);
  }

  rafHandle = requestAnimationFrame(render);
  canvasStream = canvas.captureStream(30);
}

function connectSocket(roomId, key) {
  socket = io(SIGNALING_SERVER_URL, { transports: ['polling', 'websocket'] });

  socket.on('connect', () => {
    setSocketStatus(true);
    socket.emit('register_host', { room: roomId, key });
  });

  socket.on('disconnect', () => setSocketStatus(false));

  socket.on('host_registered', async (data) => {
    await publishToLiveKit(data.livekit_url, data.token);
  });

  socket.on('roster_update', roster => {
    latestRoster = roster;
    renderRoster();
  });
}

function setSocketStatus(ok) {
  document.getElementById('socket-status-pill').classList.toggle('connected', ok);
  document.getElementById('socket-status-label').textContent = ok ? 'Socket: connected' : 'Socket: disconnected';
}

function setLiveKitStatus(ok) {
  document.getElementById('livekit-status-pill').classList.toggle('connected', ok);
  document.getElementById('livekit-status-label').textContent = ok ? 'LiveKit: streaming' : 'LiveKit: disconnected';
  document.getElementById('stat-livekit').textContent = ok ? 'streaming' : 'disconnected';
}

async function publishToLiveKit(livekitUrl, token) {
  livekitRoom = new LivekitClient.Room();
  livekitRoom.on(LivekitClient.RoomEvent.Connected,    () => setLiveKitStatus(true));
  livekitRoom.on(LivekitClient.RoomEvent.Disconnected, () => setLiveKitStatus(false));

  try {
    await livekitRoom.connect(livekitUrl, token);
    const mediaTrack = canvasStream.getVideoTracks()[0];
    localVideoTrack  = new LivekitClient.LocalVideoTrack(mediaTrack);
    await livekitRoom.localParticipant.publishTrack(localVideoTrack, {
      name: 'microscope',
      source: LivekitClient.Track.Source.Camera,
      simulcast: false  // canvas tracks bypass hardware encoder; simulcast unsupported
    });
  } catch (err) {
    console.error('LiveKit publish error:', err);
    setLiveKitStatus(false);
  }
}

function buildCamSwitchBar() {
  const bar = document.getElementById('cam-switch-bar');
  bar.innerHTML = '';
  if (availableCameras.length <= 1) { bar.style.display = 'none'; return; }

  const currentId = document.getElementById('camera-select').value;
  availableCameras.forEach((cam, i) => {
    const pill = document.createElement('button');
    pill.className = 'cam-pill' + (cam.deviceId === currentId ? ' active' : '');
    pill.textContent = cam.label || `Camera ${i + 1}`;
    pill.addEventListener('click', () => switchCameraTo(cam.deviceId));
    bar.appendChild(pill);
  });
}

async function switchCamera() {
  const currentId = cameraStream?.getVideoTracks()[0]?.getSettings().deviceId;
  const idx = availableCameras.findIndex(c => c.deviceId === currentId);
  const next = availableCameras[(idx + 1) % availableCameras.length];
  if (next) await switchCameraTo(next.deviceId);
}

async function switchCameraTo(deviceId) {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  const { width, height } = parseResolution();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } }
    });
    hiddenVideo.srcObject = cameraStream;
    document.getElementById('stat-camera').textContent =
      availableCameras.find(c => c.deviceId === deviceId)?.label || deviceId;
    document.querySelectorAll('.cam-pill').forEach((p, i) => {
      p.classList.toggle('active', availableCameras[i]?.deviceId === deviceId);
    });
  } catch (err) {
    console.error('Camera switch failed:', err);
  }
}

function toggleCrop() {
  cropEnabled = !cropEnabled;
  const overlay = document.getElementById('crop-overlay');
  if (cropEnabled) {
    overlay.style.display = 'block';
    positionCropOverlay();
    initCropDrag();
  } else {
    overlay.style.display = 'none';
    removeCropDrag();
  }
  document.getElementById('crop-btn').classList.toggle('active', cropEnabled);
  document.getElementById('crop-ws-btn').classList.toggle('active', cropEnabled);
}

function resetCrop() {
  cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  positionCropOverlay();
}

function positionCropOverlay() {
  const wrap    = document.getElementById('canvas-wrap');
  const overlay = document.getElementById('crop-overlay');
  const canvas  = document.getElementById('host-canvas');
  const wrapRect   = wrap.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const offX = canvasRect.left - wrapRect.left;
  const offY = canvasRect.top  - wrapRect.top;
  overlay.style.left   = (offX + cropRect.x * canvasRect.width)  + 'px';
  overlay.style.top    = (offY + cropRect.y * canvasRect.height) + 'px';
  overlay.style.width  = (cropRect.w * canvasRect.width)  + 'px';
  overlay.style.height = (cropRect.h * canvasRect.height) + 'px';
}

function initCropDrag() {
  document.getElementById('crop-overlay').addEventListener('mousedown', onCropDown);
  document.addEventListener('mousemove', onCropMove);
  document.addEventListener('mouseup',   onCropUp);
}

function removeCropDrag() {
  document.getElementById('crop-overlay').removeEventListener('mousedown', onCropDown);
  document.removeEventListener('mousemove', onCropMove);
  document.removeEventListener('mouseup',   onCropUp);
  dragState = null;
}

function onCropDown(e) {
  const cornerClass = [...e.target.classList].find(c => ['tl','tr','bl','br'].includes(c));
  const canvas = document.getElementById('host-canvas');
  const rect   = canvas.getBoundingClientRect();
  dragState = {
    type:  cornerClass ? 'resize' : 'move',
    corner: cornerClass || null,
    startX: e.clientX, startY: e.clientY,
    startRect: { ...cropRect },
    cw: rect.width, ch: rect.height
  };
  e.preventDefault();
  e.stopPropagation();
}

function onCropMove(e) {
  if (!dragState) return;
  const dx = (e.clientX - dragState.startX) / dragState.cw;
  const dy = (e.clientY - dragState.startY) / dragState.ch;
  const sr = dragState.startRect;
  const MIN = 0.05;

  if (dragState.type === 'move') {
    cropRect.x = Math.max(0, Math.min(1 - sr.w, sr.x + dx));
    cropRect.y = Math.max(0, Math.min(1 - sr.h, sr.y + dy));
    cropRect.w = sr.w; cropRect.h = sr.h;
  } else {
    let { x, y, w, h } = sr;
    const c = dragState.corner;
    if (c === 'br') {
      w = Math.max(MIN, Math.min(1 - x, w + dx));
      h = Math.max(MIN, Math.min(1 - y, h + dy));
    } else if (c === 'bl') {
      const nx = Math.max(0, Math.min(x + w - MIN, x + dx));
      w = w + (x - nx); x = nx;
      h = Math.max(MIN, Math.min(1 - y, h + dy));
    } else if (c === 'tr') {
      w = Math.max(MIN, Math.min(1 - x, w + dx));
      const ny = Math.max(0, Math.min(y + h - MIN, y + dy));
      h = h + (y - ny); y = ny;
    } else if (c === 'tl') {
      const nx = Math.max(0, Math.min(x + w - MIN, x + dx));
      w = w + (x - nx); x = nx;
      const ny = Math.max(0, Math.min(y + h - MIN, y + dy));
      h = h + (y - ny); y = ny;
    }
    cropRect = { x, y, w, h };
  }
  positionCropOverlay();
}

function onCropUp() { dragState = null; }

window.addEventListener('resize', () => { if (cropEnabled) positionCropOverlay(); });

function showPanel(name) {
  ['status', 'roster', 'controls'].forEach(n => {
    document.getElementById('panel-' + n).classList.toggle('active', n === name);
  });
  document.querySelectorAll('.act-btn[data-panel]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === name);
  });
}

function renderRoster() {
  const list = document.getElementById('roster-list');
  let c = 0;
  list.innerHTML = '';

  for (const [sid, user] of Object.entries(latestRoster)) {
    c++;
    const isHostUser = user.role === 'admin';
    const div = document.createElement('div');
    div.className = 'roster-item';
    div.innerHTML = `
      <div>
        <div class="roster-name" style="color:${isHostUser ? '#FFD700' : '#e8eaf0'}">
          ${user.name}
          ${isHostUser ? '<span class="material-icons" style="font-size:13px;vertical-align:middle;margin-left:4px;">verified</span>' : ''}
        </div>
        <div class="roster-role">${isHostUser ? 'Host' : 'Student'}</div>
      </div>
      ${!isHostUser ? `<button class="btn-kick" onclick="kickUser('${sid}')">Kick</button>` : ''}
    `;
    list.appendChild(div);
  }

  if (c === 0) list.innerHTML = '<div class="roster-empty">No students connected yet</div>';
  document.getElementById('stat-students').textContent = String(c);
}

function kickUser(sid) {
  if (confirm('Kick this student?'))
    socket?.emit('kick_student', { room: currentRoomID, key: adminKey, target_sid: sid });
}

function triggerReturnLive() {
  socket?.emit('admin_return_live', { room: currentRoomID, key: adminKey });
}

function triggerRequestPhoto() {
  socket?.emit('admin_trigger_photo', { room: currentRoomID, key: adminKey });
}

function setFollowMode() {
  isFollowMode = !isFollowMode;
  document.getElementById('follow-mode-btn').classList.toggle('active', isFollowMode);
}

function setBroadcastMode() {
  isBroadcastMode = !isBroadcastMode;
  document.getElementById('broadcast-mode-btn').classList.toggle('active', isBroadcastMode);
}

function clearAllScreens() {
  if (confirm('Clear all student annotation screens?'))
    socket?.emit('admin_clear_all', { room: currentRoomID, key: adminKey });
}

function sendInstruction() {
  const msg = document.getElementById('instruction-input').value.trim();
  if (!msg) return;
  socket?.emit('broadcast_instruction', { room: currentRoomID, key: adminKey, message: msg });
  document.getElementById('instruction-input').value = '';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(console.error);
  } else {
    document.exitFullscreen();
  }
}

function endSession() {
  if (!confirm('End this session for everyone?')) return;
  socket?.disconnect();
  if (livekitRoom) livekitRoom.disconnect();
  if (rafHandle) cancelAnimationFrame(rafHandle);
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  window.location.href = 'index.html';
}

function showSetupError(msg) {
  const el = document.getElementById('setup-error');
  el.textContent = msg;
  el.classList.add('visible');
}
