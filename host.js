/* ─────────────────────────────────────────────
   EagleVision – Host Page  (host.js)
   ───────────────────────────────────────────── */

// ── State ────────────────────────────────────
let socket            = null;
let livekitRoom       = null;
let cameraStream      = null;
let canvasStream      = null;
let sessionCode       = '';
let adminKey          = '';
let roster            = [];          // [{id, name}]
let animFrameId       = null;

// Crop state
let cropActive        = false;
let cropRect          = { x: 0, y: 0, w: 1, h: 1 };  // normalised 0-1
let dragState         = null;

// ── DOM refs (populated after DOMContentLoaded) ──
let videoEl, canvasEl, ctx, cropOverlay;

// ── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  videoEl     = document.getElementById('preview-video');
  canvasEl    = document.getElementById('host-canvas');
  ctx         = canvasEl.getContext('2d');
  cropOverlay = document.getElementById('crop-overlay');

  sessionCode = generateCode();
  document.getElementById('session-code-display').textContent = sessionCode;

  populateCameras();

  document.getElementById('btn-regen').addEventListener('click', regenerateCode);
  document.getElementById('btn-start').addEventListener('click', startSession);
  document.getElementById('btn-end').addEventListener('click', endSession);
  document.getElementById('camera-select').addEventListener('change', onCameraChange);
  document.getElementById('resolution-select').addEventListener('change', onResolutionChange);

  // Activity bar navigation
  document.querySelectorAll('.ab-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => showHostPanel(btn.dataset.panel));
  });

  // Session camera switcher (in controls panel)
  document.getElementById('session-camera-select').addEventListener('change', e => {
    switchCamera(e.target.value);
  });

  // Fullscreen listener
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.getElementById('workspace').style.background = '#000';
    }
  });

  // Backdrop tap closes panel on mobile
  document.getElementById('panel-backdrop').addEventListener('click', closeMobilePanel);

  // Crop drag
  initCropDrag();
});

// ── Code helpers ──────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function regenerateCode() {
  sessionCode = generateCode();
  document.getElementById('session-code-display').textContent = sessionCode;
}

// ── Camera helpers ────────────────────────────
async function populateCameras() {
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    tmp.getTracks().forEach(t => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');

    const sel  = document.getElementById('camera-select');
    const ssel = document.getElementById('session-camera-select');
    sel.innerHTML  = '';
    ssel.innerHTML = '';
    cams.forEach((cam, i) => {
      const label = cam.label || `Camera ${i + 1}`;
      [sel, ssel].forEach(s => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = label;
        s.appendChild(opt);
      });
    });

    await startPreview();
  } catch (err) {
    showSetupError('Camera access denied: ' + err.message);
  }
}

async function startPreview() {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());

  const [w, h] = getResolution();
  const deviceId = document.getElementById('camera-select').value;
  const constraints = {
    video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: w }, height: { ideal: h } },
    audio: false
  };
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = cameraStream;
  } catch (err) {
    showSetupError('Could not open camera: ' + err.message);
  }
}

async function onCameraChange() { await startPreview(); }
async function onResolutionChange() { await startPreview(); }

async function switchCamera(deviceId) {
  if (!deviceId) return;
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  const [w, h] = getResolution();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: w }, height: { ideal: h } },
      audio: false
    });
    videoEl.srcObject = cameraStream;
  } catch (err) {
    console.warn('Camera switch failed:', err);
  }
}

function getResolution() {
  const val = document.getElementById('resolution-select').value;
  return val.split('x').map(Number);
}

// ── Session start ─────────────────────────────
async function startSession() {
  const code = document.getElementById('session-code-display').textContent.trim();
  if (!code || code === '------') return showSetupError('Generate a session code first.');
  sessionCode = code;
  adminKey    = document.getElementById('admin-key-input').value.trim();

  if (!cameraStream) return showSetupError('No camera stream available.');

  const [w, h] = getResolution();
  canvasEl.width  = w;
  canvasEl.height = h;

  document.getElementById('setup-screen').style.display  = 'none';
  document.getElementById('session-screen').style.display = 'flex';
  document.getElementById('hdr-code').textContent = sessionCode;

  startRenderLoop();
  connectSocket();
}

// ── Render loop ───────────────────────────────
function startRenderLoop() {
  const draw = () => {
    if (!videoEl.videoWidth) { animFrameId = requestAnimationFrame(draw); return; }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const cw = canvasEl.width;
    const ch = canvasEl.height;

    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (cropActive) {
      sx = Math.round(cropRect.x * vw);
      sy = Math.round(cropRect.y * vh);
      sw = Math.round(cropRect.w * vw);
      sh = Math.round(cropRect.h * vh);
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, cw, ch);
    animFrameId = requestAnimationFrame(draw);
  };
  animFrameId = requestAnimationFrame(draw);

  canvasStream = canvasEl.captureStream(30);
}

