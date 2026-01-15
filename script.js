const SIGNALING_SERVER_URL = "https://eaglevisionbackend-go8c.onrender.com"; 

let socket;
let peerConnection;
let currentRoomID = "";
let currentUserName = "Anonymous";
let currentAdminKey = ""; // Stored if user is teacher
let latestRoster = {};    // Global store for the roster list

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
    sessionStorage.clear();
    window.location.href = "index.html";
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    const content = document.getElementById('tab-' + tabName);
    if (content) content.classList.add('active');
    
    // Header Highlighting logic
    const headers = document.querySelectorAll('.tab');
    if (tabName === 'gallery') headers[0].classList.add('active');
    if (tabName === 'people') headers[1].classList.add('active');
    if (tabName === 'settings') headers[2].classList.add('active');
    if (tabName === 'admin') document.getElementById('tabHeaderAdmin').classList.add('active');
}

function attemptAdminLogin() {
    const key = document.getElementById("adminKeyInput").value.trim();
    if (!key) return alert("Enter Admin Key");
    currentAdminKey = key;
    socket.emit('admin_login', { room: currentRoomID, key: key });
}

function kickUser(targetSid) {
    if (!currentAdminKey) return;
    if (confirm("Are you sure you want to kick this student?")) {
        socket.emit("kick_student", { 
            room: currentRoomID, 
            key: currentAdminKey, 
            target_sid: targetSid 
        });
    }
}

const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function startConnection() {
    const statusEl = document.getElementById("statusTag");
    socket = io(SIGNALING_SERVER_URL);

    socket.on("connect", () => {
        statusEl.innerText = "Joining...";
        socket.emit("join_room", { room: currentRoomID, username: currentUserName });
        
        if (currentAdminKey) {
            socket.emit("admin_login", { room: currentRoomID, key: currentAdminKey });
        }
    });

    socket.on("disconnect", () => {
        statusEl.innerText = "Disconnected";
        document.getElementById("liveTag").style.display = "none";
    });

    // --- ROSTER LOGIC ---
    socket.on("roster_update", (roster) => {
        latestRoster = roster; 
        renderRosterUI();
    });

    function renderRosterUI() {
    const listEl = document.getElementById("studentRosterList");
    const countEl = document.getElementById("studentCount");
    listEl.innerHTML = "";
    
    let count = 0;
    for (const [sid, userData] of Object.entries(latestRoster)) {
        count++;
        const isMe = (sid === socket.id);
        const isAdmin = (userData.role === "admin"); // Check role from server
        
        const item = document.createElement("div");
        item.className = "roster-item";
        if (isMe) item.style.backgroundColor = "rgba(255, 215, 0, 0.05)";

        // 1. Name + "You" label
        let nameHTML = `<span style="color: ${isMe ? '#FFD700' : '#ddd'};">
            ${userData.name}${isMe ? ' (You)' : ''}
        </span>`;
        
        // 2. Verified Badge (Now shows for anyone who is an admin!)
        if (isAdmin) {
            nameHTML += `<span class="material-icons" style="font-size: 16px; color: #FFD700; margin-left: 5px; vertical-align: middle;" title="Instructor">verified</span>`;
        }

        // 3. Kick Button (Only I see it, and only if I am an admin)
        let actionButton = "";
        if (currentAdminKey && !isMe) {
            actionButton = `<button class="btn-kick" onclick="kickUser('${sid}')">KICK</button>`;
        }

        item.innerHTML = `<div>${nameHTML}</div>${actionButton}`;
        listEl.appendChild(item);
    }
    countEl.innerText = `(${count})`;
}

    // --- ADMIN EVENTS ---
    socket.on("admin_access_granted", () => {
        console.log("Admin Access Granted");
        document.getElementById("tabHeaderAdmin").style.display = "block"; 
        renderRosterUI(); // Refresh list to show kick buttons immediately
        switchTab('admin');
    });

    socket.on("kicked", () => {
        alert("You have been removed from the session by the instructor.");
        leaveSession();
    });

    // --- VIDEO HANDLING ---
    socket.on("offer", async (sdp) => {
        statusEl.innerText = "Negotiating...";
        if (peerConnection) peerConnection.close();
        peerConnection = new RTCPeerConnection(rtcConfig);

        peerConnection.ontrack = (event) => {
            statusEl.innerText = ""; 
            document.getElementById("liveTag").style.display = "block";
            const vid = document.getElementById("remoteVideo");
            if (event.streams && event.streams[0]) vid.srcObject = event.streams[0];
            else {
                const stream = new MediaStream();
                stream.addTrack(event.track);
                vid.srcObject = stream;
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice_candidate", {
                    room: currentRoomID,
                    candidate: {
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex
                    }
                });
            }
        };

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: sdp }));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit("answer", { room: currentRoomID, sdp: answer.sdp });
        } catch (err) { console.error("WebRTC Error:", err); }
    });

    socket.on("ice_candidate", (data) => {
        if (peerConnection) {
            try {
                peerConnection.addIceCandidate(new RTCIceCandidate({
                    candidate: data.candidate,
                    sdpMid: data.sdpMid,
                    sdpMLineIndex: data.sdpMLineIndex
                }));
            } catch (e) { console.error("ICE Error", e); }
        }
    });

    socket.on("session_ended", () => {
        alert("The Host has ended the session.");
        leaveSession();
    });
}