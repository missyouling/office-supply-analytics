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
  const r = await db.prepare('UPDATE categories SET name=?, sort_order=?, updated_at=datetime(\'now\',\' +8 hours\') WHERE id=?').bind(name, sort_order || 0, id).run();
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
  // 默认供应商排最前
  return (await db.prepare('SELECT * FROM suppliers ORDER BY is_default DESC, id DESC').all()).results;
}
export async function getSupplier(db, id) {
  return await db.prepare('SELECT * FROM suppliers WHERE id=?').bind(id).first();
}
export async function createSupplier(db, { name, contact, phone, bank_name, bank_account, is_default, remark }) {
  const r = await db.prepare('INSERT INTO suppliers (name, contact, phone, bank_name, bank_account, is_default, remark) VALUES (?,?,?,?,?,?,?)')
    .bind(name, contact||'', phone||'', bank_name||'', bank_account||'', is_default ? 1 : 0, remark||'').run();
  // 若设为默认，清除其他供应商的默认标记
  if (is_default) await db.prepare('UPDATE suppliers SET is_default=0 WHERE id!=?').bind(r.meta.last_row_id).run();
  return { id: r.meta.last_row_id };
}
export async function updateSupplier(db, id, { name, contact, phone, bank_name, bank_account, is_default, remark }) {
  const r = await db.prepare('UPDATE suppliers SET name=?, contact=?, phone=?, bank_name=?, bank_account=?, is_default=?, remark=?, updated_at=datetime(\'now\',\' +8 hours\') WHERE id=?')
    .bind(name, contact||'', phone||'', bank_name||'', bank_account||'', is_default ? 1 : 0, remark||'', id).run();
  // 若设为默认，清除其他供应商的默认标记
  if (is_default) await db.prepare('UPDATE suppliers SET is_default=0 WHERE id!=?').bind(id).run();
  return r.meta.changes > 0;
}
export async function deleteSupplier(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM supplies WHERE supplier_id=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该供应商被 ${used.c} 个用品引用，无法删除` };
  await db.prepare('DELETE FROM suppliers WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 请款单 ------
export async function listPaymentRequests(db, { page = 1, limit = 20, keyword, status, date_from, date_to } = {}) {
  const where = []; const params = [];
  if (keyword) { where.push('(request_no LIKE ? OR content LIKE ? OR payee LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (status) { where.push('status=?'); params.push(status); }
  if (date_from) { where.push('request_date>=?'); params.push(date_from); }
  if (date_to) { where.push('request_date<=?'); params.push(date_to); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM payment_requests ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`SELECT * FROM payment_requests ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all()).results;
  return { items, total, page, limit };
}
export async function getPaymentRequest(db, id) {
  return await db.prepare('SELECT * FROM payment_requests WHERE id=?').bind(id).first();
}
function generateRequestNo() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PR-${dateStr}-${rand}`;
}
export async function createPaymentRequest(db, data) {
  const request_no = generateRequestNo();
  // 关联采购单：保存请款单后，关联的未付款采购单变为已付款
  const purchaseIds = (data.purchase_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const r = await db.prepare(`INSERT INTO payment_requests 
    (request_no, payment_unit, department, applicant, request_date, content, payee, payee_supplier_id, bank_name, bank_account, amount, amount_cn, payment_method, remark, company_head, finance_head, dept_head, handler, status, purchase_ids) 
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(request_no, data.payment_unit||'', data.department||'', data.applicant||'', data.request_date, data.content||'', data.payee||'', data.payee_supplier_id||null, data.bank_name||'', data.bank_account||'', data.amount||0, data.amount_cn||'', data.payment_method||'转支', data.remark||'', data.company_head||'', data.finance_head||'', data.dept_head||'', data.handler||'', data.status||'draft', data.purchase_ids||'').run();
  const pid = r.meta.last_row_id;
  if (purchaseIds.length) {
    for (const pidNum of purchaseIds) {
      await db.prepare(`UPDATE purchases SET payment_status='已付款', payment_date=?, updated_at=datetime('now',' +8 hours') WHERE id=?`).bind(data.request_date, Number(pidNum)).run();
    }
  }
  return { ok: true, id: pid, request_no };
}
export async function updatePaymentRequest(db, id, data) {
  const existing = await db.prepare('SELECT * FROM payment_requests WHERE id=?').bind(id).first();
  if (!existing) return { ok: false };
  const oldIds = (existing.purchase_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const newIds = (data.purchase_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  // 移除不再关联的采购单 → 未付款
  for (const pidNum of oldIds) {
    if (!newIds.includes(pidNum)) {
      await db.prepare(`UPDATE purchases SET payment_status='未付款', payment_date='' WHERE id=?`).bind(Number(pidNum)).run();
    }
  }
  // 新关联的采购单 → 已付款
  for (const pidNum of newIds) {
    if (!oldIds.includes(pidNum)) {
      await db.prepare(`UPDATE purchases SET payment_status='已付款', payment_date=?, updated_at=datetime('now',' +8 hours') WHERE id=?`).bind(data.request_date, Number(pidNum)).run();
    }
  }
  const r = await db.prepare(`UPDATE payment_requests SET 
    payment_unit=?, department=?, applicant=?, request_date=?, content=?, payee=?, payee_supplier_id=?, bank_name=?, bank_account=?, amount=?, amount_cn=?, payment_method=?, remark=?, company_head=?, finance_head=?, dept_head=?, handler=?, status=?, purchase_ids=?, updated_at=datetime('now',' +8 hours') WHERE id=?`)
    .bind(data.payment_unit||'', data.department||'', data.applicant||'', data.request_date, data.content||'', data.payee||'', data.payee_supplier_id||null, data.bank_name||'', data.bank_account||'', data.amount||0, data.amount_cn||'', data.payment_method||'转支', data.remark||'', data.company_head||'', data.finance_head||'', data.dept_head||'', data.handler||'', data.status||'draft', data.purchase_ids||'', id).run();
  return { ok: r.meta.changes > 0 };
}
export async function deletePaymentRequest(db, id) {
  const existing = await db.prepare('SELECT * FROM payment_requests WHERE id=?').bind(id).first();
  if (existing && existing.purchase_ids) {
    const ids = existing.purchase_ids.split(',').map(s => s.trim()).filter(Boolean);
    for (const pidNum of ids) {
      await db.prepare(`UPDATE purchases SET payment_status='未付款', payment_date='' WHERE id=?`).bind(Number(pidNum)).run();
    }
  }
  await db.prepare('DELETE FROM payment_requests WHERE id=?').bind(id).run();
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
    'UPDATE supplies SET name=?,spec=?,unit=?,unit_price=?,reference_price=?,category=?,safety_stock=?,category_id=?,supplier_id=?,status=?,remark=?,updated_at=datetime(\'now\',\' +8 hours\') WHERE id=?'
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
  const rows = [['品名','规格','单位','参考单价','分类','供应商','状态','备注']];
  for (const s of data.items) {
    rows.push([s.name, s.spec||'', s.unit||'', String(s.reference_price||0), s.category_name||'', s.supplier_name||'', s.status||'', s.remark||'']);
  }
  return rows.map(r => r.join(',')).join('\n');
}

// ------ 采购单 ------
async function generateOrderNo(db, dateStr) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  // 同一天多张采购单递增序号（2位，超过99自动进位）
  const cnt = await db.prepare(`SELECT COUNT(*) as c FROM purchases WHERE order_no LIKE 'BG-${dateKey}-%'`).first();
  const seq = (cnt?.c || 0) + 1;
  return `BG-${dateKey}-${pad(seq)}`;
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
    SELECT p.*, s.name as supplier_name,
           (SELECT COUNT(*) FROM purchase_items WHERE purchase_id=p.id) as item_count,
           (SELECT GROUP_CONCAT(name, '、') FROM (SELECT DISTINCT si.name FROM purchase_items pi2 JOIN supplies si ON pi2.supply_id=si.id WHERE pi2.purchase_id=p.id)) as item_names
    FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ${w} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()).results;
  // 汇总金额
  const sumRow = await db.prepare(`SELECT COALESCE(SUM(total_amount),0) as total_sum FROM purchases p ${w}`).bind(...params).first();
  // 全部数据的日期范围（不受分页影响）：最早起始日期 / 最晚结束日期（purchase_date 可能是 "A" 或 "A~B"）
  const dateRow = await db.prepare(`
    SELECT MIN(substr(purchase_date, 1, 10)) as min_date,
           MAX(CASE WHEN instr(purchase_date, '~') > 0 THEN substr(purchase_date, instr(purchase_date, '~') + 1) ELSE purchase_date END) as max_date
    FROM purchases`).first();
  return { items, total, page, limit, total_sum: Math.round((sumRow?.total_sum || 0) * 100) / 100, min_date: dateRow?.min_date || '', max_date: dateRow?.max_date || '' };
}
export async function getPurchaseDetail(db, id) {
  const p = await db.prepare('SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE p.id=?').bind(id).first();
  if (!p) return null;
  const items = (await db.prepare(`
    SELECT pi.*, s.name as supply_name, s.spec as supply_spec, s.unit, s.reference_price
    FROM purchase_items pi JOIN supplies s ON pi.supply_id=s.id WHERE pi.purchase_id=? ORDER BY pi.id
  `).bind(id).all()).results;
  return { ...p, items };
}
export async function createPurchase(db, { purchase_date, items, status='confirmed', remark='', supplier_id=null }) {
  const order_no = await generateOrderNo(db, purchase_date);
  let total = 0;
  for (const i of items) { total += (i.unit_price || 0) * (i.quantity || 0); }
  total = Math.round(total * 100) / 100;
  const supplier = supplier_id ? await db.prepare('SELECT name FROM suppliers WHERE id=?').bind(supplier_id).first() : null;
  const supplier_name = supplier?.name || '';
  const pr = await db.prepare('INSERT INTO purchases (order_no, purchase_date, total_amount, status, remark, supplier_id, supplier_name, payment_status, payment_date) VALUES (?,?,?,?,?,?,?,?,?)').bind(order_no, purchase_date, total, status, remark, supplier_id, supplier_name, '未付款', '').run();
  const pid = pr.meta.last_row_id;
  const stmt = db.prepare('INSERT INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal, date) VALUES (?,?,?,?,?,?)');
  for (const i of items) {
    const sub = Math.round((i.unit_price||0) * (i.quantity||0) * 100) / 100;
    await stmt.bind(pid, i.supply_id, i.quantity, i.unit_price, sub, i.date || purchase_date).run();
  }
  return { id: pid, order_no };
}
export async function updatePurchase(db, id, { purchase_date, items, status, remark, supplier_id, payment_status, payment_date }) {
  const existing = await db.prepare('SELECT * FROM purchases WHERE id=?').bind(id).first();
  if (!existing) return null;
  let total = 0;
  for (const i of items) { total += (i.unit_price||0) * (i.quantity||0); }
  total = Math.round(total * 100) / 100;
  const supplier = supplier_id ? await db.prepare('SELECT name FROM suppliers WHERE id=?').bind(supplier_id).first() : null;
  const supplier_name = supplier?.name || '';
  const newPaymentStatus = payment_status !== undefined ? payment_status : (existing.payment_status || '未付款');
  const newPaymentDate = payment_date !== undefined ? payment_date : (existing.payment_date || '');
  await db.prepare('UPDATE purchases SET purchase_date=?, total_amount=?, status=?, remark=?, supplier_id=?, supplier_name=?, payment_status=?, payment_date=?, updated_at=datetime(\'now\',\' +8 hours\') WHERE id=?').bind(purchase_date||existing.purchase_date, total, status||existing.status, remark||existing.remark, supplier_id, supplier_name, newPaymentStatus, newPaymentDate, id).run();
  await db.prepare('DELETE FROM purchase_items WHERE purchase_id=?').bind(id).run();
  const stmt = db.prepare('INSERT INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal, date) VALUES (?,?,?,?,?,?)');
  for (const i of items) {
    const sub = Math.round((i.unit_price||0) * (i.quantity||0) * 100) / 100;
    await stmt.bind(id, i.supply_id, i.quantity, i.unit_price, sub, i.date || purchase_date || existing.purchase_date).run();
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
export async function listUnpaidPurchases(db) {
  return (await db.prepare(`SELECT p.id, p.order_no, p.purchase_date, p.total_amount, s.name as supplier_name
    FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id
    WHERE p.payment_status != '已付款' OR p.payment_status IS NULL
    ORDER BY p.created_at DESC`).all()).results;
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

// ------ 系统重置 ------
export async function resetSystem(db, options = {}) {
  const { categories = true, suppliers = true, supplies = true, purchases = true, payment_requests = true } = options;
  if (payment_requests) {
    await db.prepare('DELETE FROM payment_requests').run();
  }
  if (purchases) {
    await db.prepare('DELETE FROM purchase_items').run();
    await db.prepare('DELETE FROM purchases').run();
  }
  if (supplies) {
    await db.prepare('DELETE FROM supplies').run();
  }
  if (suppliers) {
    await db.prepare('DELETE FROM suppliers').run();
  }
  if (categories) {
    await db.prepare('DELETE FROM categories').run();
  }
  return { ok: true };
}

// ------ 备份/恢复 ------
export async function listBackups(db) {
  return (await db.prepare('SELECT * FROM backup_logs ORDER BY id DESC').all()).results;
}
export async function createBackup(db, { description = '' }) {
  const categories = await db.prepare('SELECT * FROM categories').all();
  const suppliers = await db.prepare('SELECT * FROM suppliers').all();
  const supplies = await db.prepare('SELECT * FROM supplies').all();
  const purchases = await db.prepare('SELECT * FROM purchases').all();
  const purchaseItems = await db.prepare('SELECT * FROM purchase_items').all();
  const paymentRequests = await db.prepare('SELECT * FROM payment_requests').all();
  
  const backupData = {
    categories: categories.results,
    suppliers: suppliers.results,
    supplies: supplies.results,
    purchases: purchases.results,
    purchase_items: purchaseItems.results,
    payment_requests: paymentRequests.results,
    exported_at: new Date().toISOString(),
  };
  
  const dataStr = JSON.stringify(backupData);
  const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fileSize = new TextEncoder().encode(dataStr).length;
  
  await db.prepare('INSERT INTO backup_logs (filename, description, file_size, data) VALUES (?,?,?,?)')
    .bind(filename, description, fileSize, dataStr).run();
  return { ok: true, filename };
}
export async function restoreBackup(db, backupId) {
  const backup = await db.prepare('SELECT data FROM backup_logs WHERE id=?').bind(backupId).first();
  if (!backup) return { ok: false, error: '备份不存在' };
  
  const data = JSON.parse(backup.data);
  
  await db.prepare('DELETE FROM purchase_items').run();
  await db.prepare('DELETE FROM purchases').run();
  await db.prepare('DELETE FROM supplies').run();
  await db.prepare('DELETE FROM suppliers').run();
  await db.prepare('DELETE FROM categories').run();
  await db.prepare('DELETE FROM payment_requests').run();
  
  if (data.categories?.length) {
    const stmt = db.prepare('INSERT INTO categories (id, name, sort_order, created_at, updated_at) VALUES (?,?,?,?,?)');
    for (const c of data.categories) {
      await stmt.bind(c.id, c.name, c.sort_order || 0, c.created_at, c.updated_at).run();
    }
  }
  if (data.suppliers?.length) {
    const stmt = db.prepare('INSERT INTO suppliers (id, name, contact, phone, bank_name, bank_account, remark, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const s of data.suppliers) {
      await stmt.bind(s.id, s.name, s.contact || '', s.phone || '', s.bank_name || '', s.bank_account || '', s.remark || '', s.created_at, s.updated_at).run();
    }
  }
  if (data.supplies?.length) {
    const stmt = db.prepare('INSERT INTO supplies (id, name, spec, unit, unit_price, reference_price, category, safety_stock, category_id, supplier_id, status, remark, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const s of data.supplies) {
      await stmt.bind(s.id, s.name, s.spec || '', s.unit || '个', s.unit_price || 0, s.reference_price || 0, s.category || '', s.safety_stock || 0, s.category_id, s.supplier_id, s.status || 'active', s.remark || '', s.created_at, s.updated_at).run();
    }
  }
  if (data.purchases?.length) {
    const stmt = db.prepare('INSERT INTO purchases (id, order_no, purchase_date, total_amount, status, remark, supplier_id, supplier_name, payment_status, payment_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const p of data.purchases) {
      await stmt.bind(p.id, p.order_no, p.purchase_date, p.total_amount, p.status, p.remark || '', p.supplier_id, p.supplier_name || '', p.payment_status || '未付款', p.payment_date || '', p.created_at, p.updated_at).run();
    }
  }
  if (data.purchase_items?.length) {
    const stmt = db.prepare('INSERT INTO purchase_items (id, purchase_id, supply_id, quantity, unit_price, subtotal, date) VALUES (?,?,?,?,?,?,?)');
    for (const pi of data.purchase_items) {
      await stmt.bind(pi.id, pi.purchase_id, pi.supply_id, pi.quantity, pi.unit_price, pi.subtotal, pi.date).run();
    }
  }
  if (data.payment_requests?.length) {
    const stmt = db.prepare('INSERT INTO payment_requests (id, request_no, payment_unit, department, applicant, request_date, content, payee, payee_supplier_id, bank_name, bank_account, amount, amount_cn, payment_method, remark, company_head, finance_head, dept_head, handler, status, purchase_ids, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const pr of data.payment_requests) {
      await stmt.bind(pr.id, pr.request_no, pr.payment_unit || '', pr.department || '', pr.applicant || '', pr.request_date, pr.content || '', pr.payee || '', pr.payee_supplier_id, pr.bank_name || '', pr.bank_account || '', pr.amount || 0, pr.amount_cn || '', pr.payment_method || '转支', pr.remark || '', pr.company_head || '', pr.finance_head || '', pr.dept_head || '', pr.handler || '', pr.status || 'draft', pr.purchase_ids || '', pr.created_at, pr.updated_at).run();
    }
  }
  
  return { ok: true };
}
export async function deleteBackup(db, backupId) {
  await db.prepare('DELETE FROM backup_logs WHERE id=?').bind(backupId).run();
  return { ok: true };
}