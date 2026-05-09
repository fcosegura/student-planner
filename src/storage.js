import { STORAGE_KEY, STATUS, PRIORITY } from './constants.js';

const lastCloudSnapshotByProfile = new Map();

function clonePayload(payload) {
  try {
    return JSON.parse(JSON.stringify({
      tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
      boardNotes: Array.isArray(payload?.boardNotes) ? payload.boardNotes : [],
      events: Array.isArray(payload?.events) ? payload.events : [],
    }));
  } catch {
    return { tasks: [], boardNotes: [], events: [] };
  }
}

function stableSerialize(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function indexById(list = []) {
  const index = new Map();
  for (const item of list) {
    if (item && typeof item.id === 'string') {
      index.set(item.id, item);
    }
  }
  return index;
}

function diffEntityOps(previousList = [], nextList = []) {
  const previous = indexById(previousList);
  const next = indexById(nextList);
  const deletes = [];
  const upserts = [];

  for (const [id, prevItem] of previous.entries()) {
    if (!next.has(id)) deletes.push(id);
    else if (stableSerialize(prevItem) !== stableSerialize(next.get(id))) upserts.push(next.get(id));
  }
  for (const [id, nextItem] of next.entries()) {
    if (!previous.has(id)) upserts.push(nextItem);
  }
  return { upserts, deletes };
}

function buildIncrementalOps(previousPayload, nextPayload) {
  return {
    tasks: diffEntityOps(previousPayload?.tasks || [], nextPayload?.tasks || []),
    notes: diffEntityOps(previousPayload?.boardNotes || [], nextPayload?.boardNotes || []),
    events: diffEntityOps(previousPayload?.events || [], nextPayload?.events || []),
  };
}

function hasAnyOps(ops) {
  return (
    (ops.tasks.upserts.length + ops.tasks.deletes.length) > 0 ||
    (ops.notes.upserts.length + ops.notes.deletes.length) > 0 ||
    (ops.events.upserts.length + ops.events.deletes.length) > 0
  );
}

function profileStorageKey(profileId) {
  return profileId ? `${STORAGE_KEY}:${profileId}` : STORAGE_KEY;
}

function readLocalPayload(profileId) {
  try {
    const primaryRaw = localStorage.getItem(profileStorageKey(profileId));
    if (primaryRaw) return normalizeDataPayload(JSON.parse(primaryRaw));
  } catch (e) {
    console.error("Error cargando local (perfil):", e);
  }
  if (!profileId) {
    // Legacy fallback only for default/no-profile scope.
    try {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (legacyRaw) return normalizeDataPayload(JSON.parse(legacyRaw));
    } catch (e) {
      console.error("Error cargando local (legacy):", e);
    }
  }
  return { tasks: [], boardNotes: [], events: [] };
}

function hasAnyData(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return (
    (Array.isArray(payload.tasks) && payload.tasks.length > 0) ||
    (Array.isArray(payload.boardNotes) && payload.boardNotes.length > 0) ||
    (Array.isArray(payload.events) && payload.events.length > 0)
  );
}

export function isValidTask(task) {
  if (!task || typeof task !== 'object') return false;
  const { id, name, status, priority, subtasks, category, date, time, dependencyTaskIds, url, notes, ticketNumber } = task;
  if (typeof id !== 'string' || typeof name !== 'string') return false;
  if (typeof status !== 'string' || !STATUS.some((s) => s.v === status)) return false;
  if (typeof priority !== 'string' || !PRIORITY.some((p) => p.v === priority)) return false;
  if (category !== undefined && category !== null && typeof category !== 'string') return false;
  if (date !== undefined && date !== null && typeof date !== 'string') return false;
  if (time !== undefined && time !== null && typeof time !== 'string') return false;
  if (url !== undefined && url !== null && typeof url !== 'string') return false;
  if (notes !== undefined && notes !== null && typeof notes !== 'string') return false;
  if (ticketNumber !== undefined && ticketNumber !== null && typeof ticketNumber !== 'string') return false;
  if (!Array.isArray(subtasks)) return false;
  if (dependencyTaskIds !== undefined && !Array.isArray(dependencyTaskIds)) return false;
  if (Array.isArray(dependencyTaskIds) && !dependencyTaskIds.every((id) => typeof id === 'string')) return false;
  return subtasks.every(
    (st) => st && typeof st === 'object' && typeof st.id === 'string' && typeof st.text === 'string' && typeof st.done === 'boolean'
  );
}

function normalizeTask(task) {
  const rawDependencies = Array.isArray(task.dependencyTaskIds) ? task.dependencyTaskIds : [];
  const legacyName = typeof task.name === 'string' ? task.name : (typeof task.description === 'string' ? task.description : '');
  return {
    ...task,
    name: legacyName,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    dependencyTaskIds: [...new Set(rawDependencies.filter((id) => typeof id === 'string'))],
    category: task.category || '',
    date: task.date || '',
    time: task.time || '',
    url: task.url || '',
    notes: task.notes || '',
    ticketNumber: task.ticketNumber || '',
    hideInKanbanDone: Boolean(task.hideInKanbanDone),
  };
}

function normalizeEvent(event) {
  return {
    ...event,
    endDate: event.endDate || event.startDate,
    color: event.color || '#2563eb',
  };
}

function normalizeBoardNote(note) {
  return {
    ...note,
    title: note.title || '',
    text: note.text || '',
    createdAt: note.createdAt || note.created_at || new Date().toISOString(),
    x: typeof note.x === 'number' ? note.x : 20,
    y: typeof note.y === 'number' ? note.y : 20,
  };
}

export function isValidEvent(event) {
  if (!event || typeof event !== 'object') return false;
  const { id, title, startDate, endDate, color } = event;
  if (typeof id !== 'string' || typeof title !== 'string') return false;
  if (typeof startDate !== 'string' || (endDate && typeof endDate !== 'string')) return false;
  if (typeof color !== 'string') return false;
  return true;
}

export function isValidBoardNote(note) {
  return (
    note &&
    typeof note === 'object' &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.text === 'string' &&
    (typeof note.createdAt === 'string' || typeof note.created_at === 'string') &&
    (note.x === undefined || typeof note.x === 'number') &&
    (note.y === undefined || typeof note.y === 'number')
  );
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.tasks) || !payload.tasks.every(isValidTask)) return false;
  if (payload.boardNotes !== undefined && (!Array.isArray(payload.boardNotes) || !payload.boardNotes.every(isValidBoardNote))) return false;
  if (payload.events !== undefined && (!Array.isArray(payload.events) || !payload.events.every(isValidEvent))) return false;
  return true;
}

