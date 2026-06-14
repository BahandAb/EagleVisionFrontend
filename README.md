# EagleVision

**Live microscopy streaming and real-time collaboration for classrooms.**

EagleVision lets a single microscope serve an entire room. An instructor connects their device, starts a session, and every student joins with a code — seeing the same live feed, annotating together, and asking AI-powered questions about what they're looking at.

> **Patent Pending** — Application 64/028,055 (filed January 5, 2026)  
> **2026 UC IT Expo** — Best of the Best (Overall) + 1st Place, High School Division

---

## Table of Contents

- [How the Hardware Works](#how-the-hardware-works)
- [Starting and Joining a Session](#starting-and-joining-a-session)
- [System Architecture](#system-architecture)
- [Frontend Structure](#frontend-structure)
- [Eagle AI Lab](#eagle-ai-lab)
- [Deployment & Self-Hosting](#deployment--self-hosting)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)

---

## How the Hardware Works

EagleVision is designed around a standard optical microscope with a camera attachment. No custom hardware is required.

**Minimum setup:**
- Any compound or stereo microscope
- A USB or HDMI camera adapter that mounts to the eyepiece (e.g., AmScope or similar C-mount eyepiece camera)
- A computer or tablet connected to the camera that will run the instructor-side broadcasting software

**What the instructor device does:**
1. Captures the live camera feed from the microscope
2. Connects to EagleVision's backend and opens a session room
3. Streams the feed to all connected students via LiveKit (WebRTC)
4. Optionally captures high-resolution still photos on request

**What students see:**
- The same live feed, rendered in their browser
- All of the instructor's real-time image adjustments (brightness, contrast, color channels, rotation)
- Shared annotations if broadcast mode is enabled
- A forced-sync view if the instructor enables follow mode

No special hardware is required on the student side — any modern browser on a phone, tablet, or laptop works.

---

## Starting and Joining a Session

### Instructor Flow

1. Connect the microscope camera (USB, HDMI capture card, or webcam) to your computer
2. Go to [eaglevision.dev/host.html](https://eaglevision.dev/host.html)
3. Select your camera, choose a resolution, and optionally set an admin key
4. A **6-digit session code** is auto-generated — share it with your students
5. Click **Start Session** — you are live immediately, no install required

### Student Flow

1. Go to [eaglevision.dev](https://eaglevision.dev) and click **Join a Session**
2. Enter the 6-digit session code
3. Enter your display name
4. Click **Join Session** — you'll be taken directly to the live stream

### Session Join Page (`/session.html`)

- Enter the **session code** (6 digits)
- Enter your **name**
- Optionally click the key icon and enter an **admin key** to join as instructor
- Press Enter to move between fields, or click **Join Session**

The page stores session details in `sessionStorage` and redirects to the workspace. If you navigate to the workspace directly without a code, you'll be sent back to the join page.

---

## System Architecture

```
Browser (Student/Instructor)
│
├── session.html          ← Enter code & name
│
└── workspace.html        ← Main application
    ├── script.js         ← Core logic
    └── img_processor.js  ← Image adjustments
         │
         ├── Socket.IO ──────────────────────────── api.eaglevision.dev
         │   (signaling, admin commands,              ├── Signaling server
         │    roster updates, view sync,              ├── LiveKit token issuer
         │    broadcast strokes)                      └── Eagle AI proxy
         │
         └── LiveKit (WebRTC) ────────────────────── LiveKit media server
             (video stream)                           (hosted separately)
```

### Connection Sequence

```
1. Browser connects to api.eaglevision.dev via Socket.IO
2. Browser emits join_room { code, username }
3. Server validates the room, emits back livekit_token { url, token }
4. Browser connects to LiveKit server using that token
5. LiveKit streams the instructor's video track to the browser
6. All subsequent control messages (admin, annotations, view sync) go through Socket.IO
```

### Socket.IO Events

| Direction | Event | Payload |
|-----------|-------|---------|
| → server | `join_room` | `{ room, username }` |
| ← server | `livekit_token` | `{ url, token }` |
| ← server | `join_error` | `{ message }` |
| ← server | `roster_update` | `{ sid: { name, role } }` |
| → server | `admin_login` | `{ room, key }` |
| ← server | `admin_access_granted` | — |
| → server | `admin_broadcast_stroke` | `{ room, stroke }` |
| ← server | `receive_broadcast_stroke` | stroke object |
| → server | `admin_sync_view` | `{ room, panX, panY, scale }` |
| ← server | `sync_view_command` | `{ panX, panY, scale }` |
| ← server | `kicked` | — |
| ← server | `session_ended` | — |

### AI API Endpoints

Both endpoints are at `https://api.eaglevision.dev`.

**POST `/api/ai/analyze`**
```json
{
  "password": "EagleDemo2026",
  "image": "<base64 JPEG>",
  "mode": "quick | standard | detailed"
}
```

**POST `/api/ai/custom-question`** *(Pro only)*
```json
{
  "password": "EaglePro2026",
  "image": "<base64 JPEG>",
  "question": "What organelles are visible here?"
}
```

---

## Frontend Structure

```
/
├── index.html          Landing page (hero, use cases, how it works, contact)
├── host.html           Instructor host page (camera setup, live streaming, admin controls)
├── host.js             Host logic (camera, LiveKit publish, crop, Socket.IO)
├── session.html        Student session join form
├── workspace.html      Main student collaboration workspace
├── about.html          Team, origin story, milestones
├── manifest.json       PWA manifest (installable on desktop/mobile)
├── sw.js               Service worker (offline static asset caching)
├── script.js           Core workspace logic
├── img_processor.js    Image filter and adjustment module
├── style.css           Workspace styles (dark theme)
├── landing.css         Landing and about page styles
├── js/
│   └── socket.io.min.js
└── assets/
    ├── EagleVisionLogo.png
    ├── EagleAILogo.png
    ├── Madeira Photos/     Classroom pilot photos
    ├── V2 Assets/          Sample microscopy images, in-session screenshots
    ├── ITExpo/             Award ceremony photos
    └── headshots/          Team photos
```

### Workspace Layout

The workspace has a **viewport** (video + annotation canvas) on the left and a **resizable sidebar** on the right with seven panels:

| Panel | Icon | Contents |
|-------|------|----------|
| Tools | Brush | Color picker, stroke thickness, eraser mode |
| Adjustments | Tune | RGB channels, brightness, contrast, saturation, rotation, flip |
| Gallery | Photo | Saved snapshots with lightbox preview |
| Eagle AI | Eagle logo | Specimen analysis (Basic / Pro) |
| People | Group | Live participant roster |
| Settings | Gear | Admin controls (follow mode, broadcast, kick) |
| Dev | Code | Developer mode (placeholder) |

**Toolbar** (floating, bottom-right of viewport):
Move · Draw · Eraser · Text · Count · Freeze · Snapshot

### Annotation System

All annotations are stored as a flat `history[]` array and redrawn on every frame. There is no server-side state for annotations — instructors can optionally broadcast their strokes to students via Socket.IO.

```
history[] entry types:
  { type: 'stroke', color, width, points: [{x, y}, ...] }
  { type: 'dot',    color, x, y, label }
  { type: 'text',   color, x, y, text, size }
```

Undo removes the last entry. Zoom and pan are applied as canvas transforms before hit-testing coordinates.

### Image Adjustments

`img_processor.js` applies adjustments to the live video element:

- **RGB channels** — SVG `feColorMatrix` filter (CSS filters cannot isolate channels)
- **Brightness / Contrast / Saturation** — CSS `filter` property
- **Rotation** — CSS `transform: rotate()`
- **Flip** — CSS `transform: scaleX(-1)` / `scaleY(-1)`

All adjustments are non-destructive and reset without refreshing the page.

---

## Eagle AI Lab

Eagle AI is a two-tier feature that lets users ask questions about whatever is on screen.

| Tier | Password | Modes available |
|------|----------|-----------------|
| Basic | `EagleDemo2026` | Quick ID, Standard analysis |
| Pro | `EaglePro2026` | Quick ID, Standard, Detailed, Custom questions |

**Session timeout**: Both tiers auto-lock after 30 minutes of inactivity.

**Analysis flow:**
1. User unlocks with a password
2. User selects an analysis mode (or types a custom question for Pro)
3. The current frame is captured from the video or static photo as a base64 JPEG
4. Request is sent to the Eagle AI API with the image and mode
5. Response is displayed with basic markdown formatting
6. Analysis is saved to `localStorage` (up to 50 entries per browser)

---

## Deployment & Self-Hosting

The frontend is a **static site** — no build step required. It can be served from any static host (GitHub Pages, Netlify, Cloudflare Pages, nginx, etc.).

The live site is deployed at **eaglevision.dev** via GitHub Pages (see `CNAME`). The backend runs on an Oracle Cloud VM (free tier) via `start.sh` using eventlet WSGI.

### What you need to self-host the full stack

| Component | What it does | Required |
|-----------|-------------|----------|
| This repo | Frontend UI | Yes |
| `api.eaglevision.dev` backend | Socket.IO signaling, AI proxy | Yes |
| LiveKit server | WebRTC media relay | Yes |
| Instructor broadcasting client | Streams camera to LiveKit | Yes |

The backend and broadcaster are in separate repositories (not public). To run a fully self-hosted instance, you would need to:

1. Deploy a LiveKit server (self-hosted or LiveKit Cloud)
2. Deploy the Python Flask + Socket.IO backend, pointed at your LiveKit instance
3. Update `SIGNALING_SERVER_URL` and `EAGLE_API_BASE_URL` in `script.js`
4. Serve this frontend from any static host

### Local development

No dependencies to install. Open `index.html` directly in a browser, or use any static file server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

The workspace requires a live backend connection to function. Without it, the join page will still render but session joining will fail.

---

## Configuration

All runtime constants are at the top of `script.js`:

```javascript
const SIGNALING_SERVER_URL     = "https://api.eaglevision.dev";
const EAGLE_API_BASE_URL       = "https://api.eaglevision.dev";
const EAGLE_BASIC_PASSWORD     = "EagleDemo2026";
const EAGLE_PRO_PASSWORD       = "EaglePro2026";
const EAGLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | HTML5, CSS3, Vanilla JavaScript |
| Real-time video | [LiveKit](https://livekit.io) (WebRTC) |
| Signaling | Socket.IO |
| Image processing | Canvas API, SVG filters |
| AI analysis | Gemini API (Google) via backend proxy |
| Storage | SessionStorage (session state), LocalStorage (AI history) |
| Hosting | GitHub Pages |

---

## Team

**Bahand Abdulrahman** — Founder & Lead Developer  
**Daiveion Greenwade** — Marketing & Operations

*Started in AP Biology at Walnut Hills High School. Developed and piloted at Madeira Elementary. Demonstrated at the 1819 Innovation Hub.*
