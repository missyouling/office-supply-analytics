-- Insert sample purchase orders with real items
INSERT INTO purchases(id,order_no,purchase_date,total_amount,status,notes)VALUES
(1,'PO-20260701-001','2026-07-01',500.00,'completed','月度办公物资采购'),
(2,'PO-20260715-001','2026-07-15',350.00,'completed','劳保用品补货'),
(3,'PO-20260801-001','2026-08-01',620.00,'completed','月初采购'),
(4,'PO-20260815-001','2026-08-15',280.00,'completed','耗材紧急补货');

INSERT INTO purchase_items(purchase_id,supply_id,quantity,unit_price,subtotal)VALUES
(1,402,10,22.50,225.00),(1,403,100,1.50,150.00),(1,409,20,6.50,130.00),
(2,404,5,35.00,175.00),(2,405,50,3.50,175.00),
(3,402,15,22.50,337.50),(3,403,80,1.50,120.00),(3,408,2,89.00,178.00),
(4,408,1,89.00,89.00),(4,407,10,12.00,120.00),(4,409,10,6.50,65.00);
