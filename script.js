const SIGNALING_SERVER_URL = "https://eaglevisionbackend-go8c.onrender.com"; 

let socket;
let peerConnection;
let currentRoomID = "";
let currentUserName = "Anonymous";
let currentAdminKey = ""; // Stored if user is teacher

window.onload = function() {
    // 1. Retrieve Data
    const code = sessionStorage.getItem("eagleSessionCode");
    const name = sessionStorage.getItem("eagleUserName");
    const savedKey = sessionStorage.getItem("eagleAdminKey"); // Check for auto-login

    if (!code || !name) {
        window.location.href = "index.html";
        return;
    }

    currentRoomID = code;
    currentUserName = name;
    if (savedKey) currentAdminKey = savedKey;

    document.getElementById("displaySessionCode").innerText = currentRoomID;

    startConnection();
};

function leaveSession() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // Header Highlighting
    const headers = document.querySelectorAll('.tab');
    if (tabName === 'gallery') headers[0].classList.add('active');
    if (tabName === 'people') headers[1].classList.add('active'); // NEW
    if (tabName === 'settings') headers[2].classList.add('active'); // Shifted index
    if (tabName === 'admin') document.getElementById('tabHeaderAdmin').classList.add('active');
}

function attemptAdminLogin() {
    // If called manually from Settings tab
    const key = document.getElementById("adminKeyInput").value.trim();
    if(!key) return;
    currentAdminKey = key; // Save it locally
    socket.emit("admin_login", { room: currentRoomID, key: key });
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
        // SEND NAME ON JOIN
        socket.emit("join_room", { room: currentRoomID, username: currentUserName });
        
        // AUTO-LOGIN AS ADMIN if key exists
        if (currentAdminKey) {
            socket.emit("admin_login", { room: currentRoomID, key: currentAdminKey });
        }
    });

    socket.on("disconnect", () => {
        statusEl.innerText = "Disconnected";
        document.getElementById("liveTag").style.display = "none";
    });

    // --- ROSTER UPDATE ---
    // --- ROSTER UPDATE ---
    socket.on("roster_update", (roster) => {
        const listEl = document.getElementById("studentRosterList");
        const countEl = document.getElementById("studentCount");
        listEl.innerHTML = "";
        
        let count = 0;
        for (const [sid, name] of Object.entries(roster)) {
            count++;
            if (sid === socket.id) continue; // Don't list myself? (Optional)

            const item = document.createElement("div");
            item.className = "roster-item";
            
            // LOGIC: Only show Kick button if I am the Admin
            let actionButton = "";
            if (currentAdminKey) {
                actionButton = `<button class="btn-kick" onclick="kickUser('${sid}')">KICK</button>`;
            }

            item.innerHTML = `
                <span style="color: #ddd;">${name}</span>
                ${actionButton}
            `;
            listEl.appendChild(item);
        }
        countEl.innerText = `(${count})`;
    });

    // CRITICAL: We also need to refresh the list when Admin Login succeeds
    // so the buttons appear instantly without waiting for a new user to join.
    socket.on("admin_access_granted", () => {
        document.getElementById("tabHeaderAdmin").style.display = "block"; 
        
        // Re-request roster or just set flag? 
        // Since we store the key in 'currentAdminKey', the next roster update will have buttons.
        // To force an update immediately, we can ask the server, or just wait. 
        // For better UX, let's just switch tabs for now.
        switchTab('admin');
    });
    // --- KICKED HANDLER ---
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

    // --- ADMIN EVENTS ---
    socket.on("admin_access_granted", () => {
        document.getElementById("tabHeaderAdmin").style.display = "block"; 
        // If we are on the landing page flow, auto-switch to admin tab? 
        // Or just let them click it. For now, let's auto-switch to confirm it worked.
        switchTab('admin');
        console.log("Admin Access Granted");
    });
}