export function normalizeDataPayload(parsed) {
  if (Array.isArray(parsed)) {
    const tasks = parsed.map(normalizeTask);
    if (tasks.every(isValidTask)) return { tasks, boardNotes: [], events: [] };
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
    const tasks = parsed.tasks.map(normalizeTask);
    if (!tasks.every(isValidTask)) return { tasks: [], boardNotes: [], events: [] };
    const boardNotes = Array.isArray(parsed.boardNotes)
      ? parsed.boardNotes.map(normalizeBoardNote).filter(isValidBoardNote)
      : [];
    const events = Array.isArray(parsed.events)
      ? parsed.events.map(normalizeEvent).filter(isValidEvent)
      : [];
    return { tasks, boardNotes, events };
  }
  return { tasks: [], boardNotes: [], events: [] };
}

export function isMultiBackupPayload(parsed) {
  return Boolean(
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.workspaces)
  );
}

export function validateMultiBackupPayload(payload) {
  if (!isMultiBackupPayload(payload)) return false;
  return payload.workspaces.every((workspace) => (
    workspace &&
    typeof workspace === 'object' &&
    typeof workspace.name === 'string' &&
    workspace.name.trim().length > 0 &&
    validateBackupPayload(workspace)
  ));
}

export function normalizeMultiBackupPayload(parsed) {
  if (!isMultiBackupPayload(parsed)) return null;
  const workspaces = parsed.workspaces
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!name) return null;
      const normalized = normalizeDataPayload(raw);
      const sourceTaskCount = Array.isArray(raw.tasks) ? raw.tasks.length : 0;
      const sourceNoteCount = Array.isArray(raw.boardNotes) ? raw.boardNotes.length : 0;
      const sourceEventCount = Array.isArray(raw.events) ? raw.events.length : 0;
      const droppedItems =
        normalized.tasks.length !== sourceTaskCount ||
        normalized.boardNotes.length !== sourceNoteCount ||
        normalized.events.length !== sourceEventCount;
      if (droppedItems) return null;
      return {
        id: typeof raw.id === 'string' ? raw.id : null,
        name,
        ...normalized,
      };
    })
    .filter(Boolean);
  if (workspaces.length === 0) return null;
  return { workspaces };
}

