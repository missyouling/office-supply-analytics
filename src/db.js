// =============================================
// 数据库操作 — 完整 CRUD v2.0
// =============================================

// ------ 分类 ------
export async function listCategories(db) {
  return (await db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all()).results;
}
export async function getCategory(db, id) {
  return await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
}
export async function createCategory(db, { name, sort_order }) {
  const r = await db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').bind(name, sort_order || 0).run();
  return { id: r.meta.last_row_id };
}
export async function updateCategory(db, id, { name, sort_order }) {
  const r = await db.prepare('UPDATE categories SET name=?, sort_order=?, updated_at=datetime(\'now\',\'+8 hours\') WHERE id=?').bind(name, sort_order || 0, id).run();
  return r.meta.changes > 0;
}
export async function deleteCategory(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM supplies WHERE category_id=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该分类被 ${used.c} 个用品引用，无法删除` };
  await db.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 供应商 ------
export async function listSuppliers(db) {
  return (await db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all()).results;
}
export async function getSupplier(db, id) {
  return await db.prepare('SELECT * FROM suppliers WHERE id=?').bind(id).first();
}
export async function createSupplier(db, { name, contact, phone, remark }) {
  const r = await db.prepare('INSERT INTO suppliers (name, contact, phone, remark) VALUES (?,?,?,?)').bind(name, contact||'', phone||'', remark||'').run();
  return { id: r.meta.last_row_id };
}
export async function updateSupplier(db, id, { name, contact, phone, remark }) {
  const r = await db.prepare('UPDATE suppliers SET name=?, contact=?, phone=?, remark=?, updated_at=datetime(\'now\',\'+8 hours\') WHERE id=?').bind(name, contact||'', phone||'', remark||'', id).run();
  return r.meta.changes > 0;
}
export async function deleteSupplier(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM supplies WHERE supplier_id=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该供应商被 ${used.c} 个用品引用，无法删除` };
  await db.prepare('DELETE FROM suppliers WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 用品 ------
export async function listSupplies(db, { keyword, category_id, status, page=1, limit=20 }) {
  const where = []; const params = [];
  if (keyword) { where.push('(s.name LIKE ? OR s.spec LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (category_id && category_id !== 'all' && category_id !== '0') { where.push('s.category_id=?'); params.push(Number(category_id)); }
  if (status && status !== 'all') { where.push('s.status=?'); params.push(status); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM supplies s ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`
    SELECT s.*, c.name as category_name, sp.name as supplier_name
    FROM supplies s LEFT JOIN categories c ON s.category_id=c.id LEFT JOIN suppliers sp ON s.supplier_id=sp.id
    ${w} ORDER BY s.created_at DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()).results;
  return { items, total, page, limit };
}
export async function getSupply(db, id) {
  return await db.prepare(`
    SELECT s.*, c.name as category_name, sp.name as supplier_name
    FROM supplies s LEFT JOIN categories c ON s.category_id=c.id LEFT JOIN suppliers sp ON s.supplier_id=sp.id WHERE s.id=?
  `).bind(id).first();
}
export async function createSupply(db, data) {
  // 获取分类名称（兼容旧 category 列 NOT NULL）
  const cat = data.category_id ? await db.prepare('SELECT name FROM categories WHERE id=?').bind(data.category_id).first() : null;
  const catName = cat?.name || '';
  const r = await db.prepare(
    'INSERT INTO supplies (name,spec,unit,unit_price,reference_price,category,safety_stock,category_id,supplier_id,status,remark) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(data.name, data.spec||'', data.unit||'个', data.reference_price||0, data.reference_price||0, catName, data.safety_stock||0, data.category_id||null, data.supplier_id||null, data.status||'active', data.remark||'').run();
  return { id: r.meta.last_row_id };
}
export async function updateSupply(db, id, data) {
  const cat = data.category_id ? await db.prepare('SELECT name FROM categories WHERE id=?').bind(data.category_id).first() : null;
  const catName = cat?.name || '';
  const r = await db.prepare(
    'UPDATE supplies SET name=?,spec=?,unit=?,unit_price=?,reference_price=?,category=?,safety_stock=?,category_id=?,supplier_id=?,status=?,remark=?,updated_at=datetime(\'now\',\'+8 hours\') WHERE id=?'
  ).bind(data.name, data.spec||'', data.unit||'个', data.reference_price||0, data.reference_price||0, catName, data.safety_stock||0, data.category_id||null, data.supplier_id||null, data.status||'active', data.remark||'', id).run();
  return r.meta.changes > 0;
}
export async function deleteSupply(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM purchase_items WHERE supply_id=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该用品已被 ${used.c} 条采购记录引用，请先停用` };
  await db.prepare('DELETE FROM supplies WHERE id=?').bind(id).run();
  return { ok: true };
}
export async function batchCreateSupplies(db, items) {
  let ok = 0, err = 0;
  const stmt = db.prepare('INSERT INTO supplies (name,spec,unit,unit_price,reference_price,category,safety_stock,category_id,remark) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const item of items) {
    try {
      if (!item.name) { err++; continue; }
      const cat = item.category_id ? await db.prepare('SELECT name FROM categories WHERE id=?').bind(item.category_id).first() : null;
      const catName = cat?.name || item.category_name || '';
      await stmt.bind(item.name, item.spec||'', item.unit||'个', item.reference_price||0, item.reference_price||0, catName, item.safety_stock||0, item.category_id||null, item.remark||'').run();
      ok++;
    } catch { err++; }
  }
  return { ok, err };
}
export async function exportSuppliesCsv(db, { keyword, category_id, status }) {
  const data = await listSupplies(db, { keyword, category_id, status, page: 1, limit: 99999 });
  const rows = [['品名','规格','单位','参考单价','安全库存','分类','供应商','状态']];
  for (const s of data.items) {
    rows.push([s.name, s.spec||'', s.unit||'', String(s.reference_price||0), String(s.safety_stock||0), s.category_name||'', s.supplier_name||'', s.status||'']);
  }
  return rows.map(r => r.join(',')).join('\n');
}

// ------ 采购单 ------
function generateOrderNo(date) {
  const d = date.replace(/-/g, '');
  return `PO-${d}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
export async function listPurchases(db, { page=1, limit=20, date_from, date_to, keyword }) {
  const where = []; const params = [];
  if (date_from) { where.push('p.purchase_date >= ?'); params.push(date_from); }
  if (date_to) { where.push('p.purchase_date <= ?'); params.push(date_to); }
  if (keyword) { where.push('p.order_no LIKE ?'); params.push(`%${keyword}%`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM purchases p ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM purchase_items WHERE purchase_id=p.id) as item_count
    FROM purchases p ${w} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()).results;
  return { items, total, page, limit };
}
export async function getPurchaseDetail(db, id) {
  const p = await db.prepare('SELECT * FROM purchases WHERE id=?').bind(id).first();
  if (!p) return null;
  const items = (await db.prepare(`
    SELECT pi.*, s.name as supply_name, s.spec as supply_spec, s.unit
    FROM purchase_items pi JOIN supplies s ON pi.supply_id=s.id WHERE pi.purchase_id=? ORDER BY pi.id
  `).bind(id).all()).results;
  return { ...p, items };
}
export async function createPurchase(db, { purchase_date, items, status='confirmed', remark='' }) {
  const order_no = generateOrderNo(purchase_date);
  let total = 0;
  for (const i of items) { total += (i.unit_price || 0) * (i.quantity || 0); }
  total = Math.round(total * 100) / 100;
  const pr = await db.prepare('INSERT INTO purchases (order_no, purchase_date, total_amount, status, remark) VALUES (?,?,?,?,?)').bind(order_no, purchase_date, total, status, remark).run();
  const pid = pr.meta.last_row_id;
  const stmt = db.prepare('INSERT INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?)');
  for (const i of items) {
    const sub = Math.round((i.unit_price||0) * (i.quantity||0) * 100) / 100;
    await stmt.bind(pid, i.supply_id, i.quantity, i.unit_price, sub).run();
  }
  return { id: pid, order_no };
}
export async function updatePurchase(db, id, { purchase_date, items, status, remark }) {
  const existing = await db.prepare('SELECT * FROM purchases WHERE id=?').bind(id).first();
  if (!existing) return null;
  let total = 0;
  for (const i of items) { total += (i.unit_price||0) * (i.quantity||0); }
  total = Math.round(total * 100) / 100;
  await db.prepare('UPDATE purchases SET purchase_date=?, total_amount=?, status=?, remark=?, updated_at=datetime(\'now\',\'+8 hours\') WHERE id=?').bind(purchase_date||existing.purchase_date, total, status||existing.status, remark||existing.remark, id).run();
  // 重建明细：先删后插
  await db.prepare('DELETE FROM purchase_items WHERE purchase_id=?').bind(id).run();
  const stmt = db.prepare('INSERT INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?)');
  for (const i of items) {
    const sub = Math.round((i.unit_price||0) * (i.quantity||0) * 100) / 100;
    await stmt.bind(id, i.supply_id, i.quantity, i.unit_price, sub).run();
  }
  return { id, order_no: existing.order_no };
}
export async function deletePurchase(db, id) {
  await db.prepare('DELETE FROM purchase_items WHERE purchase_id=?').bind(id).run();
  await db.prepare('DELETE FROM purchases WHERE id=?').bind(id).run();
  return { ok: true };
}
export async function copyPurchase(db, id) {
  const orig = await getPurchaseDetail(db, id);
  if (!orig) return null;
  const today = new Date().toISOString().substring(0, 10);
  return await createPurchase(db, { purchase_date: today, items: orig.items.map(i => ({ supply_id: i.supply_id, quantity: i.quantity, unit_price: i.unit_price })), status: 'draft' });
}
export async function exportsPurchasesCsv(db, { date_from, date_to, keyword }) {
  const data = await listPurchases(db, { date_from, date_to, keyword, page: 1, limit: 99999 });
  const rows = [['单号','日期','品项数','总金额','状态','备注','创建时间']];
  for (const p of data.items) {
    rows.push([p.order_no, p.purchase_date, String(p.item_count||0), String(p.total_amount), p.status, p.remark||'', p.created_at||'']);
  }
  return rows.map(r => r.join(',')).join('\n');
}
export async function exportPurchaseCsv(db, purchaseId) {
  const p = await getPurchaseDetail(db, purchaseId);
  if (!p) return null;
  const rows = [['单号','日期','总金额'], [p.order_no, p.purchase_date, p.total_amount], [], ['品名','规格','单位','数量','单价','小计']];
  for (const i of p.items) {
    rows.push([i.supply_name, i.supply_spec||'', i.unit||'', String(i.quantity), String(i.unit_price), String(i.subtotal)]);
  }
  return rows.map(r => r.join(',')).join('\n');
}
