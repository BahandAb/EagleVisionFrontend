/* Text boxes: click to add, type in place, drag to move, corner handle to resize, top handle to
   rotate, x handle to delete, double-click / double-tap to edit. Items live in history[] like every
   other annotation ({type:'text', anchor:'c'}: x/y is the CENTER, rot in radians), so they redraw,
   undo and broadcast through the existing paths. */
(function () {
    const MIN_SIZE = 10, MAX_SIZE = 220, DEFAULT_SIZE = 24, PAD = 8;
    let selectedId = null, editing = null, drag = null, touch = false;
    let lastTap = { id: null, t: 0 };
    let editorEl = null;

    const newId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const byId = (id) => history.find(h => h.type === 'text' && h.id === id);
    const lines = (it) => String(it.text).split('\n');
    function metrics(it) {
        ctx.save(); ctx.font = 'bold ' + it.size + 'px Arial';
        let w = 0; lines(it).forEach(l => { w = Math.max(w, ctx.measureText(l || ' ').width); });
        ctx.restore();
        const lh = it.size * 1.25;
        return { w: Math.max(w, it.size * 0.6), h: lh * lines(it).length, lh: lh };
    }
    function local(it, pos) {
        const a = -(it.rot || 0), c = Math.cos(a), s = Math.sin(a);
        const dx = pos.x - it.x, dy = pos.y - it.y;
        return { x: dx * c - dy * s, y: dx * s + dy * c };
    }
    function geometry(it) { const m = metrics(it), p = PAD / scale; return { hw: m.w / 2 + p, hh: m.h / 2 + p, u: 1 / scale }; }
    function handleAt(it, pos) {
        const l = local(it, pos), g = geometry(it), r = (touch ? 24 : 14) / scale;
        const near = (x, y) => Math.hypot(l.x - x, l.y - y) <= r;
        if (near(0, -g.hh - 24 * g.u)) return 'rotate';
        if (near(g.hw, g.hh)) return 'resize';
        if (near(-g.hw, -g.hh)) return 'delete';
        return null;
    }
    function bodyHit(it, pos) { const l = local(it, pos), g = geometry(it); return Math.abs(l.x) <= g.hw && Math.abs(l.y) <= g.hh; }

    function broadcastText(it, deleted) {
        if (!(isAdmin && isBroadcastMode)) return;
        const stroke = deleted ? { type: 'text', id: it.id, deleted: true } : Object.assign({}, it, { editing: undefined });
        socket.emit('admin_broadcast_stroke', { room: currentRoomID, stroke: stroke });
    }

    // ---- drawing ----
    window.drawTextItem = function (it) {
        if (it.editing) return;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        if (it.anchor === 'c') {
            const m = metrics(it);
            ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0);
            ctx.font = 'bold ' + it.size + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round'; ctx.fillStyle = it.color; ctx.strokeStyle = 'black'; ctx.lineWidth = Math.max(2, it.size / 8);
            lines(it).forEach((l, i) => { const y = -m.h / 2 + m.lh * (i + 0.5); ctx.strokeText(l, 0, y); ctx.fillText(l, 0, y); });
        } else { // older/remote items without an anchor keep the original look
            ctx.font = 'bold ' + it.size + 'px Arial'; ctx.fillStyle = it.color; ctx.strokeStyle = 'black'; ctx.lineWidth = 3;
            ctx.strokeText(it.text, it.x, it.y); ctx.fillText(it.text, it.x, it.y);
        }
        ctx.restore();
    };
    window.drawTextSelection = function () {
        if (currentTool !== 'text' || !selectedId || editing) return;
        const it = byId(selectedId); if (!it) return;
        const g = geometry(it), u = g.u;
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0);
        ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#ffffff'; ctx.setLineDash([6 * u, 4 * u]); ctx.strokeRect(-g.hw, -g.hh, 2 * g.hw, 2 * g.hh); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0, -g.hh); ctx.lineTo(0, -g.hh - 24 * u); ctx.stroke();
        const knob = (x, y, kind) => {
            ctx.beginPath();
            if (kind === 'square') ctx.rect(x - 6 * u, y - 6 * u, 12 * u, 12 * u); else ctx.arc(x, y, 8 * u, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#2f84b6'; ctx.stroke();
            if (kind === 'x') { ctx.beginPath(); ctx.moveTo(x - 3.5 * u, y - 3.5 * u); ctx.lineTo(x + 3.5 * u, y + 3.5 * u); ctx.moveTo(x + 3.5 * u, y - 3.5 * u); ctx.lineTo(x - 3.5 * u, y + 3.5 * u); ctx.strokeStyle = '#e84e53'; ctx.lineWidth = 2 * u; ctx.stroke(); }
            if (kind === 'rotate') { ctx.beginPath(); ctx.arc(x, y, 3.5 * u, -2.6, 1.6); ctx.strokeStyle = '#2f84b6'; ctx.lineWidth = 1.6 * u; ctx.stroke(); }
        };
        knob(0, -g.hh - 24 * u, 'rotate'); knob(g.hw, g.hh, 'square'); knob(-g.hw, -g.hh, 'x');
        ctx.restore();
    };

    // ---- pointer handling (called from script.js for the text tool) ----
    function beginDrag(mode, it, pos) {
        drag = { mode: mode, it: it, start: pos, orig: { x: it.x, y: it.y, size: it.size, rot: it.rot || 0 }, startDist: Math.hypot(pos.x - it.x, pos.y - it.y) || 1, moved: false };
    }
    window.textToolStart = function (pos, e) {
        touch = !!(e && e.touches);
        // keep the browser from moving focus off the inline editor we are about to open
        if (e && e.cancelable && e.type === 'mousedown') e.preventDefault();
        if (editing) commitEdit();
        const sel = byId(selectedId);
        if (sel) {
            const h = handleAt(sel, pos);
            if (h === 'delete') { removeItem(sel); return; }
            if (h) { beginDrag(h, sel, pos); return; }
        }
        for (let i = history.length - 1; i >= 0; i--) {
            const it = history[i];
            if (it.type === 'text' && it.anchor === 'c' && bodyHit(it, pos)) {
                const now = Date.now();
                const again = selectedId === it.id && lastTap.id === it.id && now - lastTap.t < 450;
                lastTap = again ? { id: null, t: 0 } : { id: it.id, t: now };
                selectedId = it.id; beginDrag('move', it, pos);
                drag.edit = again;   // a second quick press without dragging opens the editor on release
                redrawCanvas(); return;
            }
        }
        if (selectedId) { selectedId = null; redrawCanvas(); return; }   // first click on empty space just deselects
        createAt(pos);
    };
    window.textToolMove = function (e) {
        const pos = getLocalPos(e);
        if (drag) {
            const it = drag.it; drag.moved = true;
            if (drag.mode === 'move') { it.x = drag.orig.x + pos.x - drag.start.x; it.y = drag.orig.y + pos.y - drag.start.y; }
            else if (drag.mode === 'rotate') {
                let a = Math.atan2(pos.y - it.y, pos.x - it.x) + Math.PI / 2;
                const snap = Math.PI / 12, k = Math.round(a / snap) * snap; if (Math.abs(a - k) < 0.07) a = k;
                it.rot = a;
            } else if (drag.mode === 'resize') {
                const d = Math.hypot(pos.x - it.x, pos.y - it.y);
                it.size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, drag.orig.size * d / drag.startDist));
            }
            redrawCanvas(); return;
        }
        if (e.touches) return;
        let cur = 'text';
        const sel = byId(selectedId), h = sel && handleAt(sel, pos);
        if (h === 'rotate') cur = 'grab'; else if (h === 'resize') cur = 'nwse-resize'; else if (h === 'delete') cur = 'pointer';
        else { for (let i = history.length - 1; i >= 0; i--) { const it = history[i]; if (it.type === 'text' && it.anchor === 'c' && bodyHit(it, pos)) { cur = 'move'; break; } } }
        canvas.style.cursor = cur;
    };
    window.textToolEnd = function () {
        if (!drag) return;
        const d = drag; drag = null;
        if (!d.moved) { if (d.edit) startEdit(d.it, false); return; }
        undoPush([{ t: 'edit', item: d.it, before: d.orig }]);
        broadcastText(d.it);
    };
    window.textToolDeselect = function () {
        if (editing) commitEdit();
        selectedId = null; drag = null; redrawCanvas();
    };
    window.textToolSelectedId = () => selectedId;
    window.textToolDeleteSelected = function () { const it = byId(selectedId); if (it && !editing) removeItem(it); };

    function removeItem(it) {
        const idx = history.indexOf(it); if (idx < 0) return;
        history.splice(idx, 1); undoPush([{ t: 'remove', item: it, index: idx }]);
        selectedId = null; broadcastText(it, true); redrawCanvas();
    }
    function createAt(pos) {
        const it = { type: 'text', id: newId(), anchor: 'c', x: pos.x, y: pos.y, text: '', color: drawColor, size: DEFAULT_SIZE, rot: 0 };
        history.push(it); selectedId = it.id; startEdit(it, true);
    }

    // ---- inline editor ----
    function ensureEditor() {
        if (editorEl) return editorEl;
        editorEl = document.createElement('div');
        editorEl.id = 'textEditor'; editorEl.setAttribute('contenteditable', 'true'); editorEl.setAttribute('spellcheck', 'false');
        editorEl.setAttribute('role', 'textbox'); editorEl.setAttribute('aria-label', 'Text annotation');
        viewport.appendChild(editorEl);
        editorEl.addEventListener('input', () => {
            if (!editing) return;
            editing.it.text = editorEl.innerText.replace(/ /g, ' ').replace(/\n$/, '');
            positionEditor(editing.it);
        });
        editorEl.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
        });
        editorEl.addEventListener('blur', () => { setTimeout(() => { if (editing && document.activeElement !== editorEl) commitEdit(); }, 0); });
        return editorEl;
    }
    function positionEditor(it) {
        editorEl.style.left = (panX + it.x * scale) + 'px';
        editorEl.style.top = (panY + it.y * scale) + 'px';
        editorEl.style.fontSize = (it.size * scale) + 'px';
        editorEl.style.color = it.color;
        editorEl.style.transform = 'translate(-50%, -50%) rotate(' + (it.rot || 0) + 'rad)';
    }
    function startEdit(it, isNew) {
        editing = { it: it, isNew: isNew, beforeText: it.text };
        it.editing = true; redrawCanvas();
        const el = ensureEditor();
        el.textContent = it.text; positionEditor(it); el.style.display = 'block';
        const focusIt = () => { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
        focusIt(); setTimeout(() => { if (editing && document.activeElement !== el) focusIt(); }, 0);
    }
    function hideEditor() { if (editorEl) editorEl.style.display = 'none'; }
    function commitEdit() {
        if (!editing) return;
        const e = editing; editing = null; hideEditor();
        const it = e.it; it.editing = false;
        const text = String(it.text).replace(/\s+$/, '');
        if (!text) {
            const i = history.indexOf(it); if (i > -1) history.splice(i, 1);
            selectedId = null;
            if (!e.isNew && i > -1) { undoPush([{ t: 'remove', item: it, index: i }]); broadcastText(it, true); }
        } else {
            it.text = text;
            if (e.isNew) undoPush([{ t: 'add', item: it }]);
            else if (text !== e.beforeText) undoPush([{ t: 'edit', item: it, before: { text: e.beforeText } }]);
            broadcastText(it);
        }
        redrawCanvas();
    }
    function cancelEdit() {
        if (!editing) return;
        const e = editing; editing = null; hideEditor();
        const it = e.it; it.editing = false;
        if (e.isNew) { const i = history.indexOf(it); if (i > -1) history.splice(i, 1); selectedId = null; } else it.text = e.beforeText;
        redrawCanvas();
    }

    // ---- remote annotations (host broadcast) ----
    window.applyRemoteStroke = function (s) {
        if (s && s.type === 'text' && s.id) {
            const i = history.findIndex(h => h.type === 'text' && h.id === s.id);
            if (s.deleted) { if (i > -1) history.splice(i, 1); }
            else if (i > -1) history[i] = s; else history.push(s);
        } else history.push(s);
        redrawCanvas();
    };

    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && currentTool === 'text') { e.preventDefault(); window.textToolDeleteSelected(); }
        if (e.key === 'Escape' && selectedId) { window.textToolDeselect(); }
    });
})();
