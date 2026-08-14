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

// Crop/framing state — always represents a SQUARE region of the source
// video, in normalized source-fraction terms: (cx,cy) is the center, size
// is the square's side length as a fraction of min(sourceWidth,
// sourceHeight). Defaults to the full centered square so students never
// see a stretched feed even if the host never adjusts framing — most
// microscope cameras aren't natively square (or even 16:9).
//
// #host-canvas is a direct-manipulation view: it always shows exactly this
// crop region, filled edge to edge — the same thing students see. Panning
// and pinch-zooming act straight on that view (content follows the finger,
// like a photos app), not on a separate outline drawn over a fixed backdrop
// — the earlier outline-over-static-view design read as "unresponsive"
// because the visible image itself never moved.
let cropRect      = { cx: 0.5, cy: 0.5, size: 1.0 };
let framingMode   = false;
let lastFrameSize = null; // { vw, vh } native source dimensions from the last drawn frame

// ── DOM refs (populated after DOMContentLoaded) ──
let videoEl, canvasEl, ctx;

const BACKEND = 'https://api.eaglevision.dev';

// ── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  videoEl     = document.getElementById('preview-video');
  canvasEl    = document.getElementById('host-canvas');
  ctx         = canvasEl.getContext('2d');

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

  document.getElementById('setup-screen').style.display  = 'none';
  document.getElementById('session-screen').style.display = 'flex';
  document.getElementById('hdr-code').textContent = sessionCode;

  startRenderLoop();
  connectSocket();
}

