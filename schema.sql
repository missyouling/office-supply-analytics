-- =============================================
-- 办公劳保用品采购与用量分析 - D1 数据库初始化
-- =============================================

-- 办公用品字典表
CREATE TABLE IF NOT EXISTS supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT DEFAULT '',
  unit_price REAL NOT NULL,
  category TEXT NOT NULL,
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', '+8 hours')),
  updated_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 采购记录主表
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_date TEXT NOT NULL,  -- yyyy-mm-dd
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- 采购明细表
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  supply_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE RESTRICT
);

-- 索引：加速常用查询
CREATE INDEX IF NOT EXISTS idx_supplies_name ON supplies(name);
CREATE INDEX IF NOT EXISTS idx_supplies_category ON supplies(category);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_supply ON purchase_items(supply_id);

-- =============================================
-- 示例数据（可选，取消注释以初始化示例数据）
-- =============================================
-- INSERT INTO supplies (name, spec, unit_price, category, remark) VALUES
--   ('A4 打印纸', '70g 500张/包', 22.50, '办公文具', ''),
--   ('中性笔', '0.5mm 黑色', 1.50, '办公文具', '),
--   ('安全帽', 'ABS 标准型', 35.00, '劳保用品', '),
--   ('手套', '棉纱 均码', 3.50, '劳保用品', '),
--   ('洗洁精', '500ml', 8.90, '清洁用品', '),
--   ('垃圾袋', '45×50cm 100只', 12.00, '清洁用品', ''),
--   ('碳粉盒', 'HP 388A', 89.00, '耗材', ''),
--   ('文件夹', 'A4 双夹', 6.50, '办公文具', '');
