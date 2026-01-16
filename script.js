const SIGNALING_SERVER_URL = "https://eaglevisionbackend-go8c.onrender.com"; 

// --- STATE ---
let socket;
let livekitRoom = null; // NEW: LiveKit Room Instance
let currentRoomID = "", currentUserName = "Anonymous";
let isFrozen = false;
let currentTool = 'move'; 
let drawColor = '#FFD700';
let drawThickness = 2;
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
let eraserMode = 'normal'; 

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

window.onload = function() {
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
    
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseout', handleEnd);
    canvas.addEventListener('touchstart', handleStart, {passive: false});
    canvas.addEventListener('touchmove', handleMove, {passive: false});
    canvas.addEventListener('touchend', handleEnd);
    viewport.addEventListener('wheel', handleWheel, {passive: false});

    startConnection();
    updateTransform();
};

function leaveSession() { 
    if(livekitRoom) livekitRoom.disconnect();
    sessionStorage.clear(); 
    window.location.href = "index.html"; 
}

// --- SNAPSHOT LOGIC ---
function takeSnapshot() {
    const sW = videoEl.videoWidth || 1280; const sH = videoEl.videoHeight || 720;
    const size = Math.min(sW, sH);
    const snapCanvas = document.createElement('canvas'); snapCanvas.width = size; snapCanvas.height = size;
    const sCtx = snapCanvas.getContext('2d');
    
    // 1. Draw Feed (Video or Photo)
    if (isPhotoMode) {
        sCtx.drawImage(photoEl, 0, 0, size, size);
    } else {
        sCtx.drawImage(videoEl, (sW-size)/2, (sH-size)/2, size, size, 0, 0, size, size);
    }

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
    viewport.appendChild(f); setTimeout(() => { f.style.opacity = '0'; setTimeout(()=>f.remove(), 200); }, 50);
}

