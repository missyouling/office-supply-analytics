-- 其他费用：新增 实际金额(actual_amount) 与 参数(params) 列
ALTER TABLE canteen_other_expenses ADD COLUMN actual_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE canteen_other_expenses ADD COLUMN params TEXT DEFAULT '';

-- 费用科目字典：人工费 → 工资
UPDATE canteen_expense_categories SET name = '工资' WHERE name = '人工费';
-- 其他费用历史记录：人工费 → 工资
UPDATE canteen_other_expenses SET category = '工资' WHERE category = '人工费';