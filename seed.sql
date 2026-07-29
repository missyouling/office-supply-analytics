-- 示例数据
INSERT OR IGNORE INTO supplies (id, name, spec, unit, reference_price, safety_stock, category_id, status) VALUES
(1, 'A4打印纸', '70g 500张/包', '包', 22.50, 10, 1, 'active'),
(2, '中性笔', '0.5mm 黑色', '支', 1.50, 100, 1, 'active'),
(3, '安全帽', 'ABS标准型', '个', 35.00, 5, 2, 'active'),
(4, '棉纱手套', '均码', '双', 3.50, 50, 2, 'active'),
(5, '洗洁精', '500ml', '瓶', 8.90, 10, 3, 'active'),
(6, '垃圾袋', '45×50cm 100只', '卷', 12.00, 20, 3, 'active'),
(7, '碳粉盒', 'HP 388A', '盒', 89.00, 3, 4, 'active'),
(8, '文件夹', 'A4双夹', '个', 6.50, 20, 1, 'active');

INSERT OR IGNORE INTO purchases (id, order_no, purchase_date, total_amount, status) VALUES
(1, 'PO-20260705-0001', '2026-07-05', 158.00, 'confirmed');
INSERT OR IGNORE INTO purchases (id, order_no, purchase_date, total_amount, status) VALUES
(2, 'PO-20260715-0002', '2026-07-15', 67.00, 'confirmed');

INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(1, 1, 2, 22.50, 45.00);
INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(1, 2, 20, 1.50, 30.00);
INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(1, 4, 10, 3.50, 35.00);
INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(1, 7, 1, 89.00, 89.00);
INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(2, 5, 3, 8.90, 26.70);
INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(2, 6, 2, 12.00, 24.00);
INSERT OR IGNORE INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES
(2, 8, 5, 6.50, 32.50);
