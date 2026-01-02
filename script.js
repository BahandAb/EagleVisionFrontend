// CONFIGURATION
const SIGNALING_SERVER_URL = "https://eaglevisionbackend-go8c.onrender.com"; 

// --- VARIABLES ---
let socket;
let peerConnection;
let currentRoomID = "";

// --- ON LOAD: CHECK SESSION ---
window.onload = function() {
    // 1. Get Code from Landing Page
    const code = sessionStorage.getItem("eagleSessionCode");
    
    // 2. Redirect if missing (Security)
    if (!code) {
        window.location.href = "index.html";
        return;
    }

    // 3. Update UI
    currentRoomID = code;
    document.getElementById("displaySessionCode").innerText = currentRoomID;

    // 4. Start Connection
    startConnection();
};

function leaveSession() {
    sessionStorage.removeItem("eagleSessionCode");
    window.location.href = "index.html";
}

/* --- TAB LOGIC --- */
function switchTab(tabName) {
    // 1. Hide all content
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

    // 2. Show selected
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // 3. Highlight Header (Admin is special case)
    const headers = document.querySelectorAll('.tab');
    if (tabName === 'gallery') headers[0].classList.add('active');
    if (tabName === 'settings') headers[1].classList.add('active');
    if (tabName === 'admin') document.getElementById('tabHeaderAdmin').classList.add('active');
}

function attemptAdminLogin() {
    const key = document.getElementById("adminKeyInput").value.trim();
    if(!key) return;

    socket.emit("admin_login", { room: currentRoomID, key: key });
}

/* --- WEBRTC & SOCKET LOGIC --- */
const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function startConnection() {
    const statusEl = document.getElementById("statusTag");
    
    socket = io(SIGNALING_SERVER_URL);

    socket.on("connect", () => {
        console.log("Connected. Joining room:", currentRoomID);
        statusEl.innerText = "Searching for Host...";
        socket.emit("join_room", { room: currentRoomID });
    });

    socket.on("disconnect", () => {
        statusEl.innerText = "Disconnected";
        document.getElementById("liveTag").style.display = "none";
    });

    // --- VIDEO HANDLING ---
    socket.on("offer", async (sdp) => {
        statusEl.innerText = "Negotiating...";
        
        if (peerConnection) peerConnection.close();
        peerConnection = new RTCPeerConnection(rtcConfig);

        // Track Event
        peerConnection.ontrack = (event) => {
            console.log("Stream Received");
            statusEl.innerText = ""; // Clear text
            document.getElementById("liveTag").style.display = "block"; // Show Live Tag
            
            const vid = document.getElementById("remoteVideo");
            if (event.streams && event.streams[0]) {
                vid.srcObject = event.streams[0];
            } else {
                const stream = new MediaStream();
                stream.addTrack(event.track);
                vid.srcObject = stream;
            }
        };

        // ICE Handling
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

        // SDP Handshake
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

    // --- ADMIN EVENTS ---
    socket.on("admin_access_granted", () => {
        alert("Teacher Access GRANTED");
        document.getElementById("tabHeaderAdmin").style.display = "block"; // Show Tab
        switchTab('admin'); // Auto-switch
    });

    socket.on("admin_access_denied", () => {
        alert("Incorrect Key");
    });
}