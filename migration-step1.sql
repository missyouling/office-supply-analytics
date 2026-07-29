-- D1 数据库迁移 v1→v2
-- 分步执行，避免复合 SELECT 限制

-- 1. 创建新表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 2. 初始化默认分类
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (1, '办公文具', 1);
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (2, '劳保用品', 2);
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (3, '清洁用品', 3);
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (4, '耗材', 4);
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (5, '其他', 5);

-- 3. 从旧数据迁移已有分类
INSERT OR IGNORE INTO categories (name) SELECT DISTINCT category FROM supplies WHERE category IS NOT NULL AND category != '' AND category NOT IN ('办公文具','劳保用品','清洁用品','耗材','其他');
