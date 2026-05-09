-- Cloudflare D1 Schema for Task Manager (With Multi-user and profiles)

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- ID del usuario autenticado
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  category TEXT,
  ticket_number TEXT,
  date TEXT,
  time TEXT,
  subtasks TEXT, -- JSON string
  dependencies TEXT DEFAULT '[]', -- JSON string de ids de tareas requeridas
  hide_in_kanban_done INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  title TEXT,
  text TEXT,
  x REAL,
  y REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_profile ON tasks(user_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_profile ON notes(user_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_events_user_profile ON events(user_id, profile_id);

CREATE TABLE IF NOT EXISTS schedule_subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  valid_from TEXT,
  valid_to TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_subjects_user_profile ON schedule_subjects(user_id, profile_id);

CREATE TABLE IF NOT EXISTS schedule_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES schedule_subjects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_user_profile ON schedule_slots(user_id, profile_id);
