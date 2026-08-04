// =============================================
// 食堂管理模块 — 数据库操作 v1.0
// 与办公用品 db.js 共存，表名 canteen_* 前缀隔离
// =============================================

// ------ 食材分类 ------
export async function listCanteenCategories(db) {
  return (await db.prepare('SELECT * FROM canteen_categories ORDER BY sort_order, id').all()).results;
}
export async function createCanteenCategory(db, { name, sort_order }) {
  const r = await db.prepare('INSERT INTO canteen_categories (name, sort_order) VALUES (?, ?)').bind(name, sort_order || 0).run();
  return { id: r.meta.last_row_id };
}
export async function updateCanteenCategory(db, id, { name, sort_order }) {
  const r = await db.prepare("UPDATE canteen_categories SET name=?, sort_order=?, updated_at=datetime('now','+8 hours') WHERE id=?").bind(name, sort_order || 0, id).run();
  return r.meta.changes > 0;
}
export async function deleteCanteenCategory(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM canteen_supplies WHERE category_id=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该分类被 ${used.c} 个食材引用，无法删除` };
  await db.prepare('DELETE FROM canteen_categories WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 食材/菜品字典 ------
export async function listCanteenSupplies(db, { keyword, category_id, status, page = 1, limit = 50 } = {}) {
  const where = []; const params = [];
  if (keyword) { where.push('(s.name LIKE ? OR s.spec LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (category_id) { where.push('s.category_id=?'); params.push(Number(category_id)); }
  if (status) { where.push('s.status=?'); params.push(status); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_supplies s ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`
    SELECT s.*, c.name as category_name FROM canteen_supplies s
    LEFT JOIN canteen_categories c ON s.category_id = c.id
    ${w} ORDER BY s.category_id, s.id LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}