function broadcastLastSnapshot() {
    if (!latestSnapshotUrl) return alert("No snapshot taken yet!");
    if(confirm("Broadcast the last taken snapshot to all students?")) {
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
function kickUser(sid) { if(confirm("Kick this student?")) socket.emit('kick_student', { room: currentRoomID, key: currentAdminKey, target_sid: sid }); }
function triggerRequestPhoto() { if(!isAdmin) return; socket.emit('admin_trigger_photo', { room: currentRoomID, key: currentAdminKey }); alert("Requesting High-Res Photo..."); }
function triggerReturnLive() { if(!isAdmin) return; socket.emit('admin_return_live', { room: currentRoomID, key: currentAdminKey }); }
function toggleFollowMode() { isFollowMode = document.getElementById("checkFollowMode").checked; if (isFollowMode) broadcastViewSync(); }
function toggleBroadcastMode() { isBroadcastMode = document.getElementById("checkBroadcast").checked; }
function adminClearAll() { if(confirm("Erase all screens?")) { socket.emit('admin_clear_all', { room: currentRoomID, key: currentAdminKey }); clearAnnotations(); } }
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
    if(isAdmin) { document.getElementById('btnModeLive').classList.remove('active'); document.getElementById('btnModePhoto').classList.add('active'); }
    scale = 1.0; panX = 0; panY = 0; updateTransform(); resizeCanvas();
}
function enterLiveMode() {
    isPhotoMode = false;
    photoEl.style.display = 'none';
    videoEl.style.display = 'block';
    statusTag.innerText = "● LIVE (HC)"; statusTag.style.display = "block"; statusTag.style.background = "#ff4444";
    if(isAdmin) { document.getElementById('btnModePhoto').classList.remove('active'); document.getElementById('btnModeLive').classList.add('active'); }
}

function renderRoster() {
    const list = document.getElementById("studentRosterList"); const count = document.getElementById("studentCount");
    list.innerHTML = ""; let c = 0;
    for (const [sid, user] of Object.entries(latestRoster)) {
        c++; const isMe = (sid === socket.id);
        let html = `<span style="color:${isMe?'#FFD700':'#ddd'}">${user.name}</span>`;
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
    panels.forEach(p => { if(p.id === 'panel-' + panelId) { if (p.classList.contains('active')) isOpening = false; p.classList.toggle('active'); } else { p.classList.remove('active'); } });
    document.querySelectorAll('.activity-icon').forEach(i => i.classList.remove('active'));
    if (isOpening) { sidePanel.classList.remove('collapsed'); document.querySelector(`.activity-icon[onclick="togglePanel('${panelId}')"]`).classList.add('active'); } else { sidePanel.classList.add('collapsed'); }
}
function setTool(tool) {
    if (tool === 'eraser' && currentTool === 'eraser') { eraserMode = (eraserMode === 'normal') ? 'stroke' : 'normal'; updateEraserIcon(); return; }
    currentTool = tool; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btnTool' + tool.charAt(0).toUpperCase() + tool.slice(1)); if(btn) btn.classList.add('active');
    if (tool === 'eraser') { updateEraserIcon(); canvas.style.cursor = 'crosshair'; }
    else { const icon = document.querySelector('#btnToolEraser span'); if(icon) icon.innerText = 'auto_fix_normal'; canvas.style.cursor = (tool === 'move') ? 'grab' : (tool === 'text') ? 'text' : 'crosshair'; }
}
function updateEraserIcon() { const icon = document.querySelector('#btnToolEraser span'); if(icon) icon.innerText = (eraserMode === 'normal') ? 'auto_fix_normal' : 'delete_sweep'; }
function setColor(c, el) { drawColor = c; document.querySelectorAll('.color-swatch').forEach(e=>e.classList.remove('active')); el.classList.add('active'); }
function setThickness(t, el) { drawThickness = t; document.querySelectorAll('.thickness-btn').forEach(e=>e.classList.remove('active')); el.classList.add('active'); }

// --- MATH ---
function getLocalPos(e) { const rect = canvas.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale }; }
function clampPan() {
    const cW = viewport.offsetWidth; const cH = viewport.offsetHeight;
    const contentW = cW * scale; const contentH = cH * scale;
    const minX = cW - contentW; const minY = cH - contentH;
    if (minX > 0) panX = 0; else panX = Math.max(minX, Math.min(0, panX));
    if (minY > 0) panY = 0; else panY = Math.max(minY, Math.min(0, panY));
}
function updateTransform() { if(zoomLayer) zoomLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }

// --- INPUT ---
function handleStart(e) {
    if (annotationsHidden) return;
    if (e.touches) { if (e.touches.length > 1) return; e.preventDefault(); }
    const pos = getLocalPos(e);
    if (currentTool === 'move') { isPanning = true; canvas.style.cursor = 'grabbing'; startPanX = (e.touches?e.touches[0].clientX:e.clientX)-panX; startPanY = (e.touches?e.touches[0].clientY:e.clientY)-panY; } 
    else if (currentTool === 'draw') { currentStroke = { type: 'stroke', color: drawColor, width: drawThickness, points: [{x: pos.x, y: pos.y}] }; history.push(currentStroke); redrawCanvas(); }
    else if (currentTool === 'eraser') { if (eraserMode === 'normal') { currentStroke = { type: 'stroke', color: 'eraser', width: drawThickness * 5, points: [{x: pos.x, y: pos.y}] }; history.push(currentStroke); redrawCanvas(); } else checkStrokeHit(pos); }
    else if (currentTool === 'count') {
        let hitIndex = -1; for (let i = history.length - 1; i >= 0; i--) { if (history[i].type === 'dot') { const dx = history[i].x - pos.x; const dy = history[i].y - pos.y; if (Math.sqrt(dx*dx + dy*dy) < 15/scale) { hitIndex = i; break; } } }
        if (hitIndex !== -1) history.splice(hitIndex, 1); else { const dot = { type: 'dot', x: pos.x, y: pos.y, color: drawColor }; history.push(dot); if (isAdmin && isBroadcastMode) socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: dot }); }
        redrawCanvas();
    } else if (currentTool === 'text') { setTimeout(() => { const text = prompt("Enter text annotation:"); if (text) { const txtObj = { type: 'text', x: pos.x, y: pos.y, text: text, color: drawColor, size: 20 }; history.push(txtObj); if (isAdmin && isBroadcastMode) socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: txtObj }); redrawCanvas(); } }, 50); }
}
function handleMove(e) {
    if (e.touches) e.preventDefault();
    if (currentTool === 'move' && isPanning) { const cx = e.touches?e.touches[0].clientX:e.clientX; const cy = e.touches?e.touches[0].clientY:e.clientY; panX = cx - startPanX; panY = cy - startPanY; clampPan(); updateTransform(); broadcastViewSync(); }
    else if (currentTool === 'draw' && currentStroke) { const pos = getLocalPos(e); currentStroke.points.push({x: pos.x, y: pos.y}); redrawCanvas(); }
    else if (currentTool === 'eraser') { const pos = getLocalPos(e); if (eraserMode === 'normal' && currentStroke) { currentStroke.points.push({x: pos.x, y: pos.y}); redrawCanvas(); } else if (eraserMode === 'stroke') checkStrokeHit(pos); }
}
function handleEnd() { isPanning = false; if (currentTool === 'move') canvas.style.cursor = 'grab'; if (currentStroke && isAdmin && isBroadcastMode) socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: currentStroke }); currentStroke = null; }
function checkStrokeHit(pos) { const hitRadius = 10 / scale; let didRemove = false; for (let i = history.length - 1; i >= 0; i--) { const item = history[i]; if (item.type === 'stroke' && item.color !== 'eraser') { for (let pt of item.points) { const dx = pt.x - pos.x; const dy = pt.y - pos.y; if (Math.sqrt(dx*dx + dy*dy) < hitRadius) { history.splice(i, 1); didRemove = true; break; } } } } if (didRemove) redrawCanvas(); }
function handleWheel(e) { e.preventDefault(); const rect = viewport.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const worldX = (mouseX - panX) / scale; const worldY = (mouseY - panY) / scale; const dir = e.deltaY > 0 ? -1 : 1; scale = Math.min(Math.max(1.0, scale + (dir * 0.1 * scale)), 5.0); panX = mouseX - worldX * scale; panY = mouseY - worldY * scale; clampPan(); updateTransform(); broadcastViewSync(); }

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); let dotCount = 0;
    history.forEach(item => {
        if (item.type === 'stroke') { ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = item.width; ctx.globalCompositeOperation = (item.color === 'eraser') ? 'destination-out' : 'source-over'; if (item.color !== 'eraser') ctx.strokeStyle = item.color; if (item.points.length > 0) { ctx.moveTo(item.points[0].x, item.points[0].y); for (let i=1; i<item.points.length; i++) ctx.lineTo(item.points[i].x, item.points[i].y); } ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
        else if (item.type === 'dot') { dotCount++; ctx.beginPath(); ctx.arc(item.x, item.y, 10, 0, 2*Math.PI); ctx.fillStyle = item.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke(); ctx.fillStyle = "black"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(dotCount, item.x, item.y); }
        else if (item.type === 'text') { ctx.font = `bold ${item.size}px Arial`; ctx.fillStyle = item.color; ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.strokeText(item.text, item.x, item.y); ctx.fillText(item.text, item.x, item.y); }
    });
    const badge = document.getElementById('countBadge'); if(badge) { badge.innerText = dotCount; badge.style.display = dotCount > 0 ? 'flex' : 'none'; }
}
function resizeCanvas() { canvas.width = viewport.offsetWidth; canvas.height = viewport.offsetHeight; redrawCanvas(); }
function clearAnnotations() { history = []; redrawCanvas(); }
function toggleAnnotationVisibility() { annotationsHidden = !annotationsHidden; canvas.style.opacity = annotationsHidden ? '0' : '1'; canvas.style.pointerEvents = annotationsHidden ? 'none' : 'auto'; }
function addToGallery(url) { const d = document.createElement('div'); d.style.cssText = `height: 100px; background-image: url('${url}'); background-size: cover; background-position: center; border-radius: 6px; border: 1px solid #444; cursor: pointer;`; d.onclick = () => { document.getElementById('modalImage').src = url; document.getElementById('modalDownload').href = url; document.getElementById('photoModal').style.display = 'flex'; }; document.getElementById('galleryGrid').prepend(d); togglePanel('gallery'); }

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
        
        livekitRoom = new LivekitClient.Room({
            adaptiveStream: true,
            dynacast: true
        });

        // When a video track arrives, show it
        livekitRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === LivekitClient.Track.Kind.Video) {
                const videoElement = document.getElementById("remoteVideo");
                track.attach(videoElement);
                if(!isPhotoMode) { 
                    statusTag.style.display = "block"; 
                    statusTag.innerText = "● LIVE (HC)"; 
                    statusTag.style.background = "#ff4444"; 
                }
                setTimeout(resizeCanvas, 500);
            }
        });

        // Connect using the ticket
        await livekitRoom.connect(data.url, data.token);
    });
}

function toggleFreeze() { isFrozen = !isFrozen; if(isFrozen) { videoEl.pause(); document.getElementById('iconFreeze').innerText="play_arrow"; } else { videoEl.play(); document.getElementById('iconFreeze').innerText="pause"; } }
function closeModal() { document.getElementById('photoModal').style.display = 'none'; }