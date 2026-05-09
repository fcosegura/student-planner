export const STATUS = [
  { v: 'not_done', label: 'Sin iniciar', tv: '--color-text-secondary', bv: '--color-background-secondary', bov: '--color-border-secondary' },
  { v: 'started', label: 'Iniciado', tv: '--color-text-info', bv: '--color-background-info', bov: '--color-border-info' },
  { v: 'in_progress', label: 'En progreso', tv: '--color-text-warning', bv: '--color-background-warning', bov: '--color-border-warning' },
  { v: 'paused', label: 'En pausa', tv: '--color-text-secondary', bv: '--color-background-secondary', bov: '--color-border-secondary' },
  { v: 'blocked', label: 'Bloqueado', tv: '--color-text-danger', bv: '--color-background-danger', bov: '--color-border-danger' },
  { v: 'done', label: 'Completado', tv: '--color-text-success', bv: '--color-background-success', bov: '--color-border-success' },
];

export const PRIORITY = [
  { v: 'low', label: 'Baja', tv: '--color-text-secondary', bv: '--color-background-secondary', bov: '--color-border-secondary' },
  { v: 'medium', label: 'Media', tv: '--color-text-info', bv: '--color-background-info', bov: '--color-border-info' },
  { v: 'high', label: 'Alta', tv: '--color-text-warning', bv: '--color-background-warning', bov: '--color-border-warning' },
  { v: 'critical', label: 'Crítica', tv: '--color-text-danger', bv: '--color-background-danger', bov: '--color-border-danger' },
];

export const P_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const STORAGE_KEY = 'studentplanner_lite_v1';

export const EVENT_COLORS = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#4b5563'];