export async function listCanteenSuppliesAll(db) {
  return (await db.prepare(`
    SELECT s.*, c.name as category_name FROM canteen_supplies s
    LEFT JOIN canteen_categories c ON s.category_id = c.id
    WHERE s.status='active' ORDER BY s.category_id, s.id`).all()).results;
}
export async function createCanteenSupply(db, { name, spec, unit, reference_price, category_id, status, remark }) {
  const r = await db.prepare('INSERT INTO canteen_supplies (name, spec, unit, reference_price, category_id, status, remark) VALUES (?,?,?,?,?,?,?)')
    .bind(name, spec || '', unit || '斤', reference_price || 0, category_id || null, status || 'active', remark || '').run();
  return { id: r.meta.last_row_id };
}
export async function updateCanteenSupply(db, id, { name, spec, unit, reference_price, category_id, status, remark }) {
  const r = await db.prepare("UPDATE canteen_supplies SET name=?, spec=?, unit=?, reference_price=?, category_id=?, status=?, remark=?, updated_at=datetime('now','+8 hours') WHERE id=?")
    .bind(name, spec || '', unit || '斤', reference_price || 0, category_id || null, status || 'active', remark || '', id).run();
  return r.meta.changes > 0;
}
export async function deleteCanteenSupply(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM canteen_purchase_items WHERE supply_id=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该食材被 ${used.c} 条采购记录引用，无法删除` };
  await db.prepare('DELETE FROM canteen_supplies WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 费用科目 ------
export async function listCanteenExpenseCategories(db) {
  return (await db.prepare('SELECT * FROM canteen_expense_categories ORDER BY sort_order, id').all()).results;
}
export async function createCanteenExpenseCategory(db, { name, sort_order }) {
  const r = await db.prepare('INSERT INTO canteen_expense_categories (name, sort_order) VALUES (?, ?)').bind(name, sort_order || 0).run();
  return { id: r.meta.last_row_id };
}
export async function updateCanteenExpenseCategory(db, id, { name, sort_order }) {
  const r = await db.prepare("UPDATE canteen_expense_categories SET name=?, sort_order=?, updated_at=datetime('now','+8 hours') WHERE id=?").bind(name, sort_order || 0, id).run();
  return r.meta.changes > 0;
}
export async function deleteCanteenExpenseCategory(db, id) {
  const used = await db.prepare('SELECT COUNT(*) as c FROM canteen_other_expenses WHERE category=?').bind(id).first();
  if (used.c > 0) return { ok: false, message: `该科目被 ${used.c} 条费用记录引用，无法删除` };
  await db.prepare('DELETE FROM canteen_expense_categories WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 采购单（主表 + 明细） ------
export async function listCanteenPurchases(db, { page = 1, limit = 20, date_from, date_to, keyword } = {}) {
  const where = []; const params = [];
  if (keyword) { where.push('(p.order_no LIKE ? OR p.supplier_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (date_from) { where.push('p.purchase_date>=?'); params.push(date_from); }
  if (date_to) { where.push('p.purchase_date<=?'); params.push(date_to); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_purchases p ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM canteen_purchase_items pi WHERE pi.purchase_id=p.id) as item_count,
           (SELECT COUNT(DISTINCT s.category_id) FROM canteen_purchase_items pi2
             LEFT JOIN canteen_supplies s ON pi2.supply_id=s.id WHERE pi2.purchase_id=p.id) as category_count
    FROM canteen_purchases p ${w} ORDER BY p.purchase_date DESC, p.id DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}
export async function getCanteenPurchaseDetail(db, id) {
  const p = await db.prepare('SELECT * FROM canteen_purchases WHERE id=?').bind(id).first();
  if (!p) return null;
  p.items = (await db.prepare(`
    SELECT pi.*, s.name as supply_name, s.spec as supply_spec, s.unit, s.reference_price, c.name as category_name
    FROM canteen_purchase_items pi
    LEFT JOIN canteen_supplies s ON pi.supply_id = s.id
    LEFT JOIN canteen_categories c ON s.category_id = c.id
    WHERE pi.purchase_id=? ORDER BY pi.id`).bind(id).all()).results;
  return p;
}
function generateCanteenOrderNo(seq) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `CT-${dateStr}-${pad((seq || 0) + 1)}`;
}
export async function createCanteenPurchase(db, data) {
  const items = data.items || [];
  if (!items.length) return { ok: false, error: '明细不能为空' };
  const cnt = await db.prepare("SELECT COUNT(*) as c FROM canteen_purchases WHERE order_no LIKE 'CT-' || strftime('%Y%m%d','now','+8 hours') || '-%'").first();
  const order_no = generateCanteenOrderNo(cnt.c);
  const total = items.reduce((s, i) => s + (Number(i.subtotal) || Number(i.quantity) * Number(i.unit_price) || 0), 0);
  const r = await db.prepare(`INSERT INTO canteen_purchases
    (order_no, purchase_date, total_amount, supplier_id, supplier_name, channel, actual_pay, remark) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(order_no, data.purchase_date, total, data.supplier_id || null, data.supplier_name || '', data.channel || '', data.actual_pay || 0, data.remark || '').run();
  const pid = r.meta.last_row_id;
  const stmt = db.prepare('INSERT INTO canteen_purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal, remark) VALUES (?,?,?,?,?,?)');
  for (const it of items) {
    const subtotal = Number(it.subtotal) || (Number(it.quantity) * Number(it.unit_price)) || 0;
    await stmt.bind(pid, it.supply_id, it.quantity || 0, it.unit_price || 0, subtotal, it.remark || '').run();
  }
  return { ok: true, id: pid, order_no, total_amount: total };
}
export async function updateCanteenPurchase(db, id, data) {
  const existing = await db.prepare('SELECT * FROM canteen_purchases WHERE id=?').bind(id).first();
  if (!existing) return null;
  const items = data.items || [];
  const total = items.reduce((s, i) => s + (Number(i.subtotal) || Number(i.quantity) * Number(i.unit_price) || 0), 0);
  await db.prepare(`UPDATE canteen_purchases SET purchase_date=?, total_amount=?, supplier_id=?, supplier_name=?, channel=?, actual_pay=?, remark=?, updated_at=datetime('now','+8 hours') WHERE id=?`)
    .bind(data.purchase_date, total, data.supplier_id || null, data.supplier_name || '', data.channel || '', data.actual_pay || 0, data.remark || '', id).run();
  if (data.items) {
    await db.prepare('DELETE FROM canteen_purchase_items WHERE purchase_id=?').bind(id).run();
    const stmt = db.prepare('INSERT INTO canteen_purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal, remark) VALUES (?,?,?,?,?,?)');
    for (const it of items) {
      const subtotal = Number(it.subtotal) || (Number(it.quantity) * Number(it.unit_price)) || 0;
      await stmt.bind(id, it.supply_id, it.quantity || 0, it.unit_price || 0, subtotal, it.remark || '').run();
    }
  }
  return { ok: true, total_amount: total };
}
export async function deleteCanteenPurchase(db, id) {
  await db.prepare('DELETE FROM canteen_purchase_items WHERE purchase_id=?').bind(id).run();
  await db.prepare('DELETE FROM canteen_purchases WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 其他费用 ------
export async function listCanteenOtherExpenses(db, { month, year, category, page = 1, limit = 100 } = {}) {
  const where = []; const params = [];
  if (month) { where.push("substr(expense_date,1,7)=?"); params.push(month); }
  if (year) { where.push("substr(expense_date,1,4)=?"); params.push(String(year)); }
  if (category) { where.push('category=?'); params.push(category); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_other_expenses ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`SELECT * FROM canteen_other_expenses ${w} ORDER BY expense_date DESC, id DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}
export async function createCanteenOtherExpense(db, { expense_date, category, amount, actual_amount, params, remark }) {
  const r = await db.prepare('INSERT INTO canteen_other_expenses (expense_date, category, amount, actual_amount, params, remark) VALUES (?,?,?,?,?,?)')
    .bind(expense_date, category, amount || 0, actual_amount || 0, params || '', remark || '').run();
  return { id: r.meta.last_row_id };
}
export async function updateCanteenOtherExpense(db, id, { expense_date, category, amount, actual_amount, params, remark }) {
  const r = await db.prepare("UPDATE canteen_other_expenses SET expense_date=?, category=?, amount=?, actual_amount=?, params=?, remark=?, updated_at=datetime('now','+8 hours') WHERE id=?")
    .bind(expense_date, category, amount || 0, actual_amount || 0, params || '', remark || '', id).run();
  return r.meta.changes > 0;
}
export async function deleteCanteenOtherExpense(db, id) {
  await db.prepare('DELETE FROM canteen_other_expenses WHERE id=?').bind(id).run();
  return { ok: true };
}

// 按（月份 + 科目）整体 upsert，返回各项差额
export async function upsertCanteenOtherExpenses(db, { month, items = [] } = {}) {
  const date = `${month}-01`;
  let updated = 0, inserted = 0;
  for (const it of items) {
    if (!it.category) continue;
    const existing = await db.prepare("SELECT id FROM canteen_other_expenses WHERE substr(expense_date,1,7)=? AND category=?")
      .bind(month, it.category).first();
    if (existing) {
      await db.prepare("UPDATE canteen_other_expenses SET amount=?, actual_amount=?, params=?, remark=?, updated_at=datetime('now','+8 hours') WHERE id=?")
        .bind(Number(it.amount) || 0, Number(it.actual_amount) || 0, it.params || '', it.remark || '', existing.id).run();
      updated++;
    } else {
      await db.prepare('INSERT INTO canteen_other_expenses (expense_date, category, amount, actual_amount, params, remark) VALUES (?,?,?,?,?,?)')
        .bind(date, it.category, Number(it.amount) || 0, Number(it.actual_amount) || 0, it.params || '', it.remark || '').run();
      inserted++;
    }
  }
  return { ok: true, updated, inserted };
}

// ------ 每日收入 ------
export async function listCanteenDailyIncome(db, { month, date_from, date_to, page = 1, limit = 100 } = {}) {
  const where = []; const params = [];
  if (month) { where.push("substr(income_date,1,7)=?"); params.push(month); }
  if (date_from) { where.push('income_date>=?'); params.push(date_from); }
  if (date_to) { where.push('income_date<=?'); params.push(date_to); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_daily_income ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`SELECT * FROM canteen_daily_income ${w} ORDER BY income_date ASC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}
export async function getCanteenDailyIncome(db, id) {
  return await db.prepare('SELECT * FROM canteen_daily_income WHERE id=?').bind(id).first();
}
export async function saveCanteenDailyIncome(db, data) {
  // 自动计算：总人次 = 午餐+晚餐（早餐不计人次），总收入 = 早+中+晚金额
  const total_count = (data.lunch_count || 0) + (data.dinner_count || 0);
  const total_amount = (data.breakfast_amount || 0) + (data.lunch_amount || 0) + (data.dinner_amount || 0);
  const existing = await db.prepare('SELECT id FROM canteen_daily_income WHERE income_date=?').bind(data.income_date).first();
  if (existing) {
    await db.prepare(`UPDATE canteen_daily_income SET breakfast_count=?, breakfast_amount=?, lunch_count=?, lunch_amount=?, dinner_count=?, dinner_amount=?, total_count=?, total_amount=?, remark=?, updated_at=datetime('now','+8 hours') WHERE id=?`)
      .bind(data.breakfast_count || 0, data.breakfast_amount || 0, data.lunch_count || 0, data.lunch_amount || 0, data.dinner_count || 0, data.dinner_amount || 0, total_count, total_amount, data.remark || '', existing.id).run();
    return { ok: true, id: existing.id, updated: true };
  }
  const r = await db.prepare(`INSERT INTO canteen_daily_income
    (income_date, breakfast_count, breakfast_amount, lunch_count, lunch_amount, dinner_count, dinner_amount, total_count, total_amount, remark)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(data.income_date, data.breakfast_count || 0, data.breakfast_amount || 0, data.lunch_count || 0, data.lunch_amount || 0, data.dinner_count || 0, data.dinner_amount || 0, total_count, total_amount, data.remark || '').run();
  return { ok: true, id: r.meta.last_row_id, updated: false };
}
export async function deleteCanteenDailyIncome(db, id) {
  await db.prepare('DELETE FROM canteen_daily_income WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 资源占用费 ------
export async function listCanteenResourceFees(db, { month, year, payer, page = 1, limit = 200 } = {}) {
  const where = []; const params = [];
  if (month) { where.push("substr(fee_date,1,7)=?"); params.push(month); }
  if (year) { where.push("substr(fee_date,1,4)=?"); params.push(String(year)); }
  if (payer) { where.push('payer=?'); params.push(payer); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_resource_fees ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`SELECT * FROM canteen_resource_fees ${w} ORDER BY fee_date DESC, id DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}
export async function createCanteenResourceFee(db, { fee_date, meal_type, amount, payer, reason, remark, handler }) {
  const r = await db.prepare('INSERT INTO canteen_resource_fees (fee_date, meal_type, amount, payer, reason, remark, handler) VALUES (?,?,?,?,?,?,?)')
    .bind(fee_date, meal_type || '午餐', amount || 0, payer || '', reason || '', remark || '', handler || '').run();
  return { id: r.meta.last_row_id };
}
export async function updateCanteenResourceFee(db, id, { fee_date, meal_type, amount, payer, reason, remark, handler }) {
  const r = await db.prepare("UPDATE canteen_resource_fees SET fee_date=?, meal_type=?, amount=?, payer=?, reason=?, remark=?, handler=?, updated_at=datetime('now','+8 hours') WHERE id=?")
    .bind(fee_date, meal_type || '午餐', amount || 0, payer || '', reason || '', remark || '', handler || '', id).run();
  return r.meta.changes > 0;
}
export async function deleteCanteenResourceFee(db, id) {
  await db.prepare('DELETE FROM canteen_resource_fees WHERE id=?').bind(id).run();
  return { ok: true };
}
// 按月汇总资源占用费（同一人合并）— 用于打印预览
export async function summaryCanteenResourceFees(db, month) {
  const rows = (await db.prepare(`
    SELECT payer, SUM(amount) as total_amount, COUNT(*) as times, GROUP_CONCAT(DISTINCT reason) as reasons
    FROM canteen_resource_fees WHERE substr(fee_date,1,7)=?
    GROUP BY payer ORDER BY total_amount DESC`).bind(month).all()).results;
  const detail = (await db.prepare(`
    SELECT * FROM canteen_resource_fees WHERE substr(fee_date,1,7)=? ORDER BY fee_date, id`).bind(month).all()).results;
  const total = rows.reduce((s, r) => s + (r.total_amount || 0), 0);
  return { summary: rows, detail, total };
}

// ------ 每周菜单 ------
export async function getCanteenWeeklyMenu(db, weekStart) {
  const rows = (await db.prepare('SELECT * FROM canteen_weekly_menu WHERE week_start_date=? ORDER BY day_of_week').bind(weekStart).all()).results;
  // 组织成 7 天 × 3 餐 的矩阵
  const matrix = [];
  for (let d = 1; d <= 7; d++) {
    const day = { day_of_week: d, 早餐: '', 午餐: '', 晚餐: '', remark: '' };
    for (const r of rows) {
      if (r.day_of_week === d) {
        if (r.meal_type === '早餐') day.早餐 = r.dishes;
        if (r.meal_type === '午餐') day.午餐 = r.dishes;
        if (r.meal_type === '晚餐') day.晚餐 = r.dishes;
        if (r.remark) day.remark = r.remark;
      }
    }
    matrix.push(day);
  }
  return { week_start_date: weekStart, days: matrix, rows };
}
export async function saveCanteenWeeklyMenu(db, weekStart, days) {
  // 事务式：先删后插
  await db.prepare('DELETE FROM canteen_weekly_menu WHERE week_start_date=?').bind(weekStart).run();
  const stmt = db.prepare('INSERT OR REPLACE INTO canteen_weekly_menu (week_start_date, day_of_week, meal_type, dishes, remark) VALUES (?,?,?,?,?)');
  for (const d of days) {
    for (const meal of ['早餐', '午餐', '晚餐']) {
      const dishes = (d[meal] || '').trim();
      if (dishes) {
        await stmt.bind(weekStart, d.day_of_week, meal, dishes, d.remark || '').run();
      }
    }
  }
  return { ok: true };
}
// 复制上周菜单到本周
export async function copyCanteenWeeklyMenu(db, fromWeek, toWeek) {
  const fromRows = (await db.prepare('SELECT * FROM canteen_weekly_menu WHERE week_start_date=?').bind(fromWeek).all()).results;
  if (!fromRows.length) return { ok: false, error: '上周无菜单可复制' };
  await db.prepare('DELETE FROM canteen_weekly_menu WHERE week_start_date=?').bind(toWeek).run();
  const stmt = db.prepare('INSERT INTO canteen_weekly_menu (week_start_date, day_of_week, meal_type, dishes, remark) VALUES (?,?,?,?,?)');
  for (const r of fromRows) {
    await stmt.bind(toWeek, r.day_of_week, r.meal_type, r.dishes, r.remark || '').run();
  }
  return { ok: true, copied: fromRows.length };
}

// ------ 菜单模板 ------
export async function listCanteenMenuTemplates(db) {
  return (await db.prepare('SELECT id, name, data, created_at, updated_at FROM canteen_menu_templates ORDER BY id DESC').all()).results;
}
export async function createCanteenMenuTemplate(db, { name, data }) {
  const r = await db.prepare('INSERT INTO canteen_menu_templates (name, data) VALUES (?,?)').bind(name, JSON.stringify(data)).run();
  return { id: r.meta.last_row_id };
}
export async function deleteCanteenMenuTemplate(db, id) {
  await db.prepare('DELETE FROM canteen_menu_templates WHERE id=?').bind(id).run();
  return { ok: true };
}

// =============================================
// 数据分析
// =============================================

// 月度收支总览
export async function canteenMonthlySummary(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  // 收入（人次口径：午餐+晚餐，早餐不计人次）
  const income = (await db.prepare(`
    SELECT IFNULL(SUM(total_amount),0) as amount, IFNULL(SUM(lunch_count + dinner_count),0) as count,
           IFNULL(SUM(breakfast_amount),0) as breakfast, IFNULL(SUM(lunch_amount),0) as lunch, IFNULL(SUM(dinner_amount),0) as dinner
    FROM canteen_daily_income WHERE substr(income_date,1,7)=?`).bind(m).first());
  // 食材采购支出
  const food = (await db.prepare(`
    SELECT IFNULL(SUM(total_amount),0) as amount FROM canteen_purchases WHERE substr(purchase_date,1,7)=?`).bind(m).first());
  // 其他费用支出（优先实际金额，无实际金额时用估算金额）
  const other = (await db.prepare(`
    SELECT IFNULL(SUM(CASE WHEN actual_amount > 0 THEN actual_amount ELSE amount END),0) as amount FROM canteen_other_expenses WHERE substr(expense_date,1,7)=?`).bind(m).first());
  // 资源占用费
  const resource = (await db.prepare(`
    SELECT IFNULL(SUM(amount),0) as amount FROM canteen_resource_fees WHERE substr(fee_date,1,7)=?`).bind(m).first());
  const totalIncome = (income.amount || 0) + (resource.amount || 0);
  const totalExpense = (food.amount || 0) + (other.amount || 0);
  return {
    month: m,
    income: { total: totalIncome, meal: income.amount || 0, breakfast: income.breakfast || 0, lunch: income.lunch || 0, dinner: income.dinner || 0, resource: resource.amount || 0, count: income.count || 0 },
    expense: { total: totalExpense, food: food.amount || 0, other: other.amount || 0 },
    profit: totalIncome - totalExpense,
  };
}

// 每日收支趋势（月度）
// 其他费用（水电气、人工费）按录入月份分摊到当月每一天：share = 当月其他费用总额 / 当月天数
export async function canteenDailyTrend(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const income = (await db.prepare(`
    SELECT income_date as date, total_amount, total_count, breakfast_amount, lunch_amount, dinner_amount, lunch_count, dinner_count
    FROM canteen_daily_income WHERE substr(income_date,1,7)=? ORDER BY income_date`).bind(m).all()).results;
  const expense = (await db.prepare(`
    SELECT purchase_date as date, SUM(total_amount) as amount FROM canteen_purchases
    WHERE substr(purchase_date,1,7)=? GROUP BY purchase_date ORDER BY purchase_date`).bind(m).all()).results;
  // 资源占用费收入（按日）
  const resource = (await db.prepare(`
    SELECT fee_date as date, SUM(amount) as amount FROM canteen_resource_fees
    WHERE substr(fee_date,1,7)=? GROUP BY fee_date ORDER BY fee_date`).bind(m).all()).results;
  // 当月其他费用总额（优先实际金额，无实际金额时用估算金额；不按天归集）
  const otherRow = (await db.prepare(`
    SELECT IFNULL(SUM(CASE WHEN actual_amount > 0 THEN actual_amount ELSE amount END),0) as amount FROM canteen_other_expenses WHERE substr(expense_date,1,7)=?`).bind(m).first());
  // 当月天数
  const [y, mo] = m.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const share = daysInMonth > 0 ? Math.round(((otherRow.amount || 0) / daysInMonth) * 100) / 100 : 0;
  // 合并成按日数组
  const map = {};
  for (const r of income) {
    // 人次口径：午餐+晚餐（早餐不计人次，兼容历史 total_count 旧口径）
    const cnt = (r.lunch_count || 0) + (r.dinner_count || 0);
    // 收入 = 消费收入(total_amount，含早) + 资源占用费(另加) ；其中早餐收入=breakfast_amount
    map[r.date] = { date: r.date, income: r.total_amount || 0, count: cnt, breakfast: r.breakfast_amount || 0, lunch: r.lunch_amount || 0, dinner: r.dinner_amount || 0, resource: 0, expense: 0, share_expense: share, profit: (r.total_amount || 0) - share };
  }
  for (const r of expense) {
    if (!map[r.date]) map[r.date] = { date: r.date, income: 0, count: 0, breakfast: 0, lunch: 0, dinner: 0, resource: 0, expense: 0, share_expense: share, profit: 0 - share };
    map[r.date].expense += r.amount || 0;
    map[r.date].profit = (map[r.date].income || 0) - map[r.date].expense - share;
  }
  for (const r of resource) {
    if (!map[r.date]) map[r.date] = { date: r.date, income: 0, count: 0, breakfast: 0, lunch: 0, dinner: 0, resource: 0, expense: 0, share_expense: share, profit: 0 - share };
    map[r.date].resource += r.amount || 0;
    map[r.date].income = (map[r.date].income || 0) + (r.amount || 0);
    map[r.date].profit = (map[r.date].income || 0) - (map[r.date].expense || 0) - share;
  }
  // 若某天只有分摊支出（无采购无收入），也保留（分摊到全月每一天）
  return Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
}

// 支出构成（食材 vs 其他费用明细）
export async function canteenExpenseBreakdown(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const food = (await db.prepare(`
    SELECT IFNULL(SUM(total_amount),0) as amount FROM canteen_purchases WHERE substr(purchase_date,1,7)=?`).bind(m).first());
  const others = (await db.prepare(`
    SELECT category, SUM(CASE WHEN actual_amount > 0 THEN actual_amount ELSE amount END) as amount FROM canteen_other_expenses
    WHERE substr(expense_date,1,7)=? GROUP BY category ORDER BY amount DESC`).bind(m).all()).results;
  return { food: food.amount || 0, others };
}

// 食材采购分类占比 + Top5
export async function canteenFoodCategoryShare(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const rows = (await db.prepare(`
    SELECT c.name as category, IFNULL(SUM(pi.subtotal),0) as amount
    FROM canteen_purchase_items pi
    LEFT JOIN canteen_supplies s ON pi.supply_id = s.id
    LEFT JOIN canteen_categories c ON s.category_id = c.id
    LEFT JOIN canteen_purchases p ON pi.purchase_id = p.id
    WHERE substr(p.purchase_date,1,7)=?
    GROUP BY c.name ORDER BY amount DESC`).bind(m).all()).results;
  return rows;
}
export async function canteenTopSupplies(db, month, limit = 10) {
  const m = month || new Date().toISOString().slice(0, 7);
  return (await db.prepare(`
    SELECT s.name, s.unit, IFNULL(SUM(pi.quantity),0) as quantity, IFNULL(SUM(pi.subtotal),0) as amount
    FROM canteen_purchase_items pi
    LEFT JOIN canteen_supplies s ON pi.supply_id = s.id
    LEFT JOIN canteen_purchases p ON pi.purchase_id = p.id
    WHERE substr(p.purchase_date,1,7)=?
    GROUP BY s.id ORDER BY amount DESC LIMIT ?`).bind(m, limit).all()).results;
}

// 月度对比（半年度/年度）
export async function canteenMonthlyCompare(db, { from, to, year } = {}) {
  let where = '';
  const params = [];
  if (year) { where = "WHERE substr(income_date,1,4)=?"; params.push(String(year)); }
  else if (from && to) {
    where = "WHERE substr(income_date,1,7)>=? AND substr(income_date,1,7)<=?";
    params.push(from, to);
  }
  // 收入按月（人次口径：午餐+晚餐）
  const incomeRows = (await db.prepare(`
    SELECT substr(income_date,1,7) as month, SUM(total_amount) as income, SUM(lunch_count + dinner_count) as count
    FROM canteen_daily_income ${where} GROUP BY substr(income_date,1,7) ORDER BY month`).bind(...params).all()).results;
  // 采购按月（注意：where 含多个 income_date 占位，需全局替换为对应表列名）
  const replaceCol = (w, col) => w.replaceAll('income_date', col);
  const foodRows = (await db.prepare(`
    SELECT substr(purchase_date,1,7) as month, SUM(total_amount) as food
    FROM canteen_purchases ${replaceCol(where, 'purchase_date')} GROUP BY substr(purchase_date,1,7) ORDER BY month`).bind(...params).all()).results;
  // 其他费用按月（优先实际金额，无实际金额时用估算金额）
  const otherRows = (await db.prepare(`
    SELECT substr(expense_date,1,7) as month, SUM(CASE WHEN actual_amount > 0 THEN actual_amount ELSE amount END) as other
    FROM canteen_other_expenses ${replaceCol(where, 'expense_date')} GROUP BY substr(expense_date,1,7) ORDER BY month`).bind(...params).all()).results;
  // 资源占用费按月
  const resourceRows = (await db.prepare(`
    SELECT substr(fee_date,1,7) as month, SUM(amount) as resource
    FROM canteen_resource_fees ${replaceCol(where, 'fee_date')} GROUP BY substr(fee_date,1,7) ORDER BY month`).bind(...params).all()).results;

  const map = {};
  for (const r of incomeRows) {
    if (!map[r.month]) map[r.month] = { month: r.month, income: 0, food: 0, other: 0, resource: 0, count: 0 };
    map[r.month].income = r.income || 0;
    map[r.month].count = r.count || 0;
  }
  for (const r of foodRows) {
    if (!map[r.month]) map[r.month] = { month: r.month, income: 0, food: 0, other: 0, resource: 0, count: 0 };
    map[r.month].food = r.food || 0;
  }
  for (const r of otherRows) {
    if (!map[r.month]) map[r.month] = { month: r.month, income: 0, food: 0, other: 0, resource: 0, count: 0 };
    map[r.month].other = r.other || 0;
  }
  for (const r of resourceRows) {
    if (!map[r.month]) map[r.month] = { month: r.month, income: 0, food: 0, other: 0, resource: 0, count: 0 };
    map[r.month].resource = r.resource || 0;
  }
  return Object.values(map).sort((a, b) => a.month < b.month ? -1 : 1);
}

// 自动优化建议
export async function canteenSuggestions(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const suggestions = [];
  const cur = await canteenMonthlySummary(db, m);
  // 上月
  const [y, mo] = m.split('-').map(Number);
  const prevM = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, '0')}`;
  const prev = await canteenMonthlySummary(db, prevM);

  // 成本异常预警
  if (prev.expense.total > 0 && cur.expense.total > 0) {
    const diff = (cur.expense.total - prev.expense.total) / prev.expense.total * 100;
    if (diff > 15) suggestions.push(`本月食材及费用支出较上月上涨 ${diff.toFixed(1)}%，建议排查肉类/蔬菜价格波动原因`);
  }
  // 收入异常预警
  if (prev.income.total > 0 && cur.income.total > 0) {
    const diff = (cur.income.total - prev.income.total) / prev.income.total * 100;
    if (diff < -10) suggestions.push(`本月收入较上月下降 ${Math.abs(diff).toFixed(1)}%，建议关注就餐人数变化`);
  }
  // 盈亏健康度
  if (cur.profit < 0) suggestions.push(`本月亏损 ${Math.abs(cur.profit).toFixed(2)} 元，建议优化采购成本或调整餐费标准`);
  // 高成本食材识别
  const shares = await canteenFoodCategoryShare(db, m);
  const top = shares[0];
  if (top && cur.expense.food > 0 && (top.amount / cur.expense.food) > 0.2) {
    suggestions.push(`「${top.category}」本月采购占比达 ${(top.amount / cur.expense.food * 100).toFixed(1)}%，可考虑寻找替代供应商`);
  }
  // 人均消费参考
  if (cur.income.count > 0) {
    const perCapita = cur.income.meal / cur.income.count;
    suggestions.push(`本月日均就餐 ${Math.round(cur.income.count / Math.max(1, new Date(`${m}-28`).getDate()))} 人次，人均消费 ¥${perCapita.toFixed(2)}`);
  }
  // 供应商性价比提示（跨月同食材比价可在此扩展）
  return suggestions;
}

// 采购明细导出（CSV，按日期范围）
export async function exportCanteenPurchasesCsv(db, { date_from, date_to } = {}) {
  const where = []; const params = [];
  if (date_from) { where.push("p.purchase_date>=?"); params.push(date_from); }
  if (date_to) { where.push("p.purchase_date<=?"); params.push(date_to); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = (await db.prepare(`
    SELECT p.order_no, p.purchase_date, p.supplier_name, p.channel, s.name as supply_name, c.name as category_name,
           pi.quantity, s.unit, pi.unit_price, pi.subtotal, p.actual_pay, p.remark
    FROM canteen_purchase_items pi
    LEFT JOIN canteen_purchases p ON pi.purchase_id = p.id
    LEFT JOIN canteen_supplies s ON pi.supply_id = s.id
    LEFT JOIN canteen_categories c ON s.category_id = c.id
    ${w} ORDER BY p.purchase_date, p.id`).bind(...params).all()).results;
  const header = ['采购单号', '采购日期', '供应商', '渠道', '品名', '分类', '数量', '单位', '单价', '小计', '实支金额', '备注'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.order_no, r.purchase_date, r.supplier_name || '', r.channel || '', r.supply_name || '', r.category_name || '', r.quantity, r.unit || '', r.unit_price, r.subtotal, r.actual_pay || '', (r.remark || '').replace(/,/g, '，')].join(','));
  }
  return lines.join('\n');
}

// =============================================
// 饭卡充值（CSV 导入）
// =============================================

// 列表
export async function listCanteenRecharges(db, { month, year, keyword, page = 1, limit = 20 } = {}) {
  const where = []; const params = [];
  if (month) { where.push("substr(recharge_date,1,7)=?"); params.push(month); }
  if (year) { where.push("substr(recharge_date,1,4)=?"); params.push(String(year)); }
  if (keyword) { where.push('(user_name LIKE ? OR user_id LIKE ? OR card_no LIKE ? OR external_sn LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_card_recharges ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`SELECT * FROM canteen_card_recharges ${w} ORDER BY recharge_date DESC, id DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}

export async function deleteCanteenRecharge(db, id) {
  await db.prepare('DELETE FROM canteen_card_recharges WHERE id=?').bind(id).run();
  return { ok: true };
}

// 月度汇总
export async function summaryCanteenRecharges(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const row = (await db.prepare(`
    SELECT IFNULL(SUM(amount),0) as total, COUNT(*) as count, COUNT(DISTINCT user_name) as people
    FROM canteen_card_recharges WHERE substr(recharge_date,1,7)=?`).bind(m).first());
  return { month: m, total: row.total || 0, count: row.count || 0, people: row.people || 0 };
}

// CSV 导入（支持 upsert / skip 模式，mapping 为列映射 JSON）
export async function importCanteenRecharges(db, { rows, mode = 'upsert', mapping = {} } = {}) {
  const result = { total: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
  if (!Array.isArray(rows)) return result;
  result.total = rows.length;

  // 映射：系统字段 -> CSV 列名；rows 已按 sysKey 归一（行构造时 row[sysKey]=cols[idx]）
  const f = (row, key, fallback = '') => {
    const v = row[key];
    return v === undefined || v === null ? fallback : String(v).trim();
  };
  const cleanMoney = (v) => {
    const n = parseFloat(String(v || '').replace(/[￥¥,\s]/g, ''));
    return isNaN(n) ? null : n;
  };
  const cleanDate = (v) => {
    // 取日期部分（支持 YYYY-MM-DD HH:mm:ss 或 YYYY/MM/DD）
    const s = String(v || '').trim();
    const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!m) return '';
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  };

  const stmtInsert = db.prepare(`INSERT INTO canteen_card_recharges
    (external_sn, card_no, user_id, user_name, department_code, user_department, recharge_date, amount, balance_recorded, payment_method, operator, machine_no, bill_no, remark)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const stmtUpdate = db.prepare(`UPDATE canteen_card_recharges SET
    card_no=?, user_id=?, user_name=?, department_code=?, user_department=?, recharge_date=?, amount=?, balance_recorded=?, payment_method=?, operator=?, machine_no=?, bill_no=?, remark=?, updated_at=datetime('now','+8 hours')
    WHERE external_sn=?`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const external_sn = f(row, 'external_sn');
    const user_name = f(row, 'user_name');
    const recharge_date = cleanDate(f(row, 'recharge_date'));
    const amount = cleanMoney(f(row, 'amount'));

    // 校验必填
    const missing = [];
    if (!external_sn) missing.push('外部编号缺失');
    if (!user_name) missing.push('姓名缺失');
    if (!recharge_date) missing.push('日期缺失');
    if (amount === null) missing.push('金额格式错误');
    if (missing.length) {
      result.errors.push({ row: i + 2, reason: missing.join('、') });
      continue;
    }

    const rec = {
      card_no: f(row, 'card_no'),
      user_id: f(row, 'user_id'),
      department_code: f(row, 'department_code'),
      user_department: f(row, 'user_department'),
      payment_method: f(row, 'payment_method', '现金') || '现金',
      operator: f(row, 'operator', '导入') || '导入',
      machine_no: f(row, 'machine_no'),
      bill_no: f(row, 'bill_no'),
      remark: f(row, 'remark'),
      balance_recorded: cleanMoney(f(row, 'balance_recorded')),
    };

    const existing = await db.prepare('SELECT id FROM canteen_card_recharges WHERE external_sn=?').bind(external_sn).first();
    if (existing) {
      if (mode === 'skip') { result.skipped++; continue; }
      await stmtUpdate.bind(
        rec.card_no, rec.user_id, user_name, rec.department_code, rec.user_department,
        recharge_date, amount, rec.balance_recorded, rec.payment_method, rec.operator,
        rec.machine_no, rec.bill_no, rec.remark, external_sn,
      ).run();
      result.updated++;
    } else {
      await stmtInsert.bind(
        external_sn, rec.card_no, rec.user_id, user_name, rec.department_code, rec.user_department,
        recharge_date, amount, rec.balance_recorded, rec.payment_method, rec.operator,
        rec.machine_no, rec.bill_no, rec.remark,
      ).run();
      result.inserted++;
    }
  }
  return result;
}
