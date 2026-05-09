const VALID_STATUS = new Set(['not_done', 'started', 'in_progress', 'paused', 'blocked', 'done']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);
const SESSION_COOKIE = '__Host-taskmanager_session';
const LOCAL_SESSION_COOKIE = 'taskmanager_session';
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

function withSecurityHeaders(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: withSecurityHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {})
    })
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

function isLocalRequest(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}

function sessionCookie(value, request) {
  if (isLocalRequest(request)) {
    return `${LOCAL_SESSION_COOKIE}=${value}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`;
  }
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie(request) {
  const localCookie = `${LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const secureCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
  return isLocalRequest(request) ? localCookie : secureCookie;
}

function isValidTask(task) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : null);
  return (
    task &&
    typeof task === 'object' &&
    typeof task.id === 'string' &&
    typeof taskName === 'string' &&
    (task.ticketNumber === undefined || typeof task.ticketNumber === 'string') &&
    VALID_STATUS.has(task.status) &&
    VALID_PRIORITY.has(task.priority) &&
    (task.url === undefined || typeof task.url === 'string') &&
    (task.notes === undefined || typeof task.notes === 'string') &&
    (task.hideInKanbanDone === undefined || typeof task.hideInKanbanDone === 'boolean') &&
    Array.isArray(task.subtasks) &&
    (task.dependencyTaskIds === undefined || (
      Array.isArray(task.dependencyTaskIds) &&
      task.dependencyTaskIds.every((dependencyId) => typeof dependencyId === 'string')
    )) &&
    task.subtasks.every((st) => (
      st &&
      typeof st === 'object' &&
      typeof st.id === 'string' &&
      typeof st.text === 'string' &&
      typeof st.done === 'boolean'
    ))
  );
}

function isValidNote(note) {
  return (
    note &&
    typeof note === 'object' &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.text === 'string' &&
    (note.x === undefined || typeof note.x === 'number') &&
    (note.y === undefined || typeof note.y === 'number')
  );
}

function isValidEvent(event) {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    typeof event.startDate === 'string' &&
    (event.endDate === undefined || event.endDate === null || typeof event.endDate === 'string') &&
    typeof event.color === 'string'
  );
}

function isValidPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.tasks) &&
    payload.tasks.every(isValidTask) &&
    Array.isArray(payload.boardNotes) &&
    payload.boardNotes.every(isValidNote) &&
    Array.isArray(payload.events) &&
    payload.events.every(isValidEvent)
  );
}

function normalizeSyncBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (isValidPayload(body)) {
    return { profileId: typeof body.profileId === 'string' ? body.profileId : null, mode: 'payload', payload: body };
  }
  if (body.payload && isValidPayload(body.payload)) {
    return { profileId: typeof body.profileId === 'string' ? body.profileId : null, mode: 'payload', payload: body.payload };
  }

  const isValidDeleteList = (list) => Array.isArray(list) && list.every((id) => typeof id === 'string');
  const isValidOpsGroup = (group, validator) => (
    group &&
    typeof group === 'object' &&
    Array.isArray(group.upserts) &&
    group.upserts.every(validator) &&
    isValidDeleteList(group.deletes)
  );

  if (body.ops && typeof body.ops === 'object') {
    const { tasks, notes, events } = body.ops;
    if (
      isValidOpsGroup(tasks, isValidTask) &&
      isValidOpsGroup(notes, isValidNote) &&
      isValidOpsGroup(events, isValidEvent)
    ) {
      return {
        profileId: typeof body.profileId === 'string' ? body.profileId : null,
        mode: 'ops',
        ops: { tasks, notes, events }
      };
    }
  }
  return null;
}

function prepareTaskUpsert(env, profileId, userId, task, taskSchema) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : '');
  const hasName = Boolean(taskSchema?.hasName);
  const hasDescription = Boolean(taskSchema?.hasDescription);
  const hasUrl = Boolean(taskSchema?.hasUrl);
  const hasNotes = Boolean(taskSchema?.hasNotes);
  const hasTicketNumber = Boolean(taskSchema?.hasTicketNumber);

  const columns = ['id', 'user_id', 'profile_id'];
  const placeholders = ['?', '?', '?'];
  const bindings = [
    scopedEntityId(profileId, task.id),
    userId,
    profileId
  ];
  const updates = [];
  const changeChecks = [];

  if (hasName) {
    columns.push('name');
    placeholders.push('?');
    bindings.push(taskName);
    updates.push('name = excluded.name');
    changeChecks.push('tasks.name IS NOT excluded.name');
  }
  if (hasDescription) {
    // Legacy compatibility: keep description in sync when the old column still exists.
    columns.push('description');
    placeholders.push('?');
    bindings.push(taskName);
    updates.push('description = excluded.description');
    changeChecks.push('tasks.description IS NOT excluded.description');
  }
  if (hasUrl) {
    columns.push('url');
    placeholders.push('?');
    bindings.push(task.url || null);
    updates.push('url = excluded.url');
    changeChecks.push('tasks.url IS NOT excluded.url');
  }
  if (hasNotes) {
    columns.push('notes');
    placeholders.push('?');
    bindings.push(task.notes || null);
    updates.push('notes = excluded.notes');
    changeChecks.push('tasks.notes IS NOT excluded.notes');
  }
  if (hasTicketNumber) {
    columns.push('ticket_number');
    placeholders.push('?');
    bindings.push(typeof task.ticketNumber === 'string' ? task.ticketNumber.trim() : null);
    updates.push('ticket_number = excluded.ticket_number');
    changeChecks.push('tasks.ticket_number IS NOT excluded.ticket_number');
  }

  columns.push('status', 'priority', 'category', 'date', 'time', 'subtasks', 'dependencies', 'hide_in_kanban_done');
  placeholders.push('?', '?', '?', '?', '?', '?', '?', '?');
  bindings.push(
    task.status,
    task.priority,
    task.category || null,
    task.date || null,
    task.time || null,
    JSON.stringify(task.subtasks || []),
    JSON.stringify(task.dependencyTaskIds || []),
    task.hideInKanbanDone ? 1 : 0
  );
  updates.push(
    'status = excluded.status',
    'priority = excluded.priority',
    'category = excluded.category',
    'date = excluded.date',
    'time = excluded.time',
    'subtasks = excluded.subtasks',
    'dependencies = excluded.dependencies',
    'hide_in_kanban_done = excluded.hide_in_kanban_done',
    'updated_at = CURRENT_TIMESTAMP'
  );
  changeChecks.push(
    'tasks.status IS NOT excluded.status',
    'tasks.priority IS NOT excluded.priority',
    'tasks.category IS NOT excluded.category',
    'tasks.date IS NOT excluded.date',
    'tasks.time IS NOT excluded.time',
    'tasks.subtasks IS NOT excluded.subtasks',
    'tasks.dependencies IS NOT excluded.dependencies',
    'tasks.hide_in_kanban_done IS NOT excluded.hide_in_kanban_done'
  );

  const statement =
    `INSERT INTO tasks (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')} ` +
    `WHERE tasks.user_id = excluded.user_id AND tasks.profile_id = excluded.profile_id AND (${changeChecks.join(' OR ')})`;
  return env.DB.prepare(statement).bind(...bindings);
}

function prepareNoteUpsert(env, profileId, userId, note) {
  return env.DB.prepare(
    "INSERT INTO notes (id, user_id, profile_id, title, text, x, y) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, text = excluded.text, x = excluded.x, y = excluded.y, updated_at = CURRENT_TIMESTAMP " +
    "WHERE notes.user_id = excluded.user_id AND notes.profile_id = excluded.profile_id AND (" +
    "notes.title IS NOT excluded.title OR notes.text IS NOT excluded.text OR notes.x IS NOT excluded.x OR notes.y IS NOT excluded.y)"
  ).bind(
    scopedEntityId(profileId, note.id),
    userId,
    profileId,
    note.title || '',
    note.text || '',
    note.x || 0,
    note.y || 0
  );
}

function prepareEventUpsert(env, profileId, userId, event) {
  return env.DB.prepare(
    "INSERT INTO events (id, user_id, profile_id, title, startDate, endDate, color) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, startDate = excluded.startDate, endDate = excluded.endDate, color = excluded.color, updated_at = CURRENT_TIMESTAMP " +
    "WHERE events.user_id = excluded.user_id AND events.profile_id = excluded.profile_id AND (" +
    "events.title IS NOT excluded.title OR events.startDate IS NOT excluded.startDate OR events.endDate IS NOT excluded.endDate OR events.color IS NOT excluded.color)"
  ).bind(
    scopedEntityId(profileId, event.id),
    userId,
    profileId,
    event.title,
    event.startDate,
    event.endDate || null,
    event.color || '#3b82f6'
  );
}

async function ensureProfilesSchema(env) {
  const safeExec = async (statement, ...bindings) => {
    try {
      await env.DB.prepare(statement).bind(...bindings).run();
    } catch {
      // Keep schema bootstrap resilient across mixed DB versions.
    }
  };

  await safeExec("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id)");
  await safeExec("ALTER TABLE tasks ADD COLUMN profile_id TEXT");
  await safeExec("ALTER TABLE notes ADD COLUMN profile_id TEXT");
  await safeExec("ALTER TABLE events ADD COLUMN profile_id TEXT");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_tasks_user_profile ON tasks(user_id, profile_id)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_notes_user_profile ON notes(user_id, profile_id)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_events_user_profile ON events(user_id, profile_id)");
  await safeExec("ALTER TABLE tasks ADD COLUMN hide_in_kanban_done INTEGER DEFAULT 0");
  await safeExec("ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]'");
  await safeExec("ALTER TABLE tasks ADD COLUMN name TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN url TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN notes TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN ticket_number TEXT");
  await safeExec("UPDATE tasks SET name = description WHERE name IS NULL");

  const hasProfileColumn = async (tableName) => {
    try {
      const { results } = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
      return Array.isArray(results) && results.some((col) => col?.name === 'profile_id');
    } catch {
      return false;
    }
  };

  const tasksHasProfile = await hasProfileColumn('tasks');
  const notesHasProfile = await hasProfileColumn('notes');
  const eventsHasProfile = await hasProfileColumn('events');
  if (!tasksHasProfile || !notesHasProfile || !eventsHasProfile) {
    throw new Error('D1 schema mismatch: profile_id column missing in one or more tables.');
  }

  let taskColumns;
  try {
    const { results } = await env.DB.prepare("PRAGMA table_info(tasks)").all();
    taskColumns = Array.isArray(results) ? results.map((col) => col?.name).filter(Boolean) : [];
  } catch {
    taskColumns = [];
  }
  return {
    hasName: taskColumns.includes('name'),
    hasDescription: taskColumns.includes('description'),
    hasUrl: taskColumns.includes('url'),
    hasNotes: taskColumns.includes('notes'),
    hasTicketNumber: taskColumns.includes('ticket_number')
  };
}

async function ensureDefaultProfile(env, userId) {
  const defaultProfileId = `${userId}:work`;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
  ).bind(defaultProfileId, userId, 'Trabajo').run();

  // Migrate legacy rows with NULL profile_id into default profile.
  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE notes SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE events SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId)
  ]);

  return defaultProfileId;
}

