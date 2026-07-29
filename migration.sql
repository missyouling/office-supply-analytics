-- =============================================
-- D1 数据库迁移 v1→v2
-- 添加新表、新字段，迁移已有数据
-- =============================================

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

-- 2. 从旧数据迁移分类
INSERT OR IGNORE INTO categories (name, sort_order)
  SELECT DISTINCT category, 0 FROM supplies WHERE category IS NOT NULL AND category != ''
  UNION SELECT '办公文具', 1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='办公文具')
  UNION SELECT '劳保用品', 2 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='劳保用品')
  UNION SELECT '清洁用品', 3 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='清洁用品')
  UNION SELECT '耗材', 4 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='耗材')
  UNION SELECT '其他', 5 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='其他');

-- 3. 给 supplies 表添加新列
ALTER TABLE supplies ADD COLUMN unit TEXT DEFAULT '个';
ALTER TABLE supplies ADD COLUMN reference_price REAL DEFAULT 0;
ALTER TABLE supplies ADD COLUMN safety_stock INTEGER DEFAULT 0;
ALTER TABLE supplies ADD COLUMN category_id INTEGER;
ALTER TABLE supplies ADD COLUMN supplier_id INTEGER;
ALTER TABLE supplies ADD COLUMN status TEXT DEFAULT 'active';

-- 4. 迁移数据：将旧 category 名称映射到 category_id
UPDATE supplies SET category_id = (SELECT id FROM categories WHERE name = supplies.category);
UPDATE supplies SET reference_price = unit_price WHERE reference_price = 0;
UPDATE supplies SET unit = COALESCE(NULLIF(unit, ''), '个');
UPDATE supplies SET status = 'active' WHERE status IS NULL;

-- 5. 给 purchases 表添加新列
ALTER TABLE purchases ADD COLUMN order_no TEXT;
ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'confirmed';
ALTER TABLE purchases ADD COLUMN remark TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN created_by TEXT DEFAULT '';

-- 6. 生成 order_no
UPDATE purchases SET order_no = 'PO-' || 
  substr(purchase_date, 1, 4) || substr(purchase_date, 6, 2) || substr(purchase_date, 9, 2) || '-' ||
  substr('0000' || id, -4) WHERE order_no IS NULL;

-- 7. 设置默认状态
UPDATE purchases SET status = 'confirmed' WHERE status IS NULL;

-- 8. 新索引
CREATE INDEX IF NOT EXISTS idx_supplies_category ON supplies(category_id);
CREATE INDEX IF NOT EXISTS idx_supplies_status ON supplies(status);
CREATE INDEX IF NOT EXISTS idx_purchases_order_no ON purchases(order_no);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
