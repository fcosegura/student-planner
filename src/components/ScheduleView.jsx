const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function addMinutesToTime(startTime, minutes) {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function sortByStartTime(a, b) {
  return a.startTime.localeCompare(b.startTime);
}

export default function ScheduleView({
  scheduleSubjects,
  scheduleSlots,
  onSelectSlot,
}) {
  const subjectById = Object.fromEntries(scheduleSubjects.map((s) => [s.id, s]));

  const slotsByWeekday = Array.from({ length: 7 }, (_, wd) =>
    scheduleSlots.filter((sl) => sl.weekday === wd).sort(sortByStartTime)
  );

  return (
    <div className="schedule-view">
      <div className="schedule-week-grid">
        {WEEKDAY_SHORT.map((label, wd) => (
          <div key={label} className="schedule-day-column">
            <div className="schedule-day-header">{label}</div>
            <div className="schedule-day-slots">
              {slotsByWeekday[wd].length === 0 && (
                <p className="schedule-empty-day">Sin clases</p>
              )}
              {slotsByWeekday[wd].map((slot) => {
                const sub = subjectById[slot.subjectId];
                const title = sub?.name || 'Asignatura';
                const color = sub?.color || '#6366f1';
                const end = addMinutesToTime(slot.startTime, slot.durationMinutes);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className="schedule-slot-card"
                    style={{ borderLeftColor: color }}
                    onClick={() => onSelectSlot(slot.id)}
                  >
                    <span className="schedule-slot-title">{title}</span>
                    <span className="schedule-slot-time">
                      {slot.startTime} – {end} ({slot.durationMinutes} min)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
