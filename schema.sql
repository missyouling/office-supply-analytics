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
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  is_default INTEGER DEFAULT 0,
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
  total_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  remark TEXT DEFAULT '',
  supplier_id INTEGER,
  supplier_name TEXT DEFAULT '',
  payment_status TEXT DEFAULT '未付款',
  payment_date TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','+8 hours')),
  updated_at TEXT DEFAULT (datetime('now','+8 hours')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
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

-- 备份记录表
CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','+8 hours'))
);

-- 请款单表
CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_no TEXT NOT NULL UNIQUE,
  payment_unit TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  applicant TEXT DEFAULT '',
  request_date TEXT NOT NULL,
  content TEXT DEFAULT '',
  payee TEXT DEFAULT '',
  payee_supplier_id INTEGER,
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  amount_cn TEXT DEFAULT '',
  payment_method TEXT DEFAULT '转支',
  remark TEXT DEFAULT '',
  company_head TEXT DEFAULT '',
  finance_head TEXT DEFAULT '',
  dept_head TEXT DEFAULT '',
  handler TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),
  purchase_ids TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','+8 hours')),
  updated_at TEXT DEFAULT (datetime('now','+8 hours'))
);

-- 供应商表迁移：添加银行字段（兼容已有库）
ALTER TABLE suppliers ADD COLUMN bank_name TEXT DEFAULT '';
ALTER TABLE suppliers ADD COLUMN bank_account TEXT DEFAULT '';
ALTER TABLE suppliers ADD COLUMN is_default INTEGER DEFAULT 0;

-- ============ 默认数据 ============
INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  (1, '办公文具', 1),
  (2, '劳保用品', 2),
  (3, '清洁用品', 3),
  (4, '耗材', 4),
  (5, '其他', 5);
