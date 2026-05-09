import { MONTHS, DAYS } from '../constants.js';
import { toDateStr, fmtDate } from '../utils.jsx';
import { NBtn } from './shared/index.jsx';
import TaskRow from './TaskRow.jsx';

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getSpainNationalHolidaySet(year) {
  const set = new Set([
    toDateStr(year, 0, 1),  // Año Nuevo
    toDateStr(year, 0, 6),  // Reyes
    toDateStr(year, 4, 1),  // Día del Trabajo
    toDateStr(year, 7, 15), // Asunción
    toDateStr(year, 9, 12), // Fiesta Nacional
    toDateStr(year, 10, 1), // Todos los Santos
    toDateStr(year, 11, 6), // Constitución
    toDateStr(year, 11, 8), // Inmaculada
    toDateStr(year, 11, 25), // Navidad
  ]);
  const easter = getEasterSunday(year);
  const goodFriday = addDays(easter, -2);
  set.add(toDateStr(goodFriday.getFullYear(), goodFriday.getMonth(), goodFriday.getDate()));
  return set;
}

export default function CalendarView({ y, mo, dIM, fD, tByDate, eByDate, todayStr, prev, next, selDay, setSelDay, onAddTaskForDay, onEditTask, onToggleTaskDone, onAddEventForDay, onEditEvent }) {
  const cells = [...Array(fD).fill(null), ...Array.from({ length: dIM }, (_, i) => i + 1)];
  const selDs = selDay ? toDateStr(y, mo, selDay) : null;
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() === mo;
  const fallbackDay = isCurrentMonth ? today.getDate() : 1;
  const eventCreateDate = selDs || toDateStr(y, mo, fallbackDay);
  const holidaySet = getSpainNationalHolidaySet(y);

  return (
    <div className="calendar-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="calendar-panel" style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Calendario</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{MONTHS[mo]} {y}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onAddEventForDay(eventCreateDate)}
              style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', borderRadius: '999px', whiteSpace: 'nowrap' }}
            >+ Evento</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <NBtn onClick={prev}>{'‹'}</NBtn>
              <NBtn onClick={next}>{'›'}</NBtn>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px 8px', marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600 }}>
          {DAYS.map((day, dayIndex) => {
            const isWeekendHeader = dayIndex === 0 || dayIndex === 6;
            return (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  color: isWeekendHeader ? 'var(--color-text-danger)' : 'var(--color-text-secondary)'
                }}
              >
                {day.slice(0, 3)}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
          {cells.map((day, index) => {
            const dateStr = day ? toDateStr(y, mo, day) : null;
            const dayOfWeek = day ? new Date(y, mo, day).getDay() : null;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isNationalHoliday = dateStr ? holidaySet.has(dateStr) : false;
            const eventsForDay = dateStr ? eByDate[dateStr] || [] : [];
            const tasksForDay = dateStr ? tByDate[dateStr] || [] : [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selDs;
            const holidayLike = isWeekend || isNationalHoliday;

            return (
              <div
                key={index}
                className={`calendar-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                style={{
                  position: 'relative', minHeight: 65, padding: '8px 4px',
                  borderRadius: 12,
                  background: isSelected
                    ? 'var(--calendar-selected-bg)'
                    : isToday
                      ? 'var(--calendar-today-bg)'
                      : holidayLike
                        ? 'var(--calendar-holiday-bg)'
                        : 'var(--color-background-primary)',
                  border: `1px solid ${isSelected
                    ? 'var(--calendar-selected-border)'
                    : isToday
                      ? 'var(--calendar-today-border)'
                      : holidayLike
                        ? 'var(--calendar-holiday-border)'
                        : 'var(--calendar-default-border)'}`,
                  color: day ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  cursor: day ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                }}
                onClick={() => day && setSelDay(day)}
                onDoubleClick={() => day && onAddTaskForDay(dateStr)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: day ? (isToday ? 'var(--color-text-success)' : holidayLike ? 'var(--color-text-danger)' : 'var(--color-text-primary)') : 'var(--color-text-secondary)', width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 999, background: isToday ? 'var(--calendar-today-pill-bg)' : undefined }}>
                      {day || ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                    {eventsForDay.slice(0, 3).map((event) => (
                      <div key={event.id} style={{ width: 6, height: 6, borderRadius: '50%', background: event.color }} />
                    ))}
                    {tasksForDay.slice(0, 3 - eventsForDay.length).map((task) => (
                      <div key={task.id} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', opacity: task.status === 'done' ? 0.4 : 1 }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="day-panel" style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 3 }}>Día seleccionado</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {selDs ? `${DAYS[new Date(selDs).getDay()]}, ${fmtDate(selDs)}` : 'Selecciona un día'}
            </div>
          </div>
          {selDs && (
            <button type="button" onClick={() => setSelDay(null)} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              Cerrar
            </button>
          )}
        </div>

        {selDs ? (
          ((tByDate[selDs] || []).length + (eByDate[selDs] || []).length) > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(eByDate[selDs] || []).map((event) => (
                <div key={event.id} onClick={() => onEditEvent(event)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--border-radius-lg)', background: event.color, color: 'white' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{event.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginLeft: 'auto' }}>
                    {fmtDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` - ${fmtDate(event.endDate)}` : ''}
                  </div>
                </div>
              ))}
              {(tByDate[selDs] || []).map((task) => (
                <TaskRow key={task.id} task={task} allTasks={[]} simple onClick={() => onEditTask(task)} onToggleDone={onToggleTaskDone} />
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>No hay tareas ni eventos para este día.</div>
          )
        ) : (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Haz clic en un día para ver o añadir tareas.</div>
        )}
      </div>
    </div>
  );
}
