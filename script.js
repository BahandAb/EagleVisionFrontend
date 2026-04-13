const SIGNALING_SERVER_URL = "https://api.eaglevision.dev";

// --- EAGLE AI CONFIGURATION ---
// NOTE: Passwords are defined client-side for demo purposes. The actual authentication
// and validation happens server-side when API requests are made. These passwords are
// sent to the backend which validates them before processing AI requests.
const EAGLE_API_BASE_URL = "https://api.eaglevision.dev";
const EAGLE_BASIC_PASSWORD = "EagleDemo2026";
const EAGLE_PRO_PASSWORD = "EaglePro2026";
const EAGLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// --- STATE ---
let socket;
let livekitRoom = null; // NEW: LiveKit Room Instance
let currentRoomID = "", currentUserName = "Anonymous";
let isFrozen = false;
let currentTool = 'move';
let drawColor = '#FFD700';
let drawThickness = 6;
let annotationsHidden = false;

// ADMIN STATE
let isAdmin = false;
let currentAdminKey = "";
let latestRoster = {};
let isFollowMode = false;
let isBroadcastMode = false;
let latestSnapshotUrl = null;

// VIEW STATE
let isPhotoMode = false;

// ERASER STATE
let eraserMode = 'stroke';

// TRANSFORM STATE
let scale = 1.0;
let panX = 0, panY = 0;
let isPanning = false;
let startPanX = 0, startPanY = 0;
let lastSyncTime = 0;

// HISTORY STATE
let history = [];
let currentStroke = null;

let canvas, ctx, videoEl, photoEl, zoomLayer, viewport, statusTag;

window.onload = function () {
    if (typeof initImageProcessor === 'function') initImageProcessor();

    const code = sessionStorage.getItem("eagleSessionCode");
    const name = sessionStorage.getItem("eagleUserName");

    // Redirect if direct access without code
    if (!code) { window.location.href = "index.html"; return; }

    currentRoomID = code;
    currentUserName = name || "Anonymous";

    document.getElementById("displaySessionCode").innerText = currentRoomID;

    videoEl = document.getElementById("remoteVideo");
    photoEl = document.getElementById("staticPhoto");
    canvas = document.getElementById("annotationCanvas");
    zoomLayer = document.getElementById("zoomLayer");
    viewport = document.getElementById("viewportContainer");
    statusTag = document.getElementById("statusTag");
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initSidebarResize();

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseout', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    startConnection();
    updateTransform();
    updateEraserIcon();
};

// --- SIDEBAR RESIZE (DESKTOP ONLY) ---
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 520;

function clampSidebarWidth(width) {
    return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
}

function applySidebarWidth(width) {
    const clamped = clampSidebarWidth(width);
    document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
    localStorage.setItem('eagleSidebarWidth', String(clamped));
    resizeCanvas();
}

function initSidebarResize() {
    const sidePanel = document.getElementById('sidePanel');
    const resizer = document.getElementById('sidebarResizer');
    const layout = document.querySelector('.main-layout');
    const activityBar = document.querySelector('.activity-bar');

    if (!sidePanel || !resizer || !layout) return;

    const storedWidth = parseInt(localStorage.getItem('eagleSidebarWidth') || '', 10);
    if (!Number.isNaN(storedWidth) && window.innerWidth > 900) {
        applySidebarWidth(storedWidth);
    }

    let isDragging = false;

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const layoutRect = layout.getBoundingClientRect();
        const activityWidth = activityBar ? activityBar.getBoundingClientRect().width : 0;
        const newWidth = e.clientX - layoutRect.left - activityWidth;
        applySidebarWidth(newWidth);
    };

    const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.classList.remove('resizing-sidebar');
        resizer.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stopDrag);
    };

    resizer.addEventListener('mousedown', (e) => {
        if (window.innerWidth <= 900) return;
        if (sidePanel.classList.contains('collapsed')) return;
        e.preventDefault();
        isDragging = true;
        document.body.classList.add('resizing-sidebar');
        resizer.classList.add('dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDrag);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 900) return;
        const width = parseInt(localStorage.getItem('eagleSidebarWidth') || '', 10);
        if (!Number.isNaN(width)) applySidebarWidth(width);
    });
}

