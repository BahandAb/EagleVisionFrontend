/* Undo for the student's own annotation actions (pen, eraser, counter dots, text, clear).
   Remote annotations (broadcast by the host) never enter the stack, so Undo can only ever
   remove what this user did. A "group" is one gesture (e.g. a whole eraser drag). */
let undoStack = [];
let undoGroup = null;
const UNDO_LIMIT = 100;

function undoBegin() { undoGroup = []; }
function undoAdd(item) { undoOp({ t: 'add', item: item }); }
function undoRemove(item, index) { undoOp({ t: 'remove', item: item, index: index }); }
function undoOp(op) { if (undoGroup) undoGroup.push(op); else undoPush([op]); }
function undoEnd() {
    if (undoGroup && undoGroup.length) undoPush(undoGroup);
    undoGroup = null;
}
function undoPush(group) {
    undoStack.push(group);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    undoUpdateUI();
}
function undoReset() { undoStack = []; undoGroup = null; undoUpdateUI(); }

function undoAvailable() {
    // The host's drawings are broadcast to students and there is no "remove" message for strokes,
    // so Undo is off for the host while broadcasting (it would desync the room).
    return undoStack.length > 0 && !(typeof isAdmin !== 'undefined' && isAdmin && isBroadcastMode);
}
function undoUpdateUI() {
    const b = document.getElementById('btnUndo');
    if (!b) return;
    const ok = undoAvailable();
    b.disabled = !ok;
    b.title = (isAdmin && isBroadcastMode) ? "Undo isn't available while broadcasting drawings" : 'Undo (Ctrl+Z)';
}

function undoLast() {
    if (!undoAvailable()) return;
    if (typeof textToolDeselect === 'function') textToolDeselect();
    const group = undoStack.pop();
    for (let i = group.length - 1; i >= 0; i--) {
        const op = group[i];
        if (op.t === 'add') { const idx = history.indexOf(op.item); if (idx > -1) history.splice(idx, 1); }
        else if (op.t === 'remove') { history.splice(Math.min(op.index, history.length), 0, op.item); }
        else if (op.t === 'edit') { Object.assign(op.item, op.before); }
        else if (op.t === 'clear') { history = op.prev; }
    }
    redrawCanvas();
    undoUpdateUI();
}

function clearMyScreen() {
    if (history.length) undoPush([{ t: 'clear', prev: history }]);
    history = [];
    redrawCanvas();
}

document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLast(); }
});
