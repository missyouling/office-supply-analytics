INSERT INTO categories(id,name,sort_order)VALUES(1,'办公文具',1),(2,'劳保用品',2),(3,'清洁用品',3),(4,'耗材',4),(5,'其他',5);
INSERT INTO supplies(name,spec,unit,unit_price,reference_price,category,safety_stock,category_id,status)VALUES
('A4打印纸','70g 500张/包','包',22.50,22.50,'办公文具',10,1,'active'),
('中性笔','0.5mm 黑色','支',1.50,1.50,'办公文具',100,1,'active'),
('安全帽','ABS标准型','个',35.00,35.00,'劳保用品',5,2,'active'),
('棉纱手套','均码','双',3.50,3.50,'劳保用品',50,2,'active'),
('洗洁精','500ml','瓶',8.90,8.90,'清洁用品',10,3,'active'),
('垃圾袋','45×50cm 100只','卷',12.00,12.00,'清洁用品',20,3,'active'),
('碳粉盒','HP 388A','盒',89.00,89.00,'耗材',3,4,'active'),
('文件夹','A4双夹','个',6.50,6.50,'办公文具',20,1,'active');