// ── Socket.IO ─────────────────────────────────
function connectSocket() {
  const BACKEND = 'https://api.eaglevision.dev';
  socket = io(BACKEND, { transports: ['websocket'] });

  socket.on('connect', () => {
    setSocketStatus(true);
    socket.emit('register_host', { room: sessionCode, key: adminKey });
  });

  socket.on('disconnect', () => setSocketStatus(false));

  socket.on('host_registered', data => {
    console.log('Host registered:', data);
    publishToLiveKit(data.token, data.livekit_url);
  });

  socket.on('roster_update', data => {
    // Backend sends roster as { sid: { name, role } } object
    const rosterObj = data.roster || {};
    roster = Object.entries(rosterObj).map(([id, info]) => ({ id, name: info.name || id }));
    document.getElementById('hdr-viewers').textContent = `${roster.length} viewer${roster.length !== 1 ? 's' : ''}`;
    renderRoster();
  });

  socket.on('connect_error', err => {
    setSocketStatus(false);
    console.warn('Socket error:', err.message);
  });
}

function setSocketStatus(ok) {
  const badge = document.getElementById('badge-socket');
  badge.textContent = ok ? 'Socket ✓' : 'Socket ✗';
  badge.className   = `badge badge-socket${ok ? '' : ' err'}`;
}

function setLiveKitStatus(ok) {
  const badge = document.getElementById('badge-lk');
  badge.textContent = ok ? 'LiveKit ✓' : 'LiveKit ✗';
  badge.className   = `badge badge-lk${ok ? '' : ' err'}`;
}

// ── LiveKit ───────────────────────────────────
async function publishToLiveKit(token, url) {
  if (!token || !url) { setLiveKitStatus(false); return; }
  try {
    livekitRoom = new LivekitClient.Room();
    await livekitRoom.connect(url, token);
    setLiveKitStatus(true);

    const videoTrack = await LivekitClient.createLocalVideoTrack({ mediaStreamTrack: canvasStream.getVideoTracks()[0] });
    await livekitRoom.localParticipant.publishTrack(videoTrack);
  } catch (err) {
    setLiveKitStatus(false);
    console.warn('LiveKit error:', err);
  }
}

// ── Crop ──────────────────────────────────────
function toggleCrop() {
  cropActive = !cropActive;
  if (cropActive) {
    cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    cropOverlay.style.display = 'block';
    updateCropOverlay();
  } else {
    cropOverlay.style.display = 'none';
    cropRect = { x: 0, y: 0, w: 1, h: 1 };
  }
}

function resetCrop() {
  cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  if (cropActive) updateCropOverlay();
}

function updateCropOverlay() {
  const ws = document.getElementById('workspace');
  const rect = canvasEl.getBoundingClientRect();
  const wsRect = ws.getBoundingClientRect();

  const left   = rect.left - wsRect.left + cropRect.x * rect.width;
  const top    = rect.top  - wsRect.top  + cropRect.y * rect.height;
  const width  = cropRect.w * rect.width;
  const height = cropRect.h * rect.height;

  cropOverlay.style.left   = left   + 'px';
  cropOverlay.style.top    = top    + 'px';
  cropOverlay.style.width  = width  + 'px';
  cropOverlay.style.height = height + 'px';
}

function initCropDrag() {
  cropOverlay.addEventListener('mousedown',  onCropMouseDown);
  document.addEventListener('mousemove',    onCropMouseMove);
  document.addEventListener('mouseup',      onCropMouseUp);
  cropOverlay.addEventListener('touchstart', onCropTouchStart, { passive: false });
  document.addEventListener('touchmove',    onCropTouchMove,  { passive: false });
  document.addEventListener('touchend',     onCropMouseUp);
}

function removeCropDrag() {
  cropOverlay.removeEventListener('mousedown',  onCropMouseDown);
  document.removeEventListener('mousemove',    onCropMouseMove);
  document.removeEventListener('mouseup',      onCropMouseUp);
  cropOverlay.removeEventListener('touchstart', onCropTouchStart);
  document.removeEventListener('touchmove',    onCropTouchMove);
  document.removeEventListener('touchend',     onCropMouseUp);
}

function startDrag(clientX, clientY, target) {
  const corner = target.dataset.corner;
  dragState = {
    type:      corner ? 'corner' : 'move',
    corner:    corner || null,
    startX:    clientX,
    startY:    clientY,
    startRect: { ...cropRect },
    canvasRect: canvasEl.getBoundingClientRect()
  };
}