async function resolveProfileId(env, userId, requestedProfileId) {
  const defaultProfileId = await ensureDefaultProfile(env, userId);
  if (!requestedProfileId) return defaultProfileId;
  const row = await env.DB.prepare(
    "SELECT id FROM profiles WHERE id = ? AND user_id = ?"
  ).bind(requestedProfileId, userId).first();
  return row?.id || defaultProfileId;
}

function sanitizeProfileName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').slice(0, 40);
}

function buildProfileId(userId, name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
  return `${userId}:${slug}:${Date.now().toString(36)}`;
}

function scopedEntityId(profileId, entityId) {
  if (typeof entityId !== 'string') return entityId;
  return `${profileId}::${entityId}`;
}

function unscopedEntityId(profileId, storedId) {
  if (typeof storedId !== 'string') return storedId;
  const prefix = `${profileId}::`;
  return storedId.startsWith(prefix) ? storedId.slice(prefix.length) : storedId;
}

async function verifyGoogleToken(token, env) {
  if (!token) return null;
  const googleResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  const info = await googleResp.json();
  if (!googleResp.ok || info.error) return null;
  if (info.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) return null;
  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) return null;
  return info.sub || null;
}

async function authenticate(request, env) {
  const token = getCookie(request, SESSION_COOKIE) || getCookie(request, LOCAL_SESSION_COOKIE);
  return verifyGoogleToken(token, env);
}

