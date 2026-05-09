import { useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment } from '../utils.jsx';

export default function TaskModal({ task, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    ...task,
    name: task.name || '',
    notes: task.notes || '',
    subtasks: task.subtasks || [],
    time: task.time || '',
  });

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const fillDateTime = () => {
    const preview = parseDateTimeFromDescription(form.name || '');
    if (!preview) return;
    const result = parseDescriptionDateResult(form.name || '');
    let cleaned = cleanDescriptionSegment(form.name, result?.text || '');
    if (!result?.text || cleaned === form.name.trim()) {
      cleaned = cleaned.replace(/(?:\b(?:a|al|a la|a las|el|la|en|para)\b.*)$/i, '').replace(/\s{2,}/g, ' ').trim();
    }
    setForm((prev) => ({ ...prev, name: cleaned || form.name.trim(), date: preview.date, time: preview.time || prev.time }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) return;
    const parsed = parseDateTimeFromDescription(form.name);
    onSave({
      ...form,
      name: form.name.trim(),
      url: '',
      category: '',
      ticketNumber: '',
      dependencyTaskIds: [],
      hideInKanbanDone: false,
      date: form.date || parsed?.date || '',
      time: form.time || parsed?.time || '',
    });
  };

  const preview = parseDateTimeFromDescription(form.name || '');
  const previewLabel = preview ? `Detectado: ${fmtDate(preview.date)}${preview.time ? ` · ${preview.time}` : ''}` : null;

  return (
    <form className="liquid-glass-modal" onSubmit={onSubmit} style={{ width: 'min(420px, 100%)', maxWidth: 'calc(100% - 32px)', borderRadius: 'var(--border-radius-lg)', padding: 24, color: 'var(--color-text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{task.id ? 'Editar tarea' : 'Nueva tarea'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Ideal para entregas, exámenes y recordatorios.
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar modal" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Qué tienes que hacer
        <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Ej: Entregar trabajo de historia" style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13 }} />
      </label>

      {previewLabel && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 'var(--border-radius-md)', padding: '10px 12px' }}>
          <span>{previewLabel}</span>
          <button type="button" onClick={fillDateTime} style={{ border: 'none', background: 'rgba(37,99,235,0.12)', color: 'var(--color-accent)', borderRadius: '999px', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Usar fecha</button>
        </div>
      )}

      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Notas (opcional)
        <textarea value={form.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} rows={3} placeholder="Detalles, enlace en texto, etc." style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13, resize: 'vertical' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <span style={{ fontWeight: 500 }}>Prioridad</span>
        <select value={form.priority || 'medium'} onChange={(e) => handleChange('priority', e.target.value)} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }}>
          {PRIORITY.map((option) => <option key={option.v} value={option.v}>{option.label}</option>)}
        </select>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Fecha</span>
          <input type="date" value={form.date || ''} onChange={(e) => handleChange('date', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Hora</span>
          <input type="time" value={form.time || ''} onChange={(e) => handleChange('time', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <span style={{ fontWeight: 500 }}>Estado</span>
        <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }}>
          {STATUS.map((option) => <option key={option.v} value={option.v}>{option.label}</option>)}
        </select>
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        {onDelete ? (
          <button type="button" onClick={onDelete} style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', padding: '11px 0', cursor: 'pointer' }}>Eliminar</button>
        ) : (
          <button type="button" onClick={onClose} style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', padding: '11px 0', cursor: 'pointer' }}>Cancelar</button>
        )}
        <button type="submit" style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: 'none', background: 'var(--color-background-info)', color: 'var(--color-text-info)', fontWeight: 700, padding: '11px 0', cursor: 'pointer' }}>Guardar</button>
      </div>
    </form>
  );
}
