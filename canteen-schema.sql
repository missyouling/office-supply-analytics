-- =============================================
-- 食堂管理模块 v1.0 — 独立迁移脚本
-- 与办公用品表共存于同一 D1 数据库
-- 可直接在已有库上执行（全部 IF NOT EXISTS）
-- =============================================

-- 食材分类表
CREATE TABLE IF NOT EXISTS canteen_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 食材/菜品字典表
CREATE TABLE IF NOT EXISTS canteen_supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT DEFAULT '',
  unit TEXT DEFAULT '斤',
  reference_price REAL DEFAULT 0,
  category_id INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours')),
  FOREIGN KEY (category_id) REFERENCES canteen_categories(id) ON DELETE SET NULL
);

-- 费用科目字典表（水费/电费/燃气费/人工费/设备维护费/其他）
CREATE TABLE IF NOT EXISTS canteen_expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 食堂采购主表
CREATE TABLE IF NOT EXISTS canteen_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  purchase_date TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER,
  supplier_name TEXT DEFAULT '',
  channel TEXT DEFAULT '',
  actual_pay REAL DEFAULT 0,
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- 食堂采购明细表
CREATE TABLE IF NOT EXISTS canteen_purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  supply_id INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  remark TEXT DEFAULT '',
  FOREIGN KEY (purchase_id) REFERENCES canteen_purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (supply_id) REFERENCES canteen_supplies(id) ON DELETE RESTRICT
);

-- 其他费用表（水电气、人工费，按月）
CREATE TABLE IF NOT EXISTS canteen_other_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 食堂每日收入表
CREATE TABLE IF NOT EXISTS canteen_daily_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  income_date TEXT NOT NULL UNIQUE,
  breakfast_count INTEGER DEFAULT 0,
  breakfast_amount REAL DEFAULT 0,
  lunch_count INTEGER DEFAULT 0,
  lunch_amount REAL DEFAULT 0,
  dinner_count INTEGER DEFAULT 0,
  dinner_amount REAL DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0,
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 资源占用费收取表
CREATE TABLE IF NOT EXISTS canteen_resource_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_date TEXT NOT NULL,
  meal_type TEXT NOT NULL DEFAULT '午餐',
  amount REAL NOT NULL DEFAULT 0,
  payer TEXT NOT NULL DEFAULT '',
  reason TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  handler TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 每周菜单表
CREATE TABLE IF NOT EXISTS canteen_weekly_menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
  meal_type TEXT NOT NULL CHECK(meal_type IN ('早餐','午餐','晚餐')),
  dishes TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours')),
  UNIQUE(week_start_date, day_of_week, meal_type)
);

-- 菜单模板表
CREATE TABLE IF NOT EXISTS canteen_menu_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 食堂表索引
CREATE INDEX IF NOT EXISTS idx_canteen_supplies_name ON canteen_supplies(name);
CREATE INDEX IF NOT EXISTS idx_canteen_supplies_category ON canteen_supplies(category_id);
-- 食材去重唯一索引（同分类下品名唯一，供 INSERT OR IGNORE 使用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_canteen_supplies_uniq ON canteen_supplies(name, category_id);
CREATE INDEX IF NOT EXISTS idx_canteen_purchases_date ON canteen_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_canteen_purchase_items_purchase ON canteen_purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_canteen_purchase_items_supply ON canteen_purchase_items(supply_id);
CREATE INDEX IF NOT EXISTS idx_canteen_other_expenses_date ON canteen_other_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_canteen_daily_income_date ON canteen_daily_income(income_date);
CREATE INDEX IF NOT EXISTS idx_canteen_resource_fees_date ON canteen_resource_fees(fee_date);
CREATE INDEX IF NOT EXISTS idx_canteen_weekly_menu_week ON canteen_weekly_menu(week_start_date);

-- ============ 食堂默认数据 ============
INSERT OR IGNORE INTO canteen_categories (id, name, sort_order) VALUES
  (1, '肉类', 1),
  (2, '干杂', 2),
  (3, '蔬菜', 3),
  (4, '粮油', 4),
  (5, '调味品', 5),
  (6, '其他', 6);

INSERT OR IGNORE INTO canteen_expense_categories (id, name, sort_order) VALUES
  (1, '水费', 1),
  (2, '电费', 2),
  (3, '燃气费', 3),
  (4, '人工费', 4),
  (5, '设备维护费', 5),
  (6, '其他', 6);

-- 食堂常用食材默认数据见 canteen-seed.sql（INSERT OR IGNORE，依赖 name+category 唯一索引去重）