export default {
  // Student Planner Lite (no Workers AI)
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env?.DB) {
        return json({ error: 'D1 binding missing: DB is not configured in this environment.' }, { status: 500 });
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        try {
          const { credential } = await request.json();
          const userId = await verifyGoogleToken(credential, env);
          if (!userId) return json({ error: 'Token inválido' }, { status: 401 });
          return json(
            { success: true },
            { headers: { 'Set-Cookie': sessionCookie(credential, request) } }
          );
        } catch {
          return json({ error: 'Login inválido' }, { status: 400 });
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        return json(
          { success: true },
          { headers: { 'Set-Cookie': clearSessionCookie(request) } }
        );
      }

      const userId = await authenticate(request, env);
      if (!userId) return json({ error: 'No autorizado' }, { status: 401 });

      const path = url.pathname.replace('/api', '');
      
      try {
        if (request.method === 'GET' && path === '/session') {
          return json({ authenticated: true });
        }
        const taskSchema = await ensureProfilesSchema(env);
        const requestedProfileId = url.searchParams.get('profileId');
        const profileId = await resolveProfileId(env, userId, requestedProfileId);

        if (request.method === 'POST' && path === '/profiles') {
          const body = await request.json();
          const name = sanitizeProfileName(body?.name);
          if (!name) return json({ error: 'Nombre de perfil inválido' }, { status: 400 });
          const newProfile = { id: buildProfileId(userId, name), name };
          await env.DB.prepare(
            "INSERT INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
          ).bind(newProfile.id, userId, newProfile.name).run();
          return json({ profile: newProfile });
        }

        if (request.method === 'POST' && path === '/profiles/delete') {
          const body = await request.json();
          const targetProfileId = typeof body?.profileId === 'string' ? body.profileId : '';
          if (!targetProfileId) return json({ error: 'profileId inválido' }, { status: 400 });

          const { results: userProfiles } = await env.DB.prepare(
            "SELECT id, name, created_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
          ).bind(userId).all();

          const existing = userProfiles.find((p) => p.id === targetProfileId);
          if (!existing) {
            const { results: currentProfiles } = await env.DB.prepare(
              "SELECT id, name, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
            ).bind(userId).all();
            const fallbackProfileId = currentProfiles[0]?.id || null;
            return json({ error: 'El workspace no existe.', profiles: currentProfiles, activeProfileId: fallbackProfileId }, { status: 404 });
          }
          if (userProfiles.length <= 1) {
            return json({ error: 'No puedes borrar el único workspace.' }, { status: 400 });
          }

          await env.DB.batch([
            env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
            env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
            env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
            env.DB.prepare("DELETE FROM profiles WHERE user_id = ? AND id = ?").bind(userId, targetProfileId)
          ]);

          const { results: remainingProfiles } = await env.DB.prepare(
            "SELECT id, name, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
          ).bind(userId).all();

          const fallbackProfileId = remainingProfiles[0]?.id || null;
          return json({ success: true, profiles: remainingProfiles, activeProfileId: fallbackProfileId });
        }

        if (request.method === 'GET' && path === '/data') {
          const { results: profiles } = await env.DB.prepare(
            "SELECT id, name, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
          ).bind(userId).all();
          const { results: tasks } = await env.DB.prepare(
            "SELECT * FROM tasks WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          const { results: notes } = await env.DB.prepare(
            "SELECT * FROM notes WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          const { results: events } = await env.DB.prepare(
            "SELECT * FROM events WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          
          const parsedTasks = tasks.map((t) => ({
            ...t,
            name: typeof t.name === 'string' ? t.name : (typeof t.description === 'string' ? t.description : ''),
            url: typeof t.url === 'string' ? t.url : '',
            notes: typeof t.notes === 'string' ? t.notes : '',
            id: unscopedEntityId(profileId, t.id),
            hideInKanbanDone: Boolean(t.hide_in_kanban_done),
            subtasks: JSON.parse(t.subtasks || '[]'),
            dependencyTaskIds: JSON.parse(t.dependencies || '[]'),
            ticketNumber: typeof t.ticket_number === 'string' ? t.ticket_number : ''
          }));
          const parsedNotes = notes.map(({ created_at, updated_at, ...note }) => ({
            ...note,
            id: unscopedEntityId(profileId, note.id),
            createdAt: created_at,
            updatedAt: updated_at
          }));
          const parsedEvents = events.map((event) => ({
            ...event,
            id: unscopedEntityId(profileId, event.id)
          }));
          return json({ tasks: parsedTasks, boardNotes: parsedNotes, events: parsedEvents, profiles, activeProfileId: profileId });
        }

        if (request.method === 'POST' && path === '/sync') {
          const syncStartedAt = Date.now();
          const body = await request.json();
          const normalizedBody = normalizeSyncBody(body);
          if (!normalizedBody) {
            return json({ error: 'Payload inválido' }, { status: 400 });
          }
          const syncProfileId = await resolveProfileId(env, userId, normalizedBody.profileId);
          const batch = [];
          let taskCount = 0;
          let noteCount = 0;
          let eventCount = 0;

          if (normalizedBody.mode === 'payload') {
            const { tasks, boardNotes, events } = normalizedBody.payload;
            taskCount = tasks.length;
            noteCount = boardNotes.length;
            eventCount = events.length;

            batch.push(
              env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
              env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
              env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId)
            );

            for (const t of tasks) {
              batch.push(prepareTaskUpsert(env, syncProfileId, userId, t, taskSchema));
            }
            for (const n of boardNotes) {
              batch.push(prepareNoteUpsert(env, syncProfileId, userId, n));
            }
            for (const e of events) {
              batch.push(prepareEventUpsert(env, syncProfileId, userId, e));
            }
          } else {
            const { tasks, notes, events } = normalizedBody.ops;
            taskCount = tasks.upserts.length + tasks.deletes.length;
            noteCount = notes.upserts.length + notes.deletes.length;
            eventCount = events.upserts.length + events.deletes.length;

            for (const taskId of tasks.deletes) {
              batch.push(
                env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ? AND id = ?")
                  .bind(userId, syncProfileId, scopedEntityId(syncProfileId, taskId))
              );
            }
            for (const noteId of notes.deletes) {
              batch.push(
                env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ? AND id = ?")
                  .bind(userId, syncProfileId, scopedEntityId(syncProfileId, noteId))
              );
            }
            for (const eventId of events.deletes) {
              batch.push(
                env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ? AND id = ?")
                  .bind(userId, syncProfileId, scopedEntityId(syncProfileId, eventId))
              );
            }

            for (const t of tasks.upserts) {
              batch.push(prepareTaskUpsert(env, syncProfileId, userId, t, taskSchema));
            }
            for (const n of notes.upserts) {
              batch.push(prepareNoteUpsert(env, syncProfileId, userId, n));
            }
            for (const e of events.upserts) {
              batch.push(prepareEventUpsert(env, syncProfileId, userId, e));
            }
          }

          if (batch.length > 0) await env.DB.batch(batch);
          console.log('[sync] write batch completed', {
            userId,
            profileId: syncProfileId,
            mode: normalizedBody.mode,
            taskCount,
            noteCount,
            eventCount,
            statementCount: batch.length,
            elapsedMs: Date.now() - syncStartedAt
          });
          return json({ success: true, activeProfileId: syncProfileId });
        }
      } catch (err) {
        console.error('API error', path, err);
        return json({ error: err.message }, { status: 500 });
      }
    }

    // Modern Assets (2026): El Worker sirve los archivos de la carpeta assets configurada
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