function leaveSession() {
    if (livekitRoom) livekitRoom.disconnect();
    sessionStorage.clear();
    window.location.href = "index.html";
}

// --- SNAPSHOT LOGIC ---
function takeSnapshot() {
    const snapCanvas = getAdjustedCanvas({ cropToSquare: true });
    if (!snapCanvas) return alert("No snapshot source available yet.");
    const size = snapCanvas.width;
    const sCtx = snapCanvas.getContext('2d');

    // 2. Save CLEAN version for Broadcasting
    latestSnapshotUrl = snapCanvas.toDataURL('image/jpeg', 0.6);

    // 3. Draw Annotations on top (for Local Gallery only)
    if (!annotationsHidden) {
        sCtx.save();
        sCtx.drawImage(canvas, 0, 0, size, size);
        sCtx.restore();
    }

    // 4. Save ANNOTATED version to Gallery
    const galleryUrl = snapCanvas.toDataURL('image/jpeg', 0.6);
    addToGallery(galleryUrl);

    const f = document.createElement('div'); f.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:white;opacity:1;transition:opacity 0.2s';
    viewport.appendChild(f); setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.remove(), 200); }, 50);
}

function broadcastLastSnapshot() {
    if (!latestSnapshotUrl) return alert("No snapshot taken yet!");
    if (confirm("Broadcast the last taken snapshot to all students?")) {
        socket.emit('admin_broadcast_image', { room: currentRoomID, image: latestSnapshotUrl });
    }
}

// --- ADMIN FEATURES ---
function attemptAdminLogin() {
    const key = document.getElementById("adminKeyInput").value.trim();
    if (!key) return alert("Enter Admin Key");
    currentAdminKey = key;
    socket.emit('admin_login', { room: currentRoomID, key: key });
}
function kickUser(sid) { if (confirm("Kick this student?")) socket.emit('kick_student', { room: currentRoomID, key: currentAdminKey, target_sid: sid }); }
function triggerRequestPhoto() { if (!isAdmin) return; socket.emit('admin_trigger_photo', { room: currentRoomID, key: currentAdminKey }); alert("Requesting High-Res Photo..."); }
function triggerReturnLive() { if (!isAdmin) return; socket.emit('admin_return_live', { room: currentRoomID, key: currentAdminKey }); }
function toggleFollowMode() { isFollowMode = document.getElementById("checkFollowMode").checked; if (isFollowMode) broadcastViewSync(); }
function toggleBroadcastMode() { isBroadcastMode = document.getElementById("checkBroadcast").checked; }
function adminClearAll() { if (confirm("Erase all screens?")) { socket.emit('admin_clear_all', { room: currentRoomID, key: currentAdminKey }); clearAnnotations(); } }
function broadcastViewSync() {
    if (!isAdmin || !isFollowMode) return;
    const now = Date.now(); if (now - lastSyncTime < 100) return; lastSyncTime = now;
    socket.emit('admin_sync_view', { room: currentRoomID, panX: panX, panY: panY, scale: scale });
}

// --- VIEW MODES ---
function enterPhotoMode(imageUrl) {
    isPhotoMode = true;
    videoEl.style.display = 'none';
    photoEl.style.display = 'block';
    photoEl.src = imageUrl;
    statusTag.innerText = "● PHOTO MODE"; statusTag.style.display = "block"; statusTag.style.background = "#44FF44";
    if (isAdmin) { document.getElementById('btnModeLive').classList.remove('active'); document.getElementById('btnModePhoto').classList.add('active'); }
    scale = 1.0; panX = 0; panY = 0; updateTransform(); resizeCanvas();
}
function enterLiveMode() {
    isPhotoMode = false;
    photoEl.style.display = 'none';
    videoEl.style.display = 'block';
    statusTag.innerText = "● LIVE (HC)"; statusTag.style.display = "block"; statusTag.style.background = "#ff4444";
    if (isAdmin) { document.getElementById('btnModePhoto').classList.remove('active'); document.getElementById('btnModeLive').classList.add('active'); }
}

