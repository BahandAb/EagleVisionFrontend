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

// Crop state — always represents a SQUARE region of the source video, in
// normalized source-fraction terms: (cx,cy) is the center, size is the
// square's side length as a fraction of min(sourceWidth, sourceHeight).
// Defaults to the full centered square so students never see a stretched
// feed even if the host never touches the crop tool — most microscope
// cameras aren't natively square (or even 16:9), and stretching the raw
// frame to fit was the actual cause of the distorted feed.
let cropRect           = { cx: 0.5, cy: 0.5, size: 1.0 };
let cropOverlayVisible = false;
let dragState          = null;
let lastLetterbox      = null; // { dx, dy, scale, vw, vh } from the last draw, for overlay math

// ── DOM refs (populated after DOMContentLoaded) ──
let videoEl, canvasEl, ctx, cropOverlay;
let publishCanvas, pubCtx; // hidden canvas: the actual cropped feed sent to LiveKit

const BACKEND = 'https://api.eaglevision.dev';

// ── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  videoEl     = document.getElementById('preview-video');
  canvasEl    = document.getElementById('host-canvas');
  ctx         = canvasEl.getContext('2d');
  cropOverlay = document.getElementById('crop-overlay');

  // ── Access gate ──
  const gateSubmit = document.getElementById('btn-gate-submit');
  const gateInput  = document.getElementById('gate-password-input');

  async function submitGate() {
    const password = gateInput.value.trim();
    if (!password) return;
    gateSubmit.disabled = true;
    gateSubmit.textContent = 'Checking…';
    try {
      const res = await fetch(`${BACKEND}/api/host-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('gate-screen').style.display = 'none';
        document.getElementById('setup-screen').style.display = 'flex';
        sessionCode = generateCode();
        document.getElementById('session-code-display').textContent = sessionCode;
        populateCameras();
      } else {
        const err = document.getElementById('gate-error');
        err.textContent = data.error || 'Incorrect password.';
        err.style.display = 'block';
        gateInput.value = '';
        gateInput.focus();
      }
    } catch {
      const err = document.getElementById('gate-error');
      err.textContent = 'Could not reach server. Try again.';
      err.style.display = 'block';
    }
    gateSubmit.disabled = false;
    gateSubmit.textContent = 'Continue';
  }

  gateSubmit.addEventListener('click', submitGate);
  gateInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitGate(); });

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
  let code = '';
  for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10);
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

  // Feed Quality options are square (e.g. 720x720) to match the square
  // viewport students see it in — w and h are always equal here.
  const [w, h] = getResolution();
  canvasEl.width  = w;
  canvasEl.height = h;
  canvasEl.style.aspectRatio = `${w}/${h}`;

  // Hidden canvas that actually gets published: crop-region-only, filled
  // edge-to-edge, always square-in/square-out so it's never stretched.
  publishCanvas = document.createElement('canvas');
  publishCanvas.width  = w;
  publishCanvas.height = h;
  pubCtx = publishCanvas.getContext('2d');

  document.getElementById('setup-screen').style.display  = 'none';
  document.getElementById('session-screen').style.display = 'flex';
  document.getElementById('hdr-code').textContent = sessionCode;

  startRenderLoop();
  connectSocket();
}

// ── Render loop ───────────────────────────────
// Draws two things every frame:
//  1. #host-canvas (visible): the FULL source frame, letterboxed ("contain")
//     to fit the square canvas without ever stretching it — this is the
//     host's own monitor view, always showing full context so the crop
//     overlay can be positioned accurately against it.
//  2. publishCanvas (hidden): just the current square crop region, filled
//     edge-to-edge — this is what's actually captured and sent to LiveKit,
//     so what students see is always a clean, undistorted square.
function startRenderLoop() {
  const draw = () => {
    if (!videoEl.videoWidth) { animFrameId = requestAnimationFrame(draw); return; }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;

    // Host's own monitor view — contain/letterbox, never stretched.
    const cw = canvasEl.width, ch = canvasEl.height;
    const scale = Math.min(cw / vw, ch / vh);
    const dw = vw * scale, dh = vh * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(videoEl, 0, 0, vw, vh, dx, dy, dw, dh);
    lastLetterbox = { dx, dy, scale, vw, vh };

    // Published feed — square crop region only, filled edge-to-edge.
    const minDim = Math.min(vw, vh);
    const sizePx = cropRect.size * minDim;
    const sx = Math.max(0, Math.min(vw - sizePx, cropRect.cx * vw - sizePx / 2));
    const sy = Math.max(0, Math.min(vh - sizePx, cropRect.cy * vh - sizePx / 2));
    pubCtx.clearRect(0, 0, publishCanvas.width, publishCanvas.height);
    pubCtx.drawImage(videoEl, sx, sy, sizePx, sizePx, 0, 0, publishCanvas.width, publishCanvas.height);

    if (cropOverlayVisible) updateCropOverlay();

    animFrameId = requestAnimationFrame(draw);
  };
  animFrameId = requestAnimationFrame(draw);

  canvasStream = publishCanvas.captureStream(30);
}

// ── Socket.IO ─────────────────────────────────
function connectSocket() {
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

  socket.on('host_error', data => {
    const msg = (data && data.message) ? data.message : 'Session error. Try a new code.';
    console.warn('Host error:', msg);
    // Surface the error in the status panel so the host sees it
    const statusBody = document.getElementById('status-body');
    if (statusBody) {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:.85rem;color:#f87171;margin:0';
      p.textContent = msg;
      statusBody.prepend(p);
    }
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
// Note: the crop itself is ALWAYS applied (defaulting to the full centered
// square) so the published feed is never stretched. "Toggle Crop" just
// shows/hides the draggable adjustment handles over the host's own
// letterboxed monitor view — it doesn't turn cropping on/off.
function toggleCrop() {
  cropOverlayVisible = !cropOverlayVisible;
  cropOverlay.style.display = cropOverlayVisible ? 'block' : 'none';
  if (cropOverlayVisible) updateCropOverlay();
}

function resetCrop() {
  cropRect = { cx: 0.5, cy: 0.5, size: 1.0 };
  if (cropOverlayVisible) updateCropOverlay();
}

function updateCropOverlay() {
  if (!lastLetterbox) return;
  const { dx, dy, scale, vw, vh } = lastLetterbox;

  const ws = document.getElementById('workspace');
  const canvasRect = canvasEl.getBoundingClientRect();
  const wsRect = ws.getBoundingClientRect();
  const screenScale = canvasRect.width / canvasEl.width;

  const minDim = Math.min(vw, vh);
  const sizePx = cropRect.size * minDim;
  const sx = Math.max(0, Math.min(vw - sizePx, cropRect.cx * vw - sizePx / 2));
  const sy = Math.max(0, Math.min(vh - sizePx, cropRect.cy * vh - sizePx / 2));

  const left = canvasRect.left - wsRect.left + (dx + sx * scale) * screenScale;
  const top  = canvasRect.top  - wsRect.top  + (dy + sy * scale) * screenScale;
  const size = sizePx * scale * screenScale;

  cropOverlay.style.left   = left + 'px';
  cropOverlay.style.top    = top  + 'px';
  cropOverlay.style.width  = size + 'px';
  cropOverlay.style.height = size + 'px';
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
  if (!lastLetterbox) return;
  const corner = target.dataset.corner;
  dragState = {
    type:      corner ? 'corner' : 'move',
    corner:    corner || null,
    startX:    clientX,
    startY:    clientY,
    startCrop: { ...cropRect },
  };
}

function moveDrag(clientX, clientY) {
  if (!dragState || !lastLetterbox) return;
  const { scale, vw, vh } = lastLetterbox;
  const canvasRect = canvasEl.getBoundingClientRect();
  const screenScale = canvasRect.width / canvasEl.width;
  // Convert an on-screen CSS-pixel delta back into source-video pixels,
  // inverting the same letterbox + screen scale used to draw/position things.
  const srcPxPerScreenPx = 1 / (scale * screenScale);

  const dxPx = (clientX - dragState.startX) * srcPxPerScreenPx;
  const dyPx = (clientY - dragState.startY) * srcPxPerScreenPx;
  const minDim = Math.min(vw, vh);
  const { type, corner, startCrop } = dragState;

  if (type === 'move') {
    const sizePx = startCrop.size * minDim;
    const cxPx = Math.max(sizePx / 2, Math.min(vw - sizePx / 2, startCrop.cx * vw + dxPx));
    const cyPx = Math.max(sizePx / 2, Math.min(vh - sizePx / 2, startCrop.cy * vh + dyPx));
    cropRect.cx = cxPx / vw;
    cropRect.cy = cyPx / vh;
  } else {
    // Resize stays square by construction: grow/shrink one size value based
    // on outward drag distance, symmetrically from the crop's own center
    // (simpler and more predictable on touch than a true corner-anchored
    // resize, at the cost of the opposite edge moving too).
    const outX = corner.includes('r') ? dxPx : -dxPx;
    const outY = corner.includes('b') ? dyPx : -dyPx;
    const startSizePx = startCrop.size * minDim;
    const minSizePx = minDim * 0.15;
    const newSizePx = Math.max(minSizePx, Math.min(minDim, startSizePx + outX + outY));

    cropRect.size = newSizePx / minDim;
    const cxPx = Math.max(newSizePx / 2, Math.min(vw - newSizePx / 2, startCrop.cx * vw));
    const cyPx = Math.max(newSizePx / 2, Math.min(vh - newSizePx / 2, startCrop.cy * vh));
    cropRect.cx = cxPx / vw;
    cropRect.cy = cyPx / vh;
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
  if (!roster.length) {
    body.innerHTML = '<p style="font-size:.85rem;color:var(--muted,#7c83a8)">No students yet.</p>';
    return;
  }
  body.innerHTML = '';
  roster.forEach(student => {
    const initials = (student.name || '?').slice(0, 2).toUpperCase();

    const avatar = document.createElement('div');
    avatar.className = 'roster-avatar';
    avatar.textContent = initials;

    const name = document.createElement('span');
    name.className = 'roster-name';
    name.textContent = student.name || student.id;

    const kick = document.createElement('button');
    kick.className = 'roster-kick';
    kick.textContent = 'Kick';
    kick.addEventListener('click', () => kickUser(student.id));

    const div = document.createElement('div');
    div.className = 'roster-item';
    div.appendChild(avatar);
    div.appendChild(name);
    div.appendChild(kick);
    body.appendChild(div);
  });
}

// ── Admin commands ────────────────────────────
function kickUser(studentId) {
  if (!socket) return;
  socket.emit('kick_student', { code: sessionCode, adminKey, targetId: studentId });
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
