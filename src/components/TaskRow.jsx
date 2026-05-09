import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, linkifyText } from '../utils.jsx';
import { Pill, CategoryPill } from './shared/index.jsx';

export default function TaskRow({
  task,
  allTasks = [],
  onClick,
  onToggleDone,
  simple = false,
}) {
  const s = STATUS.find((x) => x.v === task.status) || STATUS[0];
  const p = PRIORITY.find((x) => x.v === task.priority) || PRIORITY[1];
  const childTasks = allTasks.filter((candidate) => (task.dependencyTaskIds || []).includes(candidate.id));
  const parentTasks = allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id));
  const hasParentTask = parentTasks.length > 0;
  const hasChildTasks = childTasks.length > 0;
  const dependencyRailColor = hasChildTasks && hasParentTask
    ? 'linear-gradient(180deg, #f59e0b 0%, #f59e0b 50%, #9333ea 50%, #9333ea 100%)'
    : hasChildTasks
      ? '#9333ea'
      : hasParentTask
        ? '#f59e0b'
        : 'transparent';

  return (
    <div
      className="task-card"
      onClick={onClick}
      style={{
        borderRadius: 'var(--border-radius-lg)',
        padding: '18px 18px',
        marginLeft: !simple && hasParentTask ? 18 : 0,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
        opacity: task.status === 'done' ? 0.8 : 1,
        transform: 'translateZ(0)',
        boxShadow: 'var(--shadow-card)',
        transition: 'transform 150ms ease, box-shadow 150ms ease, border 150ms ease, background 150ms ease',
        border: '1px solid transparent',
        background: 'var(--color-background-primary)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div className="priority-rail" style={{ width: 4, minHeight: 34, borderRadius: 4, background: `var(${p.tv})`, flexShrink: 0 }} />
      {!simple && (hasParentTask || hasChildTasks) && (
        <div
          className="dependency-rail"
          title={hasParentTask && hasChildTasks
            ? 'Esta tarea depende de otra y también tiene tareas hijas'
            : hasParentTask
              ? 'Esta tarea depende de otra tarea'
              : 'Esta tarea tiene tareas hijas'}
          style={{ width: 4, minHeight: 34, borderRadius: 4, background: dependencyRailColor, flexShrink: 0 }}
        />
      )}
      <div className="task-content" style={{ flex: 1, minWidth: 0 }}>
        <div className="task-title" style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {linkifyText(task.name)}
        </div>
        {task.url && (
          <div className="task-date" style={{ fontSize: 12, color: 'var(--color-text-info)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {linkifyText(task.url)}
          </div>
        )}
        {task.notes && (
          <div className="task-date" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {linkifyText(task.notes)}
          </div>
        )}
        {task.date && (
          <div className="task-date" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ''}
          </div>
        )}
        {!simple && (childTasks.length > 0 || parentTasks.length > 0) && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {hasChildTasks && (
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                Esta tarea depende de: {childTasks.map((childTask) => childTask.name).join(', ')}
              </div>
            )}
            {hasParentTask && (
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                Esta tarea es parte de: {parentTasks.map((parentTask) => parentTask.name).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="task-meta" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleDone?.(task.id); }}
          aria-label={task.status === 'done' ? 'Marcar como no completada' : 'Marcar como completada'}
          style={{
            width: 28, height: 28, borderRadius: 999, border: '1px solid var(--color-border-tertiary)',
            background: task.status === 'done' ? 'var(--color-background-success)' : 'var(--color-background-primary)',
            color: task.status === 'done' ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'grid', placeItems: 'center',
          }}
        >
          {task.status === 'done' ? '✓' : '○'}
        </button>
        <Pill s={p} />
        {task.category && <CategoryPill name={task.category} />}
        <Pill s={s} fixedWidth={82} />
      </div>
    </div>
  );
}