function renderRoster() {
    const list = document.getElementById("studentRosterList"); const count = document.getElementById("studentCount");
    list.innerHTML = ""; let c = 0;
    for (const [sid, user] of Object.entries(latestRoster)) {
        c++; const isMe = (sid === socket.id);
        let html = `<span style="color:${isMe ? '#FFD700' : '#ddd'}">${user.name}</span>`;
        if (user.role === 'admin') html += ` <span class="material-icons" style="font-size:14px;color:#FFD700">verified</span>`;
        let btn = ""; if (isAdmin && !isMe) btn = `<button class="btn-kick" onclick="kickUser('${sid}')">KICK</button>`;
        const item = document.createElement("div"); item.className = "roster-item"; item.innerHTML = `<div>${html}</div>${btn}`; list.appendChild(item);
    }
    count.innerText = `(${c})`;
}

// --- UI HELPERS ---
function togglePanel(panelId) {
    const panels = document.querySelectorAll('.panel-content'); const sidePanel = document.getElementById('sidePanel');
    let isOpening = true;
    panels.forEach(p => { if (p.id === 'panel-' + panelId) { if (p.classList.contains('active')) isOpening = false; p.classList.toggle('active'); } else { p.classList.remove('active'); } });
    document.querySelectorAll('.activity-icon').forEach(i => i.classList.remove('active'));
    if (isOpening) { sidePanel.classList.remove('collapsed'); document.querySelector(`.activity-icon[onclick="togglePanel('${panelId}')"]`).classList.add('active'); } else { sidePanel.classList.add('collapsed'); }
}
function setTool(tool) {
    if (tool === 'eraser' && currentTool === 'eraser') { eraserMode = (eraserMode === 'normal') ? 'stroke' : 'normal'; updateEraserIcon(); return; }
    currentTool = tool; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btnTool' + tool.charAt(0).toUpperCase() + tool.slice(1)); if (btn) btn.classList.add('active');
    if (tool === 'eraser') { updateEraserIcon(); canvas.style.cursor = 'crosshair'; }
    else { canvas.style.cursor = (tool === 'move') ? 'grab' : (tool === 'text') ? 'text' : 'crosshair'; }
}
function updateEraserIcon() { const icon = document.querySelector('#btnToolEraser span'); if (icon) icon.innerText = (eraserMode === 'normal') ? 'cleaning_services' : 'delete_sweep'; }
function setColor(c, el) { drawColor = c; document.querySelectorAll('.color-swatch').forEach(e => e.classList.remove('active')); el.classList.add('active'); }
function setThickness(t, el) { drawThickness = t; document.querySelectorAll('.thickness-btn').forEach(e => e.classList.remove('active')); el.classList.add('active'); }

// --- MATH ---
function getLocalPos(e) { const rect = canvas.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale }; }
function clampPan() {
    const cW = viewport.offsetWidth; const cH = viewport.offsetHeight;
    const contentW = cW * scale; const contentH = cH * scale;
    const minX = cW - contentW; const minY = cH - contentH;
    if (minX > 0) panX = 0; else panX = Math.max(minX, Math.min(0, panX));
    if (minY > 0) panY = 0; else panY = Math.max(minY, Math.min(0, panY));
}
function updateTransform() { if (zoomLayer) zoomLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }

// --- INPUT ---
function handleStart(e) {
    if (annotationsHidden) return;
    if (e.touches) { if (e.touches.length > 1) return; e.preventDefault(); }
    const pos = getLocalPos(e);
    if (currentTool === 'move') { isPanning = true; canvas.style.cursor = 'grabbing'; startPanX = (e.touches ? e.touches[0].clientX : e.clientX) - panX; startPanY = (e.touches ? e.touches[0].clientY : e.clientY) - panY; }
    else if (currentTool === 'draw') { currentStroke = { type: 'stroke', color: drawColor, width: drawThickness, points: [{ x: pos.x, y: pos.y }] }; history.push(currentStroke); redrawCanvas(); }
    else if (currentTool === 'eraser') { if (eraserMode === 'normal') { currentStroke = { type: 'stroke', color: 'eraser', width: drawThickness * 5, points: [{ x: pos.x, y: pos.y }] }; history.push(currentStroke); redrawCanvas(); } else checkStrokeHit(pos); }
    else if (currentTool === 'count') {
        let hitIndex = -1; for (let i = history.length - 1; i >= 0; i--) { if (history[i].type === 'dot') { const dx = history[i].x - pos.x; const dy = history[i].y - pos.y; if (Math.sqrt(dx * dx + dy * dy) < 15 / scale) { hitIndex = i; break; } } }
        if (hitIndex !== -1) history.splice(hitIndex, 1); else { const dot = { type: 'dot', x: pos.x, y: pos.y, color: drawColor }; history.push(dot); if (isAdmin && isBroadcastMode) socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: dot }); }
        redrawCanvas();
    } else if (currentTool === 'text') {
        openTextModal(pos.x, pos.y);
    }
}
function handleMove(e) {
    if (e.touches) e.preventDefault();
    if (currentTool === 'move' && isPanning) { const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; panX = cx - startPanX; panY = cy - startPanY; clampPan(); updateTransform(); broadcastViewSync(); }
    else if (currentTool === 'draw' && currentStroke) { const pos = getLocalPos(e); currentStroke.points.push({ x: pos.x, y: pos.y }); redrawCanvas(); }
    else if (currentTool === 'eraser') { const pos = getLocalPos(e); if (eraserMode === 'normal' && currentStroke) { currentStroke.points.push({ x: pos.x, y: pos.y }); redrawCanvas(); } else if (eraserMode === 'stroke') checkStrokeHit(pos); }
}
function handleEnd() { isPanning = false; if (currentTool === 'move') canvas.style.cursor = 'grab'; if (currentStroke && isAdmin && isBroadcastMode) socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: currentStroke }); currentStroke = null; }
function checkStrokeHit(pos) { const hitRadius = 10 / scale; let didRemove = false; for (let i = history.length - 1; i >= 0; i--) { const item = history[i]; if (item.type === 'stroke' && item.color !== 'eraser') { for (let pt of item.points) { const dx = pt.x - pos.x; const dy = pt.y - pos.y; if (Math.sqrt(dx * dx + dy * dy) < hitRadius) { history.splice(i, 1); didRemove = true; break; } } } } if (didRemove) redrawCanvas(); }
function handleWheel(e) { e.preventDefault(); const rect = viewport.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const worldX = (mouseX - panX) / scale; const worldY = (mouseY - panY) / scale; const dir = e.deltaY > 0 ? -1 : 1; scale = Math.min(Math.max(1.0, scale + (dir * 0.1 * scale)), 5.0); panX = mouseX - worldX * scale; panY = mouseY - worldY * scale; clampPan(); updateTransform(); broadcastViewSync(); }

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); let dotCount = 0;
    history.forEach(item => {
        if (item.type === 'stroke') { ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = item.width; ctx.globalCompositeOperation = (item.color === 'eraser') ? 'destination-out' : 'source-over'; if (item.color !== 'eraser') ctx.strokeStyle = item.color; if (item.points.length > 0) { ctx.moveTo(item.points[0].x, item.points[0].y); for (let i = 1; i < item.points.length; i++) ctx.lineTo(item.points[i].x, item.points[i].y); } ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
        else if (item.type === 'dot') { dotCount++; ctx.beginPath(); ctx.arc(item.x, item.y, 10, 0, 2 * Math.PI); ctx.fillStyle = item.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke(); ctx.fillStyle = "black"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(dotCount, item.x, item.y); }
        else if (item.type === 'text') { ctx.font = `bold ${item.size}px Arial`; ctx.fillStyle = item.color; ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.strokeText(item.text, item.x, item.y); ctx.fillText(item.text, item.x, item.y); }
    });
    const badge = document.getElementById('countBadge'); if (badge) { badge.innerText = dotCount; badge.style.display = dotCount > 0 ? 'flex' : 'none'; }
}
function resizeCanvas() { canvas.width = viewport.offsetWidth; canvas.height = viewport.offsetHeight; redrawCanvas(); }
function clearAnnotations() { history = []; redrawCanvas(); }
function toggleAnnotationVisibility() { annotationsHidden = !annotationsHidden; canvas.style.opacity = annotationsHidden ? '0' : '1'; canvas.style.pointerEvents = annotationsHidden ? 'none' : 'auto'; }
function addToGallery(url) { const d = document.createElement('div'); d.style.cssText = `height: 100px; background-image: url('${url}'); background-size: cover; background-position: center; border-radius: 6px; border: 1px solid #444; cursor: pointer;`; d.onclick = () => { document.getElementById('modalImage').src = url; document.getElementById('modalDownload').href = url; document.getElementById('photoModal').style.display = 'flex'; }; document.getElementById('galleryGrid').prepend(d); }

