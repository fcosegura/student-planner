import { useState, useEffect, useMemo } from 'react';

const WEEKDAY_OPTIONS = [
  { v: 0, label: 'Lun' },
  { v: 1, label: 'Mar' },
  { v: 2, label: 'Mié' },
  { v: 3, label: 'Jue' },
  { v: 4, label: 'Vie' },
  { v: 5, label: 'Sáb' },
  { v: 6, label: 'Dom' },
];

const NEW_SUBJECT_VALUE = '__new__';

function normalizeHHMM(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 6,
  borderRadius: 'var(--border-radius-md)',
  border: '0.5px solid var(--color-border-secondary)',
  padding: 10,
  fontSize: 13,
  background: 'var(--color-background-primary)',
};

function uniqueSortedDays(days) {
  return [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
}

export default function ScheduleModal({
  mode,
  subject,
  slot,
  scheduleSubjects = [],
  onSave,
  onClose,
  onDeleteThisSlot,
  onDeleteWholeSubject,
  onRemoveSubject,
}) {
  const isEdit = mode === 'edit';

  const sortedSubjects = useMemo(
    () => [...scheduleSubjects].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [scheduleSubjects],
  );

  const defaultSubjectChoice = useMemo(() => {
    if (isEdit && subject?.id) return subject.id;
    if (sortedSubjects.length > 0) return sortedSubjects[0].id;
    return NEW_SUBJECT_VALUE;
  }, [isEdit, subject?.id, sortedSubjects]);

  const [subjectChoice, setSubjectChoice] = useState(() => defaultSubjectChoice);
  const [name, setName] = useState(() => (isEdit ? (subject?.name || '') : ''));
  const [color, setColor] = useState(() => subject?.color || '#6366f1');
  const [validFrom, setValidFrom] = useState(() => subject?.validFrom || '');
  const [validTo, setValidTo] = useState(() => subject?.validTo || '');
  const [selectedDays, setSelectedDays] = useState(() => {
    if (isEdit && slot) return [slot.weekday];
    return [0];
  });

  useEffect(() => {
    if (subjectChoice === NEW_SUBJECT_VALUE) {
      setName('');
      setColor('#6366f1');
      setValidFrom('');
      setValidTo('');
      return;
    }
    const sub = scheduleSubjects.find((s) => s.id === subjectChoice);
    if (sub) {
      setName(sub.name);
      setColor(sub.color || '#6366f1');
      setValidFrom(sub.validFrom || '');
      setValidTo(sub.validTo || '');
    }
  }, [subjectChoice, scheduleSubjects]);

  const toggleDay = (d) => {
    setSelectedDays((prev) => {
      const has = prev.includes(d);
      if (has) {
        const next = prev.filter((x) => x !== d);
        return next.length > 0 ? next : prev;
      }
      return uniqueSortedDays([...prev, d]);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const startTime = normalizeHHMM(form.startTime.value);
    const durationMinutes = Number(form.durationMinutes.value);

    const trimmedName = name.trim();
    if (subjectChoice === NEW_SUBJECT_VALUE && !trimmedName) return;
    if (subjectChoice !== NEW_SUBJECT_VALUE && !trimmedName) return;

    const weekdays = uniqueSortedDays(selectedDays);
    if (weekdays.length === 0) return;

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) return;
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return;

    onSave({
      subjectChoice,
      name: trimmedName,
      color: color.trim() || '#6366f1',
      validFrom: validFrom.trim(),
      validTo: validTo.trim(),
      weekdays,
      startTime,
      durationMinutes,
    });
  };

  const canRemoveSubject = subjectChoice && subjectChoice !== NEW_SUBJECT_VALUE && typeof onRemoveSubject === 'function';

  return (
    <form
      className="liquid-glass-modal schedule-modal-form"
      onSubmit={handleSubmit}
      style={{
        width: 'min(480px, 100%)',
        maxWidth: 'calc(100% - 32px)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 24,
        color: 'var(--color-text-primary)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }} id="schedule-modal-title">{isEdit ? 'Editar franja' : 'Nueva asignatura'}</div>
        <button type="button" onClick={onClose} aria-label="Cerrar modal" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Asignatura</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <select
            value={subjectChoice}
            onChange={(e) => setSubjectChoice(e.target.value)}
            style={{ ...inputStyle, marginTop: 0, flex: '1 1 200px', minHeight: 44, appearance: 'none', cursor: 'pointer' }}
            aria-label="Seleccionar asignatura"
          >
            {sortedSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value={NEW_SUBJECT_VALUE}>+ Nueva asignatura…</option>
          </select>
          {canRemoveSubject && (
            <button
              type="button"
              className="ghost-button danger-text"
              style={{ flex: '0 0 auto', alignSelf: 'center' }}
              onClick={() => onRemoveSubject(subjectChoice)}
            >
              Borrar
            </button>
          )}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-primary)', opacity: 0.82 }}>
          {subjectChoice === NEW_SUBJECT_VALUE
            ? 'Escribe el nombre de la nueva asignatura abajo.'
            : 'Puedes renombrar o ajustar color y fechas; los cambios aplican a esa asignatura en todo el horario.'}
        </p>
      </div>

      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
        Nombre
        <input
          name="subjectName"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
        Color
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ ...inputStyle, height: 44, padding: 4 }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>Válido desde</span>
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} style={{ ...inputStyle, marginTop: 0, height: 44 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>Válido hasta</span>
          <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} style={{ ...inputStyle, marginTop: 0, height: 44 }} />
        </label>
      </div>

      <fieldset style={{ border: 'none', margin: '0 0 18px', padding: 0 }}>
        <legend style={{ fontSize: 13, marginBottom: 8, fontWeight: 700 }}>Días (uno o varios)</legend>
        <div className="schedule-modal-weekdays">
          {WEEKDAY_OPTIONS.map(({ v, label }) => (
            <label key={v} className="schedule-day-chip">
              <input
                type="checkbox"
                checked={selectedDays.includes(v)}
                onChange={() => toggleDay(v)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>Inicio</span>
          <input type="time" name="startTime" required defaultValue={slot?.startTime || '09:00'} style={{ ...inputStyle, marginTop: 0, height: 44 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <span>Duración (min)</span>
          <input type="number" name="durationMinutes" required min={1} max={720} step={1} defaultValue={slot?.durationMinutes ?? 60} style={{ ...inputStyle, marginTop: 0, height: 44 }} />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="ghost-button" onClick={onClose}>Cancelar</button>
        <button type="submit" className="primary-button">{isEdit ? 'Guardar' : 'Añadir'}</button>
      </div>
      {isEdit && (
        <div className="schedule-modal-danger" style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="ghost-button danger-text" onClick={onDeleteThisSlot}>
            Quitar solo este día
          </button>
          <button type="button" className="ghost-button danger-text" onClick={onDeleteWholeSubject}>
            Quitar en todos los días
          </button>
        </div>
      )}
    </form>
  );
}
