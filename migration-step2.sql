-- 迁移步骤2：添加新列 + 数据迁移 + 索引

-- supplies 表添加新列
ALTER TABLE supplies ADD COLUMN unit TEXT DEFAULT '个';
ALTER TABLE supplies ADD COLUMN reference_price REAL DEFAULT 0;
ALTER TABLE supplies ADD COLUMN safety_stock INTEGER DEFAULT 0;
ALTER TABLE supplies ADD COLUMN category_id INTEGER;
ALTER TABLE supplies ADD COLUMN supplier_id INTEGER;
ALTER TABLE supplies ADD COLUMN status TEXT DEFAULT 'active';

-- 迁移数据
UPDATE supplies SET category_id = (SELECT id FROM categories WHERE name = supplies.category);
UPDATE supplies SET reference_price = unit_price WHERE reference_price = 0;
UPDATE supplies SET unit = '个' WHERE unit IS NULL OR unit = '';
UPDATE supplies SET status = 'active' WHERE status IS NULL;

-- purchases 表添加新列
ALTER TABLE purchases ADD COLUMN order_no TEXT;
ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'confirmed';
ALTER TABLE purchases ADD COLUMN remark TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN created_by TEXT DEFAULT '';

-- 生成 order_no
UPDATE purchases SET order_no = 'PO-' || substr(purchase_date, 1, 4) || substr(purchase_date, 6, 2) || substr(purchase_date, 9, 2) || '-' || substr('0000' || id, -4) WHERE order_no IS NULL;

-- 设置默认状态
UPDATE purchases SET status = 'confirmed' WHERE status IS NULL;

-- 新索引
CREATE INDEX IF NOT EXISTS idx_supplies_category ON supplies(category_id);
CREATE INDEX IF NOT EXISTS idx_supplies_status ON supplies(status);
CREATE INDEX IF NOT EXISTS idx_purchases_order_no ON purchases(order_no);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