export async function loginWithGoogleCredential(credential) {
  const resp = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ credential }),
  });
  if (!resp.ok) throw new Error('No se pudo iniciar sesión.');
  return true;
}

export async function logoutSession() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function checkSession() {
  const resp = await fetch('/api/session', { credentials: 'same-origin' });
  return resp.ok;
}

export async function createProfile(name) {
  const resp = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error('No se pudo crear el perfil.');
  const data = await resp.json();
  return data.profile;
}

export async function deleteProfile(profileId) {
  const resp = await fetch('/api/profiles/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId }),
  });
  if (!resp.ok) {
    let message = 'No se pudo borrar el perfil.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message);
  }
  return resp.json();
}

export async function fetchWorkspaceData(profileId) {
  if (!profileId) throw new Error('profileId es requerido para fetchWorkspaceData.');
  const resp = await fetch(`/api/data?profileId=${encodeURIComponent(profileId)}`, { credentials: 'same-origin' });
  if (!resp.ok) {
    throw new Error(`No se pudo leer el workspace (${resp.status}).`);
  }
  const cloudData = await resp.json();
  return normalizeDataPayload(cloudData);
}

export async function loadData(profileId = null) {
  let localData = readLocalPayload(profileId);

  try {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    const resp = await fetch(`/api/data${query}`, { credentials: 'same-origin' });
    if (resp.ok) {
      const cloudData = await resp.json();
      const safeCloudData = normalizeDataPayload(cloudData);
      const resolvedProfileId = typeof cloudData.activeProfileId === 'string' ? cloudData.activeProfileId : profileId;
      // Important: for explicit profiles, trust cloud as source of truth to avoid cross-workspace bleed.
      const shouldPreferLocal = !resolvedProfileId && hasAnyData(localData) && !hasAnyData(safeCloudData);
      const effectiveData = shouldPreferLocal ? localData : safeCloudData;
      if (resolvedProfileId) {
        lastCloudSnapshotByProfile.set(resolvedProfileId, clonePayload(effectiveData));
      }
      // Prefer local when cloud comes back empty, to avoid data loss on transient sync failures.
      localStorage.setItem(profileStorageKey(resolvedProfileId), JSON.stringify(effectiveData));
      if (!resolvedProfileId) {
        // Keep legacy key only for default/no-profile scope.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(effectiveData));
      }
      return {
        ...effectiveData,
        authenticated: true,
        profiles: Array.isArray(cloudData.profiles) ? cloudData.profiles : [],
        activeProfileId: resolvedProfileId || null,
      };
    }
    if (resp.status === 401) return { ...localData, authenticated: false, profiles: [], activeProfileId: profileId };
    console.warn("La nube respondió con error, manteniendo la sesión local:", resp.status);
    let cloudError = `Cloud sync read failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') cloudError = data.error;
    } catch {
      // ignore non-json body
    }
    return { ...localData, authenticated: true, profiles: null, activeProfileId: profileId, cloudError };
  } catch (e) {
    console.warn("Error sincronizando con la nube:", e);
  }

  return { ...localData, authenticated: false, profiles: null, activeProfileId: profileId, cloudError: null };
}

export async function saveData(payload, authenticated = false, profileId = null) {
  // 1. Guardar local siempre
  try {
    localStorage.setItem(profileStorageKey(profileId), JSON.stringify(payload));
    if (!profileId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // El guardado local puede fallar por cuota o modo privado; la nube sigue siendo el respaldo.
  }

  // 2. Si hay sesión, sincronizar con la nube usando cookie HttpOnly
  if (authenticated) {
    if (!profileId) {
      // Never sync to cloud without an explicit profile id in multi-workspace mode.
      return;
    }
    try {
      const previousSnapshot = lastCloudSnapshotByProfile.get(profileId) || null;
      const ops = previousSnapshot ? buildIncrementalOps(previousSnapshot, payload) : null;
      const requestBody = (ops && hasAnyOps(ops))
        ? { profileId, ops }
        : { profileId, payload };
      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(requestBody)
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || `Sync HTTP ${resp.status}`);
      }
      lastCloudSnapshotByProfile.set(profileId, clonePayload(payload));
    } catch (e) {
      console.warn("Error guardando en la nube:", e);
      throw e;
    }
  }
}
