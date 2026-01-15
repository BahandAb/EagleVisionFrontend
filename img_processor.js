// EagleVision Image Processor & Adjustment Logic
// Bridges CSS Filters for performance and prepares OpenCV for analysis

let videoElement = null;
let zoomLayerEl = null;

// State for Filters
let adjustments = {
    r: 100, g: 100, b: 100,         // RGB Channels (%)
    brightness: 100,                // %
    contrast: 100,                  // %
    saturation: 100,                // %
    rotate: 0,                      // Degrees (0, 90, 180, 270)
    flipH: 1,                       // 1 or -1
    flipV: 1                        // 1 or -1
};

// Initialize when page loads
function initImageProcessor() {
    videoElement = document.getElementById('remoteVideo');
    zoomLayerEl = document.getElementById('zoomLayer');
    
    // Inject SVG Filter for RGB Channel Manipulation
    // CSS 'filter' property can't do individual RGB channels, but SVG filters can.
    const svgFilter = `
    <svg style="display: none;">
        <defs>
            <filter id="eagleColorFilter">
                <feColorMatrix type="matrix" 
                    values="1 0 0 0 0  
                            0 1 0 0 0  
                            0 0 1 0 0  
                            0 0 0 1 0" />
            </filter>
        </defs>
    </svg>`;
    document.body.insertAdjacentHTML('beforeend', svgFilter);
}

// --- SLIDER HANDLERS ---

function updateRGB(channel, value) {
    adjustments[channel] = value;
    document.getElementById(`val-${channel}`).innerText = value;
    applyFilters();
}

function updateFilter(type, value) {
    adjustments[type] = value;
    document.getElementById(`val-${type}`).innerText = value;
    applyFilters();
}

function rotateFeed() {
    adjustments.rotate = (adjustments.rotate + 90) % 360;
    applyTransforms();
}

function toggleFlip(axis) {
    if (axis === 'h') adjustments.flipH *= -1;
    if (axis === 'v') adjustments.flipV *= -1;
    
    // Update Button Visuals
    const btnId = axis === 'h' ? 'btnFlipH' : 'btnFlipV';
    const btn = document.getElementById(btnId);
    if ((axis === 'h' && adjustments.flipH === -1) || (axis === 'v' && adjustments.flipV === -1)) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
    
    applyTransforms();
}

function normalizeFeed() {
    // Reset to "Readable Text" defaults (Usually Rotate 180 for microscopes)
    adjustments.rotate = 180;
    adjustments.flipH = 1;
    adjustments.flipV = 1;
    applyTransforms();
    
    // Reset buttons
    document.getElementById('btnFlipH').classList.remove('active');
    document.getElementById('btnFlipV').classList.remove('active');
}

function resetAdjustments() {
    adjustments = { r: 100, g: 100, b: 100, brightness: 100, contrast: 100, saturation: 100, rotate: 0, flipH: 1, flipV: 1 };
    
    // Reset UI Inputs
    ['r', 'g', 'b', 'brightness', 'contrast', 'saturation'].forEach(k => {
        document.getElementById(`slider-${k}`).value = 100;
        document.getElementById(`val-${k}`).innerText = 100;
    });
    
    document.getElementById('btnFlipH').classList.remove('active');
    document.getElementById('btnFlipV').classList.remove('active');

    applyFilters();
    applyTransforms();
}

// --- CORE APPLICATION LOGIC ---

function applyFilters() {
    if (!videoElement) return;

    // 1. Calculate RGB Matrix for SVG
    const r = adjustments.r / 100;
    const g = adjustments.g / 100;
    const b = adjustments.b / 100;
    
    // Update the SVG Matrix directly
    const matrix = document.querySelector('#eagleColorFilter feColorMatrix');
    if (matrix) {
        matrix.setAttribute('values', 
            `${r} 0 0 0 0  
             0 ${g} 0 0 0  
             0 0 ${b} 0 0  
             0 0 0 1 0`
        );
    }

    // 2. Apply CSS Filters (Brightness, Contrast, Saturation + SVG Reference)
    // We combine standard CSS filters with the url() to the SVG filter
    const cssFilters = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) url(#eagleColorFilter)`;
    
    videoElement.style.filter = cssFilters;
}

function applyTransforms() {
    if (!videoElement) return;

    // We apply transforms to the VIDEO element. 
    // Note: If we want annotations to rotate WITH the video, we would apply this to 'zoomLayer'.
    // BUT, rotating the container messes up X/Y coordinate math for drawing.
    // For now, we rotate the Video Background only. 
    
    videoElement.style.transform = `rotate(${adjustments.rotate}deg) scaleX(${adjustments.flipH}) scaleY(${adjustments.flipV})`;
}

// --- FUTURE OPENCV HOOK ---
// This function is ready for you to implement advanced logic later.
// You would call this inside a requestAnimationFrame loop.
function processOpenCVFrame() {
    if (typeof cv !== 'undefined' && cv.Mat) {
        // 1. Read frame from video to canvas
        // 2. cv.imread(...)
        // 3. Do magic (Cell counting, edge detection)
        // 4. cv.imshow(...)
        console.log("OpenCV is ready for logic.");
    }
}