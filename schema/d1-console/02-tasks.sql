CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
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
  subtasks TEXT,
  dependencies TEXT DEFAULT '[]',
  hide_in_kanban_done INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
