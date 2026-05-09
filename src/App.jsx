import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { uid, toDateStr, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment } from './utils.jsx';
import {
  loadData,
  saveData,
  validateBackupPayload,
  normalizeDataPayload,
  loginWithGoogleCredential,
  logoutSession,
  createProfile,
  deleteProfile,
  checkSession,
  fetchWorkspaceData,
  isMultiBackupPayload,
  validateMultiBackupPayload,
  normalizeMultiBackupPayload,
} from './storage.js';
import CalendarView from './components/CalendarView.jsx';
import BoardView from './components/BoardView.jsx';
import ScheduleView from './components/ScheduleView.jsx';
import TaskModal from './components/TaskModal.jsx';
import EventModal from './components/EventModal.jsx';
import ScheduleModal from './components/ScheduleModal.jsx';
import BottomNav from './components/BottomNav.jsx';
import Login from './components/Login.jsx';

function serializePayload(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

export default function App() {
  const ACTIVE_PROFILE_STORAGE_KEY = 'studentplanner_active_profile';
  const THEME_STORAGE_KEY = 'studentplanner_theme';
  const [authenticated, setAuthenticated] = useState(null);
  const [authVersion, setAuthVersion] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [boardNotes, setBoardNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [scheduleSubjects, setScheduleSubjects] = useState([]);
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [ready, setReady] = useState(false);
  const [hydratedSession, setHydratedSession] = useState(null);
  const [view, setView] = useState('calendar');
  const [modal, setModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [syncState, setSyncState] = useState('idle');
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'dark' ? 'dark' : 'light';
  });
  const [quickAdd, setQuickAdd] = useState('');
  const fileInputRef = useRef(null);
  const profileMenuRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const syncFeedbackTimerRef = useRef(null);
  const syncDebounceTimerRef = useRef(null);
  const lastSyncedPayloadRef = useRef('');
  const latestPayloadRef = useRef({
    tasks: [],
    boardNotes: [],
    events: [],
    scheduleSubjects: [],
    scheduleSlots: [],
  });
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const syncNowRef = useRef(async () => false);

  const clearSyncDebounce = useCallback(() => {
    if (syncDebounceTimerRef.current) {
      window.clearTimeout(syncDebounceTimerRef.current);
      syncDebounceTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    syncNowRef.current = async ({ immediate = false } = {}) => {
      if (!ready || hydratedSession !== authenticated) return false;
      const payload = latestPayloadRef.current;
      const serialized = serializePayload(payload);
      if (!serialized || serialized === lastSyncedPayloadRef.current) return false;

      if (syncInFlightRef.current) {
        pendingSyncRef.current = true;
        return false;
      }

      if (immediate) clearSyncDebounce();

      const syncCloud = Boolean(authenticated && activeProfileId);

      syncInFlightRef.current = true;
      if (syncCloud) setSyncState('saving');
      try {
        await saveData(payload, syncCloud, activeProfileId);
        lastSyncedPayloadRef.current = serialized;
        if (syncCloud) {
          setSyncState('saved');
          if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
          syncFeedbackTimerRef.current = window.setTimeout(() => setSyncState('idle'), 1600);
        }
        return true;
      } catch {
        if (syncCloud) setSyncState('error');
        return false;
      } finally {
        syncInFlightRef.current = false;
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false;
          void syncNowRef.current({ immediate: true });
        }
      }
    };
  }, [ready, hydratedSession, authenticated, activeProfileId, clearSyncDebounce]);

  const syncNow = (...args) => syncNowRef.current(...args);

  useEffect(() => {
    localStorage.removeItem('userToken');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#111827' : '#2563eb');
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    loadData(activeProfileId).then((data) => {
      if (cancelled) return;
      setTasks(data.tasks);
      setBoardNotes(data.boardNotes);
      setEvents(data.events || []);
      setScheduleSubjects(data.scheduleSubjects || []);
      setScheduleSlots(data.scheduleSlots || []);
      const loadedPayload = {
        tasks: data.tasks,
        boardNotes: data.boardNotes,
        events: data.events || [],
        scheduleSubjects: data.scheduleSubjects || [],
        scheduleSlots: data.scheduleSlots || [],
      };
      latestPayloadRef.current = loadedPayload;
      lastSyncedPayloadRef.current = serializePayload(loadedPayload);
      if (Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      }
      if (data.activeProfileId && data.activeProfileId !== activeProfileId) {
        setActiveProfileId(data.activeProfileId);
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, data.activeProfileId);
      }
      setAuthenticated(data.authenticated);
      setHydratedSession(data.authenticated);
      if (data.cloudError) {
        setBackupMessage(`Sync D1: ${data.cloudError}`);
        setTimeout(() => setBackupMessage(''), 5500);
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [authVersion, activeProfileId]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (!actionsMenuRef.current?.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleLoginSuccess = async (credential) => {
    await loginWithGoogleCredential(credential);
    setReady(false);
    setAuthenticated(true);
    setAuthVersion((version) => version + 1);
  };

  const handleLogout = async () => {
    try {
      await syncNow({ immediate: true });
    } catch {
      // Best-effort flush before ending session.
    }
    await logoutSession();
    setAuthenticated(false);
    setReady(false);
    setHydratedSession(null);
    setScheduleModal(null);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
    setScheduleSubjects([]);
    setScheduleSlots([]);
    setProfiles([]);
    setActiveProfileId(null);
    setSyncState('idle');
    setShowProfileMenu(false);
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  };

  const forceLogout = () => {
    setAuthenticated(false);
    setReady(false);
    setHydratedSession(null);
    setScheduleModal(null);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
    setScheduleSubjects([]);
    setScheduleSlots([]);
    setProfiles([]);
    setActiveProfileId(null);
    setSyncState('idle');
    setShowProfileMenu(false);
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  };

  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    const verifyActiveSession = async () => {
      try {
        const active = await checkSession();
        if (!cancelled && !active) {
          forceLogout();
        }
      } catch {
        // Ignore transient network errors and keep current session state.
      }
    };
    const intervalId = window.setInterval(verifyActiveSession, 60000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') verifyActiveSession();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    verifyActiveSession();
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authenticated]);

  useEffect(() => {
    latestPayloadRef.current = {
      tasks,
      boardNotes,
      events,
      scheduleSubjects,
      scheduleSlots,
    };
    if (!ready || hydratedSession !== authenticated) return undefined;
    clearSyncDebounce();
    syncDebounceTimerRef.current = window.setTimeout(() => {
      void syncNowRef.current();
    }, 2000);
    return () => clearSyncDebounce();
  }, [tasks, boardNotes, events, scheduleSubjects, scheduleSlots, ready, authenticated, hydratedSession, activeProfileId, clearSyncDebounce]);

  useEffect(() => {
    if (!authenticated) return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void syncNowRef.current({ immediate: true });
      }
    };
    const onBeforeUnload = () => {
      void syncNowRef.current({ immediate: true });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [authenticated, ready, hydratedSession, activeProfileId]);

  useEffect(() => () => {
    if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
    clearSyncDebounce();
  }, [clearSyncDebounce]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModal(null);
        setEventModal(null);
        setScheduleModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const triggerJsonDownload = (data, fileName) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBackup = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `student-planner-lite-backup-${date}.json`;

    if (!authenticated || !Array.isArray(profiles) || profiles.length === 0) {
      const payload = { tasks, boardNotes, events, scheduleSubjects, scheduleSlots };
      if (!validateBackupPayload(payload)) {
        setBackupMessage('Error: los datos internos están corruptos y no se puede exportar el backup.');
        setTimeout(() => setBackupMessage(''), 5000);
        return;
      }
      triggerJsonDownload(payload, fileName);
      setBackupMessage(`Exportado ${fileName}`);
      setTimeout(() => setBackupMessage(''), 3500);
      return;
    }

    setBackupMessage('Exportando todos los espacios...');
    try {
      const activePayload = { tasks, boardNotes, events, scheduleSubjects, scheduleSlots };
      const workspacesData = await Promise.all(
        profiles.map(async (profile) => {
          const data = profile.id === activeProfileId
            ? activePayload
            : await fetchWorkspaceData(profile.id);
          return { id: profile.id, name: profile.name, ...data };
        })
      );
      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        workspaces: workspacesData,
      };
      if (!validateMultiBackupPayload(backup)) {
        setBackupMessage('Error: los datos exportados están corruptos.');
        setTimeout(() => setBackupMessage(''), 5000);
        return;
      }
      triggerJsonDownload(backup, fileName);
      setBackupMessage(`Exportado ${fileName} (${workspacesData.length} espacio${workspacesData.length === 1 ? '' : 's'})`);
      setTimeout(() => setBackupMessage(''), 4000);
    } catch (err) {
      setBackupMessage(`Error al exportar: ${err.message}`);
      setTimeout(() => setBackupMessage(''), 5000);
    }
  };

  const importLegacyBackup = (parsed) => {
    const normalized = normalizeDataPayload(parsed);
    const hasImportShape = Array.isArray(parsed) || (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks));
    const sourceTasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
    const sourceNotes = Array.isArray(parsed?.boardNotes) ? parsed.boardNotes : null;
    const sourceEvents = Array.isArray(parsed?.events) ? parsed.events : null;
    const sourceSubjects = Array.isArray(parsed?.scheduleSubjects) ? parsed.scheduleSubjects : null;
    const sourceSlots = Array.isArray(parsed?.scheduleSlots) ? parsed.scheduleSlots : null;
    const droppedInvalidItems =
      normalized.tasks.length !== sourceTasks?.length ||
      (sourceNotes && normalized.boardNotes.length !== sourceNotes.length) ||
      (sourceEvents && normalized.events.length !== sourceEvents.length) ||
      (sourceSubjects && normalized.scheduleSubjects.length !== sourceSubjects.length) ||
      (sourceSlots && normalized.scheduleSlots.length !== sourceSlots.length);
    if (!hasImportShape || droppedInvalidItems || !validateBackupPayload(normalized)) {
      throw new Error('El archivo JSON no tiene la estructura esperada.');
    }
    setTasks(normalized.tasks);
    setBoardNotes(normalized.boardNotes);
    setEvents(normalized.events);
    setScheduleSubjects(normalized.scheduleSubjects || []);
    setScheduleSlots(normalized.scheduleSlots || []);
    setModal(null);
    setEventModal(null);
    setBackupMessage('Importación completada correctamente.');
  };

  const importMultiBackup = async (parsed) => {
    const normalized = normalizeMultiBackupPayload(parsed);
    if (!normalized || !validateMultiBackupPayload(normalized)) {
      throw new Error('El archivo de backup multi-espacio no es válido.');
    }
    if (!authenticated) {
      throw new Error('Necesitas iniciar sesión para importar un backup con varios espacios.');
    }

    setBackupMessage(`Importando ${normalized.workspaces.length} espacio${normalized.workspaces.length === 1 ? '' : 's'}...`);

    const existingByName = new Map(
      (profiles || []).map((profile) => [profile.name.trim().toLowerCase(), profile])
    );
    const createdProfiles = [];
    const errors = [];
    let restoredCount = 0;

    for (const workspace of normalized.workspaces) {
      const key = workspace.name.trim().toLowerCase();
      let targetProfile = existingByName.get(key);
      try {
        if (!targetProfile) {
          targetProfile = await createProfile(workspace.name);
          if (targetProfile) {
            existingByName.set(key, targetProfile);
            createdProfiles.push(targetProfile);
          }
        }
        if (!targetProfile?.id) throw new Error('No se pudo resolver el espacio destino.');
        const payload = {
          tasks: workspace.tasks,
          boardNotes: workspace.boardNotes,
          events: workspace.events,
          scheduleSubjects: workspace.scheduleSubjects || [],
          scheduleSlots: workspace.scheduleSlots || [],
        };
        await saveData(payload, true, targetProfile.id);
        restoredCount += 1;
      } catch (err) {
        errors.push(`"${workspace.name}": ${err.message}`);
      }
    }

    if (createdProfiles.length > 0) {
      setProfiles((prev) => [...prev, ...createdProfiles]);
    }

    setModal(null);
    setEventModal(null);
    setReady(false);
    setAuthVersion((version) => version + 1);

    if (errors.length === 0) {
      setBackupMessage(`Importados ${restoredCount} espacio${restoredCount === 1 ? '' : 's'} correctamente.`);
    } else {
      setBackupMessage(`Importación parcial (${restoredCount} ok, ${errors.length} con errores): ${errors.join(' | ')}`);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (isMultiBackupPayload(parsed)) {
          await importMultiBackup(parsed);
        } else {
          importLegacyBackup(parsed);
        }
      } catch (err) {
        setBackupMessage(`Error al importar: ${err.message}`);
      }
      e.target.value = '';
      setTimeout(() => setBackupMessage(''), 6000);
    };
    reader.readAsText(file);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  const upsert = (task) => {
    setTasks((previousTasks) => {
      const taskId = task.id || uid();
      const nextTask = {
        ...task,
        id: taskId,
        dependencyTaskIds: [],
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      };
      return task.id
        ? previousTasks.map((item) => item.id === task.id ? nextTask : item)
        : [...previousTasks, nextTask];
    });
    setModal(null);
  };

  const del = (id) => {
    setTasks((previousTasks) => previousTasks
      .filter((task) => task.id !== id)
      .map((task) => ({
        ...task,
        dependencyTaskIds: (task.dependencyTaskIds || []).filter((dependencyId) => dependencyId !== id),
      })));
    setModal(null);
  };

  const open = (init = {}) => setModal({
    name: '',
    notes: '',
    status: 'not_done',
    priority: 'medium',
    date: '',
    time: '',
    subtasks: [],
    ...init,
  });

  const toggleDone = (id) => {
    setTasks((previousTasks) => previousTasks.map((item) => (
      item.id === id
        ? { ...item, status: item.status === 'done' ? 'not_done' : 'done' }
        : item
    )));
  };

  const addBoardNote = (note) => setBoardNotes((p) => [note, ...p]);
  const deleteBoardNote = (id) => setBoardNotes((p) => p.filter((note) => note.id !== id));
  const updateBoardNote = (id, changes) => setBoardNotes((p) => p.map((note) => note.id === id ? { ...note, ...changes } : note));

  const upsertEvent = (event) => {
    setEvents((p) => (event.id ? p.map((e) => (e.id === event.id ? event : e)) : [...p, { ...event, id: uid() }]));
    setEventModal(null);
  };
  const deleteEvent = (id) => { setEvents((p) => p.filter((e) => e.id !== id)); setEventModal(null); };
  const openEventModal = (init = {}) => setEventModal({ title: '', startDate: '', endDate: '', color: '#2563eb', ...init });

  const NEW_SCHEDULE_SUBJECT = '__new__';

  const handleScheduleSave = (data) => {
    const {
      subjectChoice,
      name,
      color,
      weekdays,
      startTime,
      durationMinutes,
    } = data;

    const upsertSubjectMeta = (subjectId) => {
      setScheduleSubjects((p) => p.map((s) => (s.id === subjectId ? {
        ...s,
        name,
        color,
      } : s)));
    };

    const createNewSubject = () => {
      const subjectId = uid();
      setScheduleSubjects((p) => [...p, {
        id: subjectId,
        name,
        color,
      }]);
      return subjectId;
    };

    const resolveSubjectId = () => {
      if (subjectChoice === NEW_SCHEDULE_SUBJECT) return createNewSubject();
      upsertSubjectMeta(subjectChoice);
      return subjectChoice;
    };

    if (scheduleModal?.mode === 'add') {
      const subjectId = resolveSubjectId();
      setScheduleSlots((p) => [
        ...p,
        ...weekdays.map((wd) => ({
          id: uid(),
          subjectId,
          weekday: wd,
          startTime,
          durationMinutes,
        })),
      ]);
      setScheduleModal(null);
      return;
    }

    if (scheduleModal?.mode === 'edit' && scheduleModal.slotId) {
      const slotId = scheduleModal.slotId;
      const existing = scheduleSlots.find((s) => s.id === slotId);
      if (!existing) {
        setScheduleModal(null);
        return;
      }

      let subjectId;
      if (subjectChoice === NEW_SCHEDULE_SUBJECT) {
        subjectId = createNewSubject();
      } else {
        upsertSubjectMeta(subjectChoice);
        subjectId = subjectChoice;
      }

      const nextSlots = [
        ...scheduleSlots.filter((s) => s.id !== slotId),
        ...weekdays.map((wd) => ({
          id: uid(),
          subjectId,
          weekday: wd,
          startTime,
          durationMinutes,
        })),
      ];
      const usedSubjectIds = new Set(nextSlots.map((s) => s.subjectId));
      setScheduleSlots(nextSlots);
      setScheduleSubjects((subs) => subs.filter((s) => usedSubjectIds.has(s.id)));
      setScheduleModal(null);
      return;
    }

    setScheduleModal(null);
  };

  const deleteScheduleSlotOnly = (slotId) => {
    const slot = scheduleSlots.find((s) => s.id === slotId);
    if (!slot) {
      setScheduleModal(null);
      return;
    }
    const subjId = slot.subjectId;
    const nextSlots = scheduleSlots.filter((s) => s.id !== slotId);
    const stillHasSubject = nextSlots.some((s) => s.subjectId === subjId);
    setScheduleSlots(nextSlots);
    if (!stillHasSubject) {
      setScheduleSubjects((p) => p.filter((s) => s.id !== subjId));
    }
    setScheduleModal(null);
  };

  const deleteScheduleSubjectEverywhere = (subjectId) => {
    setScheduleSubjects((p) => p.filter((s) => s.id !== subjectId));
    setScheduleSlots((p) => p.filter((s) => s.subjectId !== subjectId));
    setScheduleModal(null);
  };

  const handleQuickAdd = (nameInput) => {
    if (!nameInput.trim()) return;
    const parsed = parseDateTimeFromDescription(nameInput);
    let cleaned = nameInput;
    if (parsed) {
      const result = parseDescriptionDateResult(nameInput);
      cleaned = cleanDescriptionSegment(nameInput, result?.text || '');
      if (!result?.text || cleaned === nameInput.trim()) {
        cleaned = cleaned.replace(/(?:\b(?:a|al|a la|a las|el|la|en|para)\b.*)$/i, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
    upsert({
      name: cleaned || nameInput.trim(),
      date: parsed?.date || '',
      time: parsed?.time || '',
      status: 'not_done',
      priority: 'medium',
      subtasks: [],
      notes: '',
    });
    setQuickAdd('');
  };

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null;
  const activeProfileName = activeProfile?.name || 'Estudios';
  const profileGlyph = (activeProfileName[0] || 'E').toUpperCase();
  const mainViewTitle = view === 'calendar' ? 'Calendario' : view === 'schedule' ? 'Horario' : 'Tablero';

  const handleSelectProfile = (profileId) => {
    if (!profileId || profileId === activeProfileId) {
      setShowProfileMenu(false);
      return;
    }
    setActiveProfileId(profileId);
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
    setView('calendar');
    setModal(null);
    setEventModal(null);
    setScheduleModal(null);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
    setScheduleSubjects([]);
    setScheduleSlots([]);
    setReady(false);
    setShowProfileMenu(false);
  };

  const handleCreateProfile = async () => {
    const name = window.prompt('Nombre del espacio', 'Asignaturas')?.trim();
    if (!name) return;
    try {
      const profile = await createProfile(name);
      setProfiles((prev) => [...prev, profile]);
      handleSelectProfile(profile.id);
    } catch (error) {
      setBackupMessage(error.message || 'No se pudo crear el espacio.');
      setTimeout(() => setBackupMessage(''), 5000);
    }
  };

  const handleDeleteProfile = async (profile) => {
    if (!profile?.id) return;
    if (profiles.length <= 1) {
      setBackupMessage('No puedes borrar el único espacio.');
      setTimeout(() => setBackupMessage(''), 4000);
      return;
    }
    const confirmed = window.confirm(`Vas a borrar "${profile.name}" y todas sus tareas, notas, eventos y horario. Esta acción no se puede deshacer.\n\n¿Continuar?`);
    if (!confirmed) return;
    try {
      const result = await deleteProfile(profile.id);
      if (Array.isArray(result?.profiles)) {
        setProfiles(result.profiles);
      }
      const nextProfileId = typeof result?.activeProfileId === 'string' ? result.activeProfileId : null;
      if (nextProfileId) {
        handleSelectProfile(nextProfileId);
      }
      setBackupMessage(`Espacio "${profile.name}" eliminado.`);
      setTimeout(() => setBackupMessage(''), 4500);
    } catch (error) {
      if (typeof error?.message === 'string' && error.message.includes('no existe')) {
        try {
          const data = await loadData(activeProfileId);
          if (Array.isArray(data?.profiles)) setProfiles(data.profiles);
          if (typeof data?.activeProfileId === 'string') {
            setActiveProfileId(data.activeProfileId);
            localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, data.activeProfileId);
          }
        } catch {
          // Keep original error toast if refresh fails.
        }
      }
      setBackupMessage(error.message || 'No se pudo borrar el espacio.');
      setTimeout(() => setBackupMessage(''), 5000);
    }
  };

  const y = calDate.getFullYear();
  const mo = calDate.getMonth();
  const dIM = new Date(y, mo + 1, 0).getDate();
  const fD = new Date(y, mo, 1).getDay();

  const tByDate = {};
  tasks.forEach((t) => { if (t.date) { (tByDate[t.date] = tByDate[t.date] || []).push(t); } });
  const tasksUndated = tasks.filter((t) => !t.date);

  const eByDate = {};
  events.forEach((e) => {
    if (!e.startDate) return;
    let current = new Date(`${e.startDate}T12:00:00`);
    const end = new Date(`${(e.endDate || e.startDate)}T12:00:00`);
    while (current <= end) {
      const dStr = toDateStr(current.getFullYear(), current.getMonth(), current.getDate());
      (eByDate[dStr] = eByDate[dStr] || []).push(e);
      current.setDate(current.getDate() + 1);
    }
  });

  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  if (authenticated === null) {
    return null;
  }

  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <h2 className="sr-only">Student Planner Lite</h2>

      <header className="app-header">
        <div className="brand-block">
          <div className="workspace-switcher" ref={profileMenuRef}>
            <button
              type="button"
              className="brand-mark workspace-trigger"
              onClick={() => setShowProfileMenu((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              aria-label={`Cambiar espacio. Actual: ${activeProfileName}`}
            >
              {profileGlyph}
            </button>
            {showProfileMenu && (
              <div className="workspace-menu" role="menu">
                {profiles.map((profile) => (
                  <div key={profile.id} className="workspace-option-row">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={profile.id === activeProfileId}
                      className={`workspace-option${profile.id === activeProfileId ? ' active' : ''}`}
                      onClick={() => handleSelectProfile(profile.id)}
                    >
                      <span>{profile.name}</span>
                      {profile.id === activeProfileId && <span>✓</span>}
                    </button>
                    <button
                      type="button"
                      className="workspace-delete"
                      aria-label={`Borrar espacio ${profile.name}`}
                      title={`Borrar espacio ${profile.name}`}
                      onClick={() => handleDeleteProfile(profile)}
                      disabled={profiles.length <= 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="workspace-create" onClick={handleCreateProfile}>+ Nuevo espacio</button>
                <button type="button" className="workspace-logout" onClick={handleLogout}>Cerrar sesión</button>
              </div>
            )}
          </div>
          <div className="brand-copy">
            <span className="brand-title">{mainViewTitle}</span>
            <span className="brand-subtitle hide-mobile">
              {view === 'board'
                ? `Notas · ${activeProfileName}`
                : view === 'schedule'
                  ? `Semana · ${activeProfileName}`
                  : `Espacio: ${activeProfileName}`}
            </span>
          </div>
        </div>

        <div className="desktop-tabs hide-mobile">
          {[
            ['calendar', 'Calendario'],
            ['schedule', 'Horario'],
            ['board', 'Tablero'],
          ].map(([v, l]) => (
            <button key={v} type="button" className={view === v ? 'active' : ''} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        <div className="header-actions">
          <div
            className={`sync-indicator${syncState !== 'idle' ? ' visible' : ''}${syncState === 'error' ? ' error' : ''}`}
            aria-live="polite"
          >
            {syncState === 'saving' ? 'Guardando...' : syncState === 'saved' ? 'Guardado' : syncState === 'error' ? 'Error al guardar' : ''}
          </div>
          <div className="actions-menu-wrap hide-mobile" ref={actionsMenuRef}>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowActionsMenu((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={showActionsMenu}
            >
              Acciones
            </button>
            {showActionsMenu && (
              <div className="header-actions-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { toggleTheme(); setShowActionsMenu(false); }}>
                  {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                </button>
                <button type="button" role="menuitem" onClick={() => { void downloadBackup(); setShowActionsMenu(false); }}>Exportar backup</button>
                <button type="button" role="menuitem" onClick={() => { fileInputRef.current?.click(); setShowActionsMenu(false); }}>Importar backup</button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (view === 'board') {
                addBoardNote({
                  id: uid(),
                  title: '',
                  text: '',
                  createdAt: new Date().toISOString(),
                  x: 20 + Math.random() * 40,
                  y: 20 + Math.random() * 40,
                });
              } else if (view === 'schedule') {
                setScheduleModal({ mode: 'add' });
              } else {
                open();
              }
            }}
            aria-label={
              view === 'board'
                ? 'Crear nueva nota'
                : view === 'schedule'
                  ? 'Añadir asignatura al horario'
                  : 'Crear nueva tarea'
            }
            className="primary-button"
          >
            {view === 'board' ? '+ Nota' : view === 'schedule' ? '+ Asignatura' : '+ Tarea'}
          </button>
        </div>
      </header>

      {backupMessage && (
        <div className="toast-message">{backupMessage}</div>
      )}

      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />

      <main className="app-main">
        <section className="overview-panel compact">
          <div>
            <p className="eyebrow">Student Planner Lite</p>
            <h1>
              {view === 'calendar'
                ? 'Tu semana y entregas'
                : view === 'schedule'
                  ? 'Clases por día'
                  : 'Ideas y apuntes sueltos'}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 520 }}>
              {view === 'calendar'
                ? 'Elige un día en la cuadrícula para ver la lista. Doble clic en un día crea una tarea con esa fecha.'
                : view === 'schedule'
                  ? 'Vista semanal: cada asignatura puede tener distinto día, hora y duración. Toca una franja para editarla o borrarla.'
                  : 'Post-its en un lienzo infinito para mapas mentales o recordatorios visuales.'}
            </p>
          </div>
          {view === 'calendar' && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAdd(quickAdd);
                  }
                }}
                placeholder="Añadir rápido (ej: examen matemáticas mañana 10:00)"
                style={{
                  flex: '1 1 240px',
                  minWidth: 0,
                  borderRadius: 'var(--border-radius-md)',
                  border: '0.5px solid var(--color-border-secondary)',
                  padding: '10px 12px',
                  fontSize: 14,
                  background: 'var(--color-background-primary)',
                }}
              />
              <button type="button" className="primary-button" onClick={() => handleQuickAdd(quickAdd)} disabled={!quickAdd.trim()}>
                Añadir
              </button>
            </div>
          )}
        </section>

        {view === 'calendar' && (
          <CalendarView
            y={y}
            mo={mo}
            dIM={dIM}
            fD={fD}
            tByDate={tByDate}
            eByDate={eByDate}
            tasksUndated={tasksUndated}
            todayStr={todayStr}
            prev={() => setCalDate(new Date(y, mo - 1, 1))}
            next={() => setCalDate(new Date(y, mo + 1, 1))}
            selDay={selDay}
            setSelDay={setSelDay}
            onAddTaskForDay={(date) => open({ date })}
            onEditTask={(t) => setModal(t)}
            onToggleTaskDone={toggleDone}
            onAddEventForDay={(date) => openEventModal({ startDate: date, endDate: date })}
            onEditEvent={(e) => openEventModal(e)}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView
            scheduleSubjects={scheduleSubjects}
            scheduleSlots={scheduleSlots}
            onSelectSlot={(slotId) => setScheduleModal({ mode: 'edit', slotId })}
          />
        )}
        {view === 'board' && (
          <BoardView notes={boardNotes} onAddNote={addBoardNote} onUpdateNote={updateBoardNote} onDeleteNote={deleteBoardNote} />
        )}
      </main>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <TaskModal key={modal.id || 'new-task'} task={modal} onSave={upsert} onDelete={modal.id ? () => del(modal.id) : null} onClose={() => setModal(null)} />
        </div>
      )}

      {eventModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEventModal(null)}>
          <EventModal key={eventModal.id || 'new-event'} event={eventModal} onSave={upsertEvent} onDelete={eventModal.id ? () => deleteEvent(eventModal.id) : null} onClose={() => setEventModal(null)} />
        </div>
      )}

      {scheduleModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setScheduleModal(null)}>
          <ScheduleModal
            key={scheduleModal.mode === 'edit' ? scheduleModal.slotId : `new-schedule-${scheduleSubjects.length}`}
            mode={scheduleModal.mode}
            scheduleSubjects={scheduleSubjects}
            subject={
              scheduleModal.mode === 'edit'
                ? scheduleSubjects.find((s) => s.id === scheduleSlots.find((sl) => sl.id === scheduleModal.slotId)?.subjectId)
                : null
            }
            slot={scheduleModal.mode === 'edit' ? scheduleSlots.find((sl) => sl.id === scheduleModal.slotId) : null}
            onSave={handleScheduleSave}
            onClose={() => setScheduleModal(null)}
            onRemoveSubject={(subjectId) => {
              if (window.confirm('¿Eliminar esta asignatura y todas sus franjas del horario?')) {
                deleteScheduleSubjectEverywhere(subjectId);
              }
            }}
            onDeleteThisSlot={
              scheduleModal.mode === 'edit'
                ? () => deleteScheduleSlotOnly(scheduleModal.slotId)
                : undefined
            }
            onDeleteWholeSubject={
              scheduleModal.mode === 'edit'
                ? () => {
                  const sl = scheduleSlots.find((s) => s.id === scheduleModal.slotId);
                  const sub = sl && scheduleSubjects.find((s) => s.id === sl.subjectId);
                  if (sub && window.confirm(`¿Quitar "${sub.name}" de todos los días del horario?`)) {
                    deleteScheduleSubjectEverywhere(sub.id);
                  }
                }
                : undefined
            }
          />
        </div>
      )}

      <BottomNav currentView={view} setView={setView} />
    </div>
  );
}
