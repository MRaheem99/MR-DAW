const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 100;

undoBtn.onclick = undo;
redoBtn.onclick = redo;

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
    }
});

function pushHistory(action) {
    undoStack.push(action);
    redoStack.length = 0;
}

function undo() {
    const a = undoStack.pop();
    if (!a) return;
    a.undo();
    redoStack.push(a);
}

function redo() {
    const a = redoStack.pop();
    if (!a) return;
    a.redo();
    undoStack.push(a);
}
