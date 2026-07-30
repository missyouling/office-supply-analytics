-- =============================================
-- 办公劳保用品采购与用量分析 - D1 数据库
-- 企业级完整 Schema v2.0
-- =============================================

-- 用品分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 供应商表
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 用品字典表
CREATE TABLE IF NOT EXISTS supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT DEFAULT '',
  unit TEXT DEFAULT '个',
  reference_price REAL DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  category_id INTEGER,
  supplier_id INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- 采购单主表
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  purchase_date TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'confirmed' CHECK(status IN ('draft','confirmed')),
  remark TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 采购明细表
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  supply_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  date TEXT,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE RESTRICT
);

-- ============ 索引 ============
CREATE INDEX IF NOT EXISTS idx_supplies_name ON supplies(name);
CREATE INDEX IF NOT EXISTS idx_supplies_category ON supplies(category_id);
CREATE INDEX IF NOT EXISTS idx_supplies_status ON supplies(status);
CREATE INDEX IF NOT EXISTS idx_purchases_order_no ON purchases(order_no);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_supply ON purchase_items(supply_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- ============ 默认数据 ============
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  (1, '办公文具', 1),
  (2, '劳保用品', 2),
  (3, '清洁用品', 3),
  (4, '耗材', 4),
  (5, '其他', 5);
