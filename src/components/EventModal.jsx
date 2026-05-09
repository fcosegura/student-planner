import { useState } from 'react';
import { EVENT_COLORS } from '../constants.js';

export default function EventModal({ event, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(event);

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate) return;
    const finalForm = { ...form, endDate: form.endDate || form.startDate };
    if (finalForm.endDate < finalForm.startDate) finalForm.endDate = finalForm.startDate;
    onSave(finalForm);
  };

  return (
    <form className="liquid-glass-modal" onSubmit={onSubmit} style={{ width: 'min(420px, 100%)', maxWidth: 'calc(100% - 32px)', borderRadius: 'var(--border-radius-lg)', padding: 24, color: 'var(--color-text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{event.id ? 'Editar evento' : 'Nuevo evento'}</div>
        <button type="button" onClick={onClose} aria-label="Cerrar modal" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Título del evento
        <input value={form.title} onChange={(e) => handleChange('title', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13 }} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Fecha inicio</span>
          <input type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Fecha fin</span>
          <input type="date" value={form.endDate || ''} min={form.startDate} onChange={(e) => handleChange('endDate', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: 6 }}>Color</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {EVENT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => handleChange('color', c)} style={{ width: 36, height: 36, borderRadius: 999, background: c, border: form.color === c ? '3px solid var(--color-background-primary)' : '3px solid transparent', boxShadow: `0 0 0 1px ${form.color === c ? c : 'var(--color-border-tertiary)'}`, cursor: 'pointer' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button type="button" onClick={onDelete} disabled={!onDelete} style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: onDelete ? 'var(--color-background-danger)' : 'var(--color-background-secondary)', color: onDelete ? 'var(--color-text-danger)' : 'var(--color-text-secondary)', padding: '11px 0', cursor: onDelete ? 'pointer' : 'not-allowed' }}>Eliminar</button>
        <button type="submit" style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: 'none', background: 'var(--color-background-info)', color: 'var(--color-text-info)', fontWeight: 700, padding: '11px 0', cursor: 'pointer' }}>Guardar</button>
      </div>
    </form>
  );
}
