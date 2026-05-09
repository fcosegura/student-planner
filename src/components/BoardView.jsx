import { useEffect, useRef, useState } from 'react';

function BoardNoteCard({ note, onDelete, onUpdate, onDragHandlePointerDown, isDragging, noteWidth }) {
  return (
    <div
      className="board-note"
      style={{
        position: 'absolute', left: note.x ?? 0, top: note.y ?? 0,
        zIndex: isDragging ? 50 : 10,
        cursor: 'default',
        background: 'var(--board-note-bg)', border: '1px solid var(--board-note-border)',
        borderRadius: 16, padding: 12, minHeight: 180, width: noteWidth,
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: isDragging ? '0 25px 50px -12px rgba(0,0,0,0.25)' : '0 12px 24px rgba(15,23,42,0.08)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        touchAction: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onPointerDown={onDragHandlePointerDown}
          aria-label="Mover nota"
          title="Mover nota"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: isDragging ? 'grabbing' : 'grab',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span style={{ fontSize: 13 }}>⋮⋮</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>Mover</span>
        </button>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
        aria-label="Eliminar nota"
        style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 5 }}
      >×</button>
      <input
        value={note.title}
        onChange={(e) => onUpdate(note.id, { title: e.target.value })}
        placeholder="Título"
        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: 'var(--board-note-title)', outline: 'none' }}
      />
      <textarea
        value={note.text}
        onChange={(e) => onUpdate(note.id, { text: e.target.value })}
        placeholder="Escribe aquí..."
        style={{ flex: 1, width: '100%', minHeight: 120, resize: 'none', border: 'none', background: 'transparent', fontSize: 13, color: 'var(--board-note-text)', lineHeight: 1.4, outline: 'none', whiteSpace: 'pre-wrap' }}
      />
      <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
        {new Date(note.createdAt || note.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

export default function BoardView({ notes, onAddNote, onUpdateNote, onDeleteNote }) {
  const boardRef = useRef(null);
  const dragCaptureRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [boardWidth, setBoardWidth] = useState(0);
  const noteWidth = Math.max(150, Math.min(180, boardWidth > 0 ? boardWidth - 16 : 180));

  useEffect(() => {
    if (!boardRef.current) return undefined;
    const updateWidth = () => setBoardWidth(boardRef.current?.clientWidth || 0);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!boardWidth) return;
    const maxX = Math.max(boardWidth - noteWidth - 8, 8);
    notes.forEach((note) => {
      const originalX = typeof note.x === 'number' ? note.x : 8;
      const clampedX = Math.min(Math.max(originalX, 8), maxX);
      if (clampedX !== originalX) {
        onUpdateNote(note.id, { x: clampedX });
      }
    });
  }, [boardWidth, noteWidth, notes, onUpdateNote]);

  const handlePointerDown = (e, note) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragCaptureRef.current = e.currentTarget;
    setDraggedId(note.id);
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    setDragOffset({ x: e.clientX - boardRect.left - (note.x ?? 0), y: e.clientY - boardRect.top - (note.y ?? 0) });
  };

  const handlePointerMove = (e) => {
    if (!draggedId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left - dragOffset.x, 8), Math.max(rect.width - noteWidth - 8, 8));
    const y = Math.max(e.clientY - rect.top - dragOffset.y, 8);
    onUpdateNote(draggedId, { x, y });
  };

  const handlePointerUp = (e) => {
    if (draggedId) {
      const captureEl = dragCaptureRef.current;
      if (captureEl?.hasPointerCapture?.(e.pointerId)) {
        try {
          captureEl.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer might already be released.
        }
      }
      dragCaptureRef.current = null;
      setDraggedId(null);
    }
  };

  const handleAddNote = () => {
    onAddNote({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: '', text: '', createdAt: new Date().toISOString(),
      x: 20 + Math.random() * 40, y: 20 + Math.random() * 40,
    });
  };

  return (
    <div className="board-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="board-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Tablero</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Notas estilo post-it.</div>
          </div>
          <button
            type="button"
            onClick={handleAddNote}
            style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'var(--board-add-button-bg)', color: 'var(--board-add-button-text)', fontSize: 24, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 20px rgba(245,158,11,0.24)' }}
          >+</button>
        </div>
        <div className="hide-mobile" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Las notas son libres. Añade post-its, muévelos donde quieras y organiza tus ideas.</div>
      </div>

      <div
        className="board-canvas"
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', minHeight: 'calc(100vh - 280px)', width: '100%',
          backgroundColor: 'var(--board-canvas-bg)',
          backgroundImage: 'radial-gradient(var(--board-canvas-dot) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          borderRadius: 'var(--border-radius-lg)', overflow: 'hidden',
          border: '1px solid var(--color-border-tertiary)', boxShadow: 'var(--shadow-soft)',
        }}
      >
        {notes.length === 0 ? (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>
            Pulsa + para crear tu primer post-it.
          </div>
        ) : notes.map((note, index) => {
          const displayNote = {
            ...note,
            x: Math.min(
              Math.max(note.x ?? (index % 2) * (noteWidth + 20) + 12, 8),
              Math.max(boardWidth - noteWidth - 8, 8)
            ),
            y: Math.max(note.y ?? Math.floor(index / 2) * 200 + 20, 8),
            createdAt: note.createdAt || note.created_at || new Date().toISOString(),
          };
          return (
            <BoardNoteCard
              key={note.id}
              note={displayNote}
              onDelete={onDeleteNote}
              onUpdate={onUpdateNote}
              onDragHandlePointerDown={(e) => handlePointerDown(e, displayNote)}
              isDragging={draggedId === note.id}
              noteWidth={noteWidth}
            />
          );
        })}
      </div>
    </div>
  );
}
