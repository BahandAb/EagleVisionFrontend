const SIGNALING_SERVER_URL = "https://eaglevisionbackend-go8c.onrender.com"; 

let socket;
let peerConnection;
let currentRoomID = "";

const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function startViewer() {
    // 1. Get the Code
    const inputVal = document.getElementById("sessionInput").value.trim();
    if (inputVal.length < 3) {
        alert("Please enter a valid Session Code.");
        return;
    }
    currentRoomID = inputVal;

    const statusEl = document.getElementById("statusText");
    statusEl.innerText = "Connecting to " + currentRoomID + "...";
    
    // 2. Connect to Server
    if (socket) socket.disconnect(); 
    socket = io(SIGNALING_SERVER_URL);

    // --- SOCKET LISTENERS ---

    socket.on("connect", () => {
        console.log("Connected to Server. Joining room:", currentRoomID);
        statusEl.innerText = "Server Found. Waiting for Video Stream...";
        socket.emit("join_room", { room: currentRoomID });
    });

    socket.on("disconnect", () => {
        statusEl.innerText = "Disconnected.";
        document.getElementById("liveTag").style.display = "none";
    });

    // VIDEO LOGIC
    socket.on("offer", async (sdp) => {
        console.log("Creating Answer...");
        statusEl.innerText = "Stream found! Negotiating...";
        
        if (peerConnection) peerConnection.close();
        createPeerConnection();

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: sdp }));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            socket.emit("answer", { room: currentRoomID, sdp: answer.sdp });
        } catch (err) { console.error("WebRTC Error:", err); }
    });

    socket.on("ice_candidate", (data) => {
        if (peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate({
                candidate: data.candidate,
                sdpMid: data.sdpMid,
                sdpMLineIndex: data.sdpMLineIndex
            }));
        }
    });

    // ADMIN LOGIC (Attached here to ensure they work)
    socket.on("admin_access_granted", () => {
        alert("✅ Teacher Access GRANTED!");
        document.getElementById("adminPanel").style.display = "block"; 
        closeAdminModal(); // Only close on success
        resetAdminButton();
    });

    socket.on("admin_access_denied", () => {
        alert("❌ Access DENIED. Incorrect Key.");
        resetAdminButton();
        // Do NOT close modal, let them try again
    });
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
        console.log("Video Track Received!"); // We know this works
        
        // Update Status UI
        document.getElementById("statusText").innerText = "";
        document.getElementById("liveTag").style.display = "block";
        document.getElementById("sessionData").innerHTML = "Connected to: " + currentRoomID + "<br>Resolution: 2K<br>Status: LIVE";
        
        const vid = document.getElementById("remoteVideo");
        
        // 1. Assign the stream
        if (event.streams && event.streams[0]) {
            vid.srcObject = event.streams[0];
        } else {
            const stream = new MediaStream();
            stream.addTrack(event.track);
            vid.srcObject = stream;
        }

        // 2. FORCE PLAY (The Fix)
        // Browsers sometimes pause streams by default. We force it here.
        vid.onloadedmetadata = () => {
            console.log("Video Metadata loaded. Forcing play...");
            vid.play().catch(e => console.error("Autoplay blocked:", e));
        };
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
}

/* --- ADMIN UI LOGIC --- */
function openAdminModal() {
    document.getElementById("adminModal").style.display = "flex";
}

function closeAdminModal() {
    document.getElementById("adminModal").style.display = "none";
}

function submitAdminLogin() {
    const key = document.getElementById("adminKeyInput").value.trim();
    if (!key) return;

    // Change button text to show we are working
    const btn = document.querySelector("#adminModal .btn-join");
    btn.innerText = "VERIFYING...";
    
    // Send to server
    socket.emit("admin_login", { room: currentRoomID, key: key });
}

function resetAdminButton() {
    const btn = document.querySelector("#adminModal .btn-join");
    btn.innerText = "UNLOCK";
}