// --- CONNECTION LOGIC ---
function startConnection() {
    // FIX: Add transports option to allow Polling (Firewall Bypass)
    socket = io(SIGNALING_SERVER_URL, {
        transports: ['polling', 'websocket']
    });

    // VALIDATION HANDLER
    socket.on('join_error', (data) => {
        alert(data.message);
        window.location.href = "index.html";
    });

    socket.on("connect", () => { socket.emit("join_room", { room: currentRoomID, username: currentUserName }); });
    socket.on("session_ended", () => { alert("Session Ended"); leaveSession(); });
    socket.on("kicked", () => { alert("You were kicked."); leaveSession(); });
    socket.on("admin_access_granted", () => { isAdmin = true; alert("Host Access Granted!"); document.getElementById("adminLoginForm").style.display = 'none'; document.getElementById("adminControlsArea").style.display = 'block'; renderRoster(); });
    socket.on("admin_access_denied", () => alert("Invalid Key"));
    socket.on("roster_update", (r) => { latestRoster = r; renderRoster(); });
    socket.on("sync_view_command", (data) => { panX = data.panX; panY = data.panY; scale = data.scale; updateTransform(); });
    socket.on("receive_broadcast_stroke", (stroke) => { history.push(stroke); redrawCanvas(); });
    socket.on("receive_clear_command", () => { clearAnnotations(); });
    socket.on("receive_broadcast_image", (imgData) => { enterPhotoMode(imgData); alert("Instructor switched to Photo Mode"); });
    socket.on("return_to_live", () => { enterLiveMode(); alert("Instructor switched to Live Mode"); });

    // NEW: Listen for the Video Ticket (LiveKit)
    socket.on("livekit_token", async (data) => {
        console.log("Connecting to Video Server...", data.url);
        console.log("Token received (first 20 chars):", data.token.substring(0, 20) + "...");

        livekitRoom = new LivekitClient.Room({
            adaptiveStream: true,
            dynacast: true
        });

        // Listen for participant connected
        livekitRoom.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
            console.log("👤 Participant connected:", participant.identity);
        });

        // Listen for track published (not subscribed yet)
        livekitRoom.on(LivekitClient.RoomEvent.TrackPublished, (publication, participant) => {
            console.log("📤 Track published:", publication.kind, "from", participant.identity);
            console.log("Publication details:", publication);
        });

        // When a video track arrives, show it
        livekitRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log("📥 Track subscribed:", track.kind, "from", participant.identity);
            if (track.kind === LivekitClient.Track.Kind.Video) {
                const videoElement = document.getElementById("remoteVideo");
                track.attach(videoElement);
                console.log("✅ Video track attached to element");
                if (!isPhotoMode) {
                    statusTag.style.display = "block";
                    statusTag.innerText = "● LIVE (HC)";
                    statusTag.style.background = "#ff4444";
                }
                setTimeout(resizeCanvas, 500);
            }
        });

        // Connect using the ticket
        try {
            await livekitRoom.connect(data.url, data.token);
            console.log("✅ LiveKit room connected successfully");
            console.log("Room state:", livekitRoom.state);
            console.log("Local participant:", livekitRoom.localParticipant.identity);
            console.log("Remote participants:", livekitRoom.participants.size);

            // Check existing participants and their tracks
            livekitRoom.remoteParticipants.forEach((participant, identity) => {
                console.log("Found participant:", identity);
                console.log("  Video tracks:", participant.videoTracks.size);
                console.log("  Audio tracks:", participant.audioTracks.size);

                // Try to manually subscribe to video tracks
                participant.videoTracks.forEach((publication, trackSid) => {
                    console.log("  Video track SID:", trackSid, "subscribed:", publication.isSubscribed);
                });
            });
        } catch (error) {
            console.error("❌ LiveKit connection failed:", error);
            console.error("Error message:", error.message);
        }
    });
}

function toggleFreeze() { isFrozen = !isFrozen; if (isFrozen) { videoEl.pause(); document.getElementById('iconFreeze').innerText = "play_arrow"; } else { videoEl.play(); document.getElementById('iconFreeze').innerText = "pause"; } }
function closeModal() { document.getElementById('photoModal').style.display = 'none'; }

let pendingTextPosition = null;

function openTextModal(x, y) {
    pendingTextPosition = { x, y };
    const modal = document.getElementById('textModal');
    const input = document.getElementById('textInput');
    modal.style.display = 'flex';
    input.value = '';
    input.focus();

    // Allow Enter key to submit
    input.onkeydown = (e) => {
        if (e.key === 'Enter') confirmTextInput();
        if (e.key === 'Escape') cancelTextInput();
    };
}

function confirmTextInput() {
    const input = document.getElementById('textInput');
    const text = input.value.trim();

    if (text && pendingTextPosition) {
        const txtObj = {
            type: 'text',
            x: pendingTextPosition.x,
            y: pendingTextPosition.y,
            text: text,
            color: drawColor,
            size: 20
        };
        history.push(txtObj);

        if (isAdmin && isBroadcastMode) {
            socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: txtObj });
        }

        redrawCanvas();
    }

    cancelTextInput();
}

function cancelTextInput() {
    document.getElementById('textModal').style.display = 'none';
    pendingTextPosition = null;
}

// ==========================================
// EAGLE AI SYSTEM
// ==========================================

// Eagle AI State Management
let eagleAITier = null; // null, 'basic', or 'pro'
let eaglePassword = null;
let savedAnalyses = JSON.parse(localStorage.getItem('eagleAnalyses') || '[]');
let eagleSessionTimeout;
const EAGLE_DEFAULT_PLACEHOLDER = 'Enter access code';
const EAGLE_PRO_PLACEHOLDER = 'Enter Pro access code';

function setEaglePasswordPlaceholder(text) {
    const passwordInput = document.getElementById('eaglePasswordInput');
    if (passwordInput) passwordInput.placeholder = text;
}

function lockEagleAI() {
    eagleAITier = null;
    eaglePassword = null;
    clearTimeout(eagleSessionTimeout);

    const errorDiv = document.getElementById('eagle-error');
    const passwordEntry = document.getElementById('eagle-password-entry');
    const basicTier = document.getElementById('eagle-basic-tier');
    const proTier = document.getElementById('eagle-pro-tier');
    const results = document.getElementById('eagle-results');
    const passwordInput = document.getElementById('eaglePasswordInput');

    if (passwordEntry) passwordEntry.style.display = 'block';
    if (basicTier) basicTier.style.display = 'none';
    if (proTier) proTier.style.display = 'none';
    if (results) results.style.display = 'none';
    if (passwordInput) passwordInput.value = '';
    if (errorDiv) errorDiv.style.display = 'none';
    setEaglePasswordPlaceholder(EAGLE_DEFAULT_PLACEHOLDER);
}

// Unlock Eagle AI with password
function unlockEagleAI() {
    const password = document.getElementById('eaglePasswordInput').value.trim();
    const errorDiv = document.getElementById('eagle-error');

    // Always start from locked state before validating
    lockEagleAI();

    if (password === EAGLE_BASIC_PASSWORD) {
        eagleAITier = 'basic';
        eaglePassword = password;
        document.getElementById('eagle-password-entry').style.display = 'none';
        document.getElementById('eagle-basic-tier').style.display = 'block';
        errorDiv.style.display = 'none';
        resetEagleSession();
    } else if (password === EAGLE_PRO_PASSWORD) {
        eagleAITier = 'pro';
        eaglePassword = password;
        document.getElementById('eagle-password-entry').style.display = 'none';
        document.getElementById('eagle-pro-tier').style.display = 'block';
        errorDiv.style.display = 'none';
        resetEagleSession();

        // Add character counter for custom questions
        const customQuestionInput = document.getElementById('customQuestionInput');
        if (customQuestionInput && !customQuestionInput.dataset.listenerBound) {
            customQuestionInput.addEventListener('input', updateCharCount);
            customQuestionInput.dataset.listenerBound = 'true';
        }
    } else {
        errorDiv.textContent = '❌ Invalid access code';
        errorDiv.style.display = 'block';
    }
}

// Update character count for custom questions
function updateCharCount() {
    const textarea = document.getElementById('customQuestionInput');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        charCount.textContent = textarea.value.length;
    }
}

// Upgrade from Basic to Pro
function upgradeToPro() {
    document.getElementById('eagle-basic-tier').style.display = 'none';
    document.getElementById('eagle-password-entry').style.display = 'block';
    document.getElementById('eaglePasswordInput').value = '';
    setEaglePasswordPlaceholder(EAGLE_PRO_PLACEHOLDER);
    const errorDiv = document.getElementById('eagle-error');
    if (errorDiv) errorDiv.style.display = 'none';
    const results = document.getElementById('eagle-results');
    if (results) results.style.display = 'none';
}

// Session timeout for security (30 minutes)
function resetEagleSession() {
    clearTimeout(eagleSessionTimeout);
    eagleSessionTimeout = setTimeout(() => {
        lockEagleAI();
        alert('Session expired. Please re-enter your access code.');
    }, EAGLE_SESSION_TIMEOUT_MS);
}

// Unified Analyze (Basic & Pro)
async function analyzeSpecimen() {
    if (!eaglePassword) return;

    const groupName = eagleAITier === 'pro' ? 'eagleModePro' : 'eagleModeBasic';
    const selected = document.querySelector(`input[name="${groupName}"]:checked`);
    const mode = selected ? selected.value : 'standard';

    if (mode === 'detailed' && eagleAITier !== 'pro') {
        displayEagleError('Detailed mode requires Pro access.');
        return;
    }

    const imageData = captureCurrentFrame();
    if (!imageData) {
        alert('No image available. Please wait for video feed.');
        return;
    }

    const loadingLabel = mode === 'quick' ? 'Running quick analysis...' : mode === 'detailed' ? 'Performing detailed analysis...' : 'Analyzing specimen...';
    showLoadingState(loadingLabel);
    resetEagleSession(); // Reset timeout on activity

    try {
        const response = await fetch(`${EAGLE_API_BASE_URL}/api/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: eaglePassword,
                image: imageData.split(',')[1],
                mode: mode
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            displayEagleResults(result.response, mode);
        } else {
            displayEagleError(result.error || 'Analysis failed');
        }
    } catch (error) {
        displayEagleError('Network error: ' + error.message);
    }
}

// Custom Question (Pro only)
async function askCustomQuestion() {
    if (eagleAITier !== 'pro') return;

    const question = document.getElementById('customQuestionInput').value.trim();
    if (!question) {
        alert('Please enter a question.');
        return;
    }

    const imageData = captureCurrentFrame();
    if (!imageData) {
        alert('No image available.');
        return;
    }

    showLoadingState('Processing your question...');
    resetEagleSession(); // Reset timeout on activity

    try {
        const response = await fetch(`${EAGLE_API_BASE_URL}/api/ai/custom-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: eaglePassword,
                image: imageData.split(',')[1],
                question: question
            })
        });

        const result = await response.json();

        if (response.ok) {
            displayEagleResults(result.description, 'Custom Analysis');
            document.getElementById('customQuestionInput').value = '';
            updateCharCount();
        } else {
            displayEagleError(result.error || 'Analysis failed');
        }
    } catch (error) {
        displayEagleError('Network error: ' + error.message);
    }
}

// Display results with markdown support
function displayEagleResults(text, analysisType) {
    const resultsDiv = document.getElementById('eagle-results');
    const responseDiv = document.getElementById('eagle-response');

    // Convert markdown-style formatting to HTML
    let formattedText = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    const label = analysisType === 'quick' ? 'Quick ID' : analysisType === 'detailed' ? 'Detailed Analysis' : analysisType === 'standard' ? 'Standard Analysis' : analysisType;
    responseDiv.innerHTML = `<div class="analysis-type">${label}</div>${formattedText}`;
    responseDiv.classList.toggle('compact', analysisType === 'quick');
    resultsDiv.style.display = 'block';

    // Save to history
    savedAnalyses.unshift({
        timestamp: new Date().toISOString(),
        type: analysisType,
        result: text
    });
    if (savedAnalyses.length > 50) savedAnalyses = savedAnalyses.slice(0, 50);
    localStorage.setItem('eagleAnalyses', JSON.stringify(savedAnalyses));
}

function displayEagleError(message) {
    const resultsDiv = document.getElementById('eagle-results');
    const responseDiv = document.getElementById('eagle-response');
    responseDiv.innerHTML = `<div class="error-message">❌ ${message}</div>`;
    resultsDiv.style.display = 'block';
}

function showLoadingState(message) {
    const resultsDiv = document.getElementById('eagle-results');
    const responseDiv = document.getElementById('eagle-response');
    responseDiv.innerHTML = `<div class="loading-state">⏳ ${message}</div>`;
    resultsDiv.style.display = 'block';
}

// Copy results to clipboard
function copyResults() {
    const responseDiv = document.getElementById('eagle-response');
    const text = responseDiv.innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('✓ Copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Failed to copy. Please try again.');
    });
}

// Save results as text file
function saveResults() {
    const responseDiv = document.getElementById('eagle-response');
    const text = responseDiv.innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eagle-ai-analysis-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Capture current frame from video or canvas
function captureCurrentFrame() {
    const adjustedCanvas = getAdjustedCanvas({ cropToSquare: true });
    if (!adjustedCanvas) return null;
    return adjustedCanvas.toDataURL('image/jpeg', 0.9);
}

function getCurrentAdjustments() {
    if (typeof adjustments !== 'undefined' && adjustments) return adjustments;
    return { r: 100, g: 100, b: 100, brightness: 100, contrast: 100, saturation: 100, rotate: 0, flipH: 1, flipV: 1 };
}

function getSourceElement() {
    const photo = document.getElementById('staticPhoto');
    const video = document.getElementById('remoteVideo');
    if (photo && photo.style.display !== 'none') return photo;
    return video;
}

function getSourceDimensions(source) {
    if (!source) return null;
    if (source.tagName === 'IMG') {
        const w = source.naturalWidth || source.width || 1920;
        const h = source.naturalHeight || source.height || 1080;
        return { width: w, height: h };
    }
    if (source.tagName === 'VIDEO') {
        if (source.videoWidth > 0 && source.videoHeight > 0) {
            return { width: source.videoWidth, height: source.videoHeight };
        }
    }
    return null;
}

function applyRgbAdjustments(canvas, adj) {
    if (!canvas) return;
    const rMul = (adj.r ?? 100) / 100;
    const gMul = (adj.g ?? 100) / 100;
    const bMul = (adj.b ?? 100) / 100;
    if (rMul === 1 && gMul === 1 && bMul === 1) return;

    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * rMul);
        data[i + 1] = Math.min(255, data[i + 1] * gMul);
        data[i + 2] = Math.min(255, data[i + 2] * bMul);
    }
    ctx.putImageData(img, 0, 0);
}

function drawAdjustedSourceToCanvas(source, width, height) {
    const adj = getCurrentAdjustments();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.filter = `brightness(${adj.brightness ?? 100}%) contrast(${adj.contrast ?? 100}%) saturate(${adj.saturation ?? 100}%)`;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const radians = ((adj.rotate ?? 0) * Math.PI) / 180;
    ctx.rotate(radians);
    ctx.scale(adj.flipH ?? 1, adj.flipV ?? 1);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    ctx.restore();
    ctx.filter = 'none';

    applyRgbAdjustments(canvas, adj);
    return canvas;
}

function getAdjustedCanvas({ cropToSquare } = {}) {
    const source = getSourceElement();
    const dims = getSourceDimensions(source);
    if (!source || !dims) return null;

    const baseCanvas = drawAdjustedSourceToCanvas(source, dims.width, dims.height);
    if (!cropToSquare) return baseCanvas;

    const size = Math.min(dims.width, dims.height);
    const cropped = document.createElement('canvas');
    cropped.width = size;
    cropped.height = size;
    const ctx = cropped.getContext('2d');
    ctx.drawImage(
        baseCanvas,
        (dims.width - size) / 2,
        (dims.height - size) / 2,
        size,
        size,
        0,
        0,
        size,
        size
    );
    return cropped;
}