// ── Render loop ───────────────────────────────
// #host-canvas always shows the current crop region (cropRect), filled
// edge to edge — exactly what's captured and published. The host's own
// view and what students see are the same image, so pan/pinch feels like
// directly manipulating the feed instead of dragging an outline over an
// unrelated backdrop.
function startRenderLoop() {
  const draw = () => {
    if (!videoEl.videoWidth) { animFrameId = requestAnimationFrame(draw); return; }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    lastFrameSize = { vw, vh };

    const minDim = Math.min(vw, vh);
    const sizePx = cropRect.size * minDim;
    const sx = Math.max(0, Math.min(vw - sizePx, cropRect.cx * vw - sizePx / 2));
    const sy = Math.max(0, Math.min(vh - sizePx, cropRect.cy * vh - sizePx / 2));

    const cw = canvasEl.width, ch = canvasEl.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(videoEl, sx, sy, sizePx, sizePx, 0, 0, cw, ch);

    animFrameId = requestAnimationFrame(draw);
  };
  animFrameId = requestAnimationFrame(draw);

  canvasStream = canvasEl.captureStream(30);
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

// ── Framing: pan (drag) + zoom (pinch / wheel) ─
// The crop is ALWAYS applied (defaulting to the full centered square) so
// the published feed is never stretched. "Adjust Framing" enables drag and
// pinch directly on #host-canvas — since the canvas always shows exactly
// the current crop region, dragging/pinching visibly pans and zooms the
// image itself in real time, like a photos app.
function toggleCrop() {
  framingMode = !framingMode;
  const ws = document.getElementById('workspace');
  ws.classList.toggle('framing-mode', framingMode);
  const btn = document.getElementById('btn-toggle-framing');
  if (btn) btn.textContent = framingMode ? 'Done Adjusting' : 'Adjust Framing (Pan/Zoom)';
}

function resetCrop() {
  cropRect = { cx: 0.5, cy: 0.5, size: 1.0 };
}

// srcPxPerScreenPx: converts an on-screen CSS-pixel delta into source-video
// pixels. #host-canvas always shows a sizePx-wide square of the source
// filling its on-screen width, so this ratio is exact and needs no
// separate letterbox transform to invert.
function srcPxPerScreenPx() {
  const { vw, vh } = lastFrameSize;
  const sizePx = cropRect.size * Math.min(vw, vh);
  const canvasRect = canvasEl.getBoundingClientRect();
  return sizePx / canvasRect.width;
}

// dxPx/dyPx is the finger/cursor's raw movement in source pixels. Content
// follows the finger (like Photos/Maps), so the viewport center moves the
// OPPOSITE way — dragging right reveals what was off-screen to the left.
function panBy(dxPx, dyPx, fromCrop) {
  const { vw, vh } = lastFrameSize;
  const minDim = Math.min(vw, vh);
  const sizePx = fromCrop.size * minDim;
  const cxPx = Math.max(sizePx / 2, Math.min(vw - sizePx / 2, fromCrop.cx * vw - dxPx));
  const cyPx = Math.max(sizePx / 2, Math.min(vh - sizePx / 2, fromCrop.cy * vh - dyPx));
  cropRect.cx = cxPx / vw;
  cropRect.cy = cyPx / vh;
}

function zoomTo(newSize) {
  const { vw, vh } = lastFrameSize;
  const minDim = Math.min(vw, vh);
  // 1.0 = fully zoomed out (the full centered square — already the largest
  // non-stretched square available). Floor keeps zoom-in from collapsing
  // to an unusably tiny region.
  cropRect.size = Math.max(0.08, Math.min(1.0, newSize));
  const sizePx = cropRect.size * minDim;
  const cxPx = Math.max(sizePx / 2, Math.min(vw - sizePx / 2, cropRect.cx * vw));
  const cyPx = Math.max(sizePx / 2, Math.min(vh - sizePx / 2, cropRect.cy * vh));
  cropRect.cx = cxPx / vw;
  cropRect.cy = cyPx / vh;
}

let panState   = null; // { startX, startY, startCrop }
let pinchState = null; // { startDist, startSize }

function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function initCropDrag() {
  const c = canvasEl;
  c.addEventListener('mousedown', onFrameMouseDown);
  document.addEventListener('mousemove', onFrameMouseMove);
  document.addEventListener('mouseup', onFrameMouseUp);
  c.addEventListener('wheel', onFrameWheel, { passive: false });
  c.addEventListener('touchstart', onFrameTouchStart, { passive: false });
  c.addEventListener('touchmove', onFrameTouchMove, { passive: false });
  c.addEventListener('touchend', onFrameTouchEnd);
  c.addEventListener('touchcancel', onFrameTouchEnd);
}

function removeCropDrag() {
  const c = canvasEl;
  c.removeEventListener('mousedown', onFrameMouseDown);
  document.removeEventListener('mousemove', onFrameMouseMove);
  document.removeEventListener('mouseup', onFrameMouseUp);
  c.removeEventListener('wheel', onFrameWheel);
  c.removeEventListener('touchstart', onFrameTouchStart);
  c.removeEventListener('touchmove', onFrameTouchMove);
  c.removeEventListener('touchend', onFrameTouchEnd);
  c.removeEventListener('touchcancel', onFrameTouchEnd);
}

function onFrameMouseDown(e) {
  if (!framingMode || !lastFrameSize) return;
  panState = { startX: e.clientX, startY: e.clientY, startCrop: { ...cropRect } };
  e.preventDefault();
}
function onFrameMouseMove(e) {
  if (!panState) return;
  const px = srcPxPerScreenPx();
  panBy((e.clientX - panState.startX) * px, (e.clientY - panState.startY) * px, panState.startCrop);
}
function onFrameMouseUp() { panState = null; }

function onFrameWheel(e) {
  if (!framingMode || !lastFrameSize) return;
  e.preventDefault();
  // Scroll/trackpad-pinch down = zoom out (larger crop); up = zoom in.
  zoomTo(cropRect.size * (e.deltaY > 0 ? 1.08 : 0.92));
}

function onFrameTouchStart(e) {
  if (!framingMode || !lastFrameSize) return;
  if (e.touches.length === 2) {
    panState = null;
    pinchState = { startDist: touchDistance(e.touches), startSize: cropRect.size };
  } else if (e.touches.length === 1) {
    pinchState = null;
    const t = e.touches[0];
    panState = { startX: t.clientX, startY: t.clientY, startCrop: { ...cropRect } };
  }
  e.preventDefault();
}
function onFrameTouchMove(e) {
  if (!framingMode || !lastFrameSize) return;
  if (e.touches.length === 2 && pinchState) {
    const dist = Math.max(touchDistance(e.touches), 1);
    // Fingers moving apart (dist grows) -> zoom in (smaller crop size).
    zoomTo(pinchState.startSize * (pinchState.startDist / dist));
  } else if (e.touches.length === 1 && panState) {
    const px = srcPxPerScreenPx();
    const t = e.touches[0];
    panBy((t.clientX - panState.startX) * px, (t.clientY - panState.startY) * px, panState.startCrop);
  }
  e.preventDefault();
}
function onFrameTouchEnd(e) {
  pinchState = null;
  if (e.touches.length === 1) {
    const t = e.touches[0];
    panState = { startX: t.clientX, startY: t.clientY, startCrop: { ...cropRect } };
  } else {
    panState = null;
  }
}

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
