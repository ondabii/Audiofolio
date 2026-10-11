CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_protected INTEGER DEFAULT 0,
  pin_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_normalized INTEGER DEFAULT 0,
  is_downloadable INTEGER DEFAULT 0,
  playback_mode TEXT DEFAULT 'ab_test',
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS track_versions (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  is_representative INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  duration_ms INTEGER,
  file_format TEXT,
  bitrate INTEGER,
  file_size_bytes INTEGER,
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