function moveDrag(clientX, clientY) {
  if (!dragState) return;
  const { canvasRect, startX, startY, startRect, type, corner } = dragState;
  const dx = (clientX - startX) / canvasRect.width;
  const dy = (clientY - startY) / canvasRect.height;

  if (type === 'move') {
    cropRect.x = Math.max(0, Math.min(1 - startRect.w, startRect.x + dx));
    cropRect.y = Math.max(0, Math.min(1 - startRect.h, startRect.y + dy));
  } else {
    let { x, y, w, h } = startRect;
    if (corner.includes('r')) { w = Math.max(0.05, Math.min(1 - x, w + dx)); }
    if (corner.includes('l')) { const nx = Math.max(0, Math.min(x + w - 0.05, x + dx)); w = x + w - nx; x = nx; }
    if (corner.includes('b')) { h = Math.max(0.05, Math.min(1 - y, h + dy)); }
    if (corner.includes('t')) { const ny = Math.max(0, Math.min(y + h - 0.05, y + dy)); h = y + h - ny; y = ny; }
    cropRect = { x, y, w, h };
  }
  updateCropOverlay();
}

function onCropMouseDown(e)  { startDrag(e.clientX, e.clientY, e.target); e.preventDefault(); }
function onCropMouseMove(e)  { moveDrag(e.clientX, e.clientY); }
function onCropMouseUp()     { dragState = null; }

function onCropTouchStart(e) { const t = e.touches[0]; startDrag(t.clientX, t.clientY, e.target); e.preventDefault(); }
function onCropTouchMove(e)  { if (!dragState) return; const t = e.touches[0]; moveDrag(t.clientX, t.clientY); e.preventDefault(); }

// ── Panel navigation ──────────────────────────
function showHostPanel(name) {
  const isMobile = window.innerWidth <= 640;
  const sidePanel = document.getElementById('side-panel');
  const backdrop  = document.getElementById('panel-backdrop');

  // Tapping the active panel on mobile toggles it closed
  const activeBtn = document.querySelector('.ab-btn.active');
  if (isMobile && activeBtn && activeBtn.dataset.panel === name && sidePanel.classList.contains('open')) {
    closeMobilePanel();
    return;
  }

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ab-btn[data-panel]').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.ab-btn[data-panel="${name}"]`);
  if (btn) btn.classList.add('active');

  if (isMobile) {
    sidePanel.classList.add('open');
    backdrop.classList.add('open');
  }
}

function closeMobilePanel() {
  document.getElementById('side-panel').classList.remove('open');
  document.getElementById('panel-backdrop').classList.remove('open');
}

// ── Roster ────────────────────────────────────
function renderRoster() {
  const body = document.getElementById('roster-body');
  if (!roster.length) { body.innerHTML = '<p style="font-size:.85rem;color:var(--muted,#7c83a8)">No students yet.</p>'; return; }
  body.innerHTML = '';
  roster.forEach(student => {
    const initials = (student.name || '?').slice(0, 2).toUpperCase();
    const div = document.createElement('div');
    div.className = 'roster-item';
    div.innerHTML = `
      <div class="roster-avatar">${initials}</div>
      <span class="roster-name">${student.name || student.id}</span>
      <button class="roster-kick" onclick="kickUser('${student.id}')">Kick</button>
    `;
    body.appendChild(div);
  });
}

// ── Admin commands ────────────────────────────
function kickUser(studentId) {
  if (!socket) return;
  socket.emit('kick_user', { code: sessionCode, adminKey, targetId: studentId });
}

function triggerReturnLive() {
  if (!socket) return;
  socket.emit('host_command', { code: sessionCode, adminKey, command: 'return_live' });
}

function triggerRequestPhoto() {
  if (!socket) return;
  socket.emit('host_command', { code: sessionCode, adminKey, command: 'request_photo' });
}

function setFollowMode() {
  if (!socket) return;
  socket.emit('host_command', { code: sessionCode, adminKey, command: 'set_mode', mode: 'follow' });
}

function setBroadcastMode() {
  if (!socket) return;
  socket.emit('host_command', { code: sessionCode, adminKey, command: 'set_mode', mode: 'broadcast' });
}

function clearAllScreens() {
  if (!socket) return;
  socket.emit('host_command', { code: sessionCode, adminKey, command: 'clear_screens' });
}

function sendInstruction() {
  const text = document.getElementById('instruction-input').value.trim();
  if (!text || !socket) return;
  socket.emit('host_command', { code: sessionCode, adminKey, command: 'instruction', text });
  document.getElementById('instruction-input').value = '';
}

// ── Fullscreen ────────────────────────────────
function toggleFullscreen() {
  const ws = document.getElementById('workspace');
  if (!document.fullscreenElement) {
    ws.requestFullscreen().catch(err => console.warn('Fullscreen error:', err));
  } else {
    document.exitFullscreen();
  }
}

// ── End session ───────────────────────────────
function endSession() {
  if (!confirm('End the session for all students?')) return;
  if (socket) { socket.emit('end_session', { code: sessionCode, adminKey }); socket.disconnect(); }
  if (livekitRoom) livekitRoom.disconnect();
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  window.location.href = 'index.html';
}

// ── Utility ───────────────────────────────────
function showSetupError(msg) {
  const el = document.getElementById('setup-error');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}
