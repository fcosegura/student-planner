export function Pill({ s, fixedWidth = null }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        background: `var(${s.bv})`, color: `var(${s.tv})`,
        minWidth: fixedWidth || undefined,
        textAlign: fixedWidth ? 'center' : undefined,
      }}
    >
      {s.label}
    </span>
  );
}

export function CategoryPill({ name }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    >
      {name}
    </span>
  );
}

export function NBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34, height: 34, fontSize: 16, cursor: 'pointer',
        border: '1px solid var(--color-border-secondary)',
        background: 'var(--color-background-primary)',
        borderRadius: '999px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        boxShadow: '0 10px 22px rgba(15,23,42,0.06)',
      }}
    >
      {children}
    </button>
  );
}

export function Chip({ label, count, active, onClick, colorVar }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
        border: 'none',
        background: active ? 'rgba(59,130,246,0.12)' : 'var(--color-background-primary)',
        color: active && colorVar ? `var(${colorVar})` : active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontSize: 12, fontWeight: active ? 600 : 500,
        boxShadow: active ? '0 6px 18px rgba(59,130,246,0.08)' : '0 8px 18px rgba(15,23,42,0.04)',
        display: 'flex', gap: 6, alignItems: 'center',
      }}
    >
      {label} <span style={{ opacity: 0.65 }}>{count}</span>
    </button>
  );
}
