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
export async function createCanteenOtherExpense(db, { expense_date, category, amount, remark }) {
  const r = await db.prepare('INSERT INTO canteen_other_expenses (expense_date, category, amount, remark) VALUES (?,?,?,?)')
    .bind(expense_date, category, amount || 0, remark || '').run();
  return { id: r.meta.last_row_id };
}
export async function updateCanteenOtherExpense(db, id, { expense_date, category, amount, remark }) {
  const r = await db.prepare("UPDATE canteen_other_expenses SET expense_date=?, category=?, amount=?, remark=?, updated_at=datetime('now','+8 hours') WHERE id=?")
    .bind(expense_date, category, amount || 0, remark || '', id).run();
  return r.meta.changes > 0;
}
export async function deleteCanteenOtherExpense(db, id) {
  await db.prepare('DELETE FROM canteen_other_expenses WHERE id=?').bind(id).run();
  return { ok: true };
}

// ------ 每日收入 ------
export async function listCanteenDailyIncome(db, { month, date_from, date_to, page = 1, limit = 100 } = {}) {
  const where = []; const params = [];
  if (month) { where.push("substr(income_date,1,7)=?"); params.push(month); }
  if (date_from) { where.push('income_date>=?'); params.push(date_from); }
  if (date_to) { where.push('income_date<=?'); params.push(date_to); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM canteen_daily_income ${w}`).bind(...params).first()).c;
  const items = (await db.prepare(`SELECT * FROM canteen_daily_income ${w} ORDER BY income_date DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results;
  return { items, total, page, limit };
}
export async function getCanteenDailyIncome(db, id) {
  return await db.prepare('SELECT * FROM canteen_daily_income WHERE id=?').bind(id).first();
}
export async function saveCanteenDailyIncome(db, data) {
  // 自动计算：总人次 = 早+中+晚，总收入 = 早+中+晚金额
  const total_count = (data.breakfast_count || 0) + (data.lunch_count || 0) + (data.dinner_count || 0);
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
  // 收入
  const income = (await db.prepare(`
    SELECT IFNULL(SUM(total_amount),0) as amount, IFNULL(SUM(total_count),0) as count,
           IFNULL(SUM(breakfast_amount),0) as breakfast, IFNULL(SUM(lunch_amount),0) as lunch, IFNULL(SUM(dinner_amount),0) as dinner
    FROM canteen_daily_income WHERE substr(income_date,1,7)=?`).bind(m).first());
  // 食材采购支出
  const food = (await db.prepare(`
    SELECT IFNULL(SUM(total_amount),0) as amount FROM canteen_purchases WHERE substr(purchase_date,1,7)=?`).bind(m).first());
  // 其他费用支出
  const other = (await db.prepare(`
    SELECT IFNULL(SUM(amount),0) as amount FROM canteen_other_expenses WHERE substr(expense_date,1,7)=?`).bind(m).first());
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
export async function canteenDailyTrend(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const income = (await db.prepare(`
    SELECT income_date as date, total_amount, total_count, breakfast_amount, lunch_amount, dinner_amount
    FROM canteen_daily_income WHERE substr(income_date,1,7)=? ORDER BY income_date`).bind(m).all()).results;
  const expense = (await db.prepare(`
    SELECT purchase_date as date, SUM(total_amount) as amount FROM canteen_purchases
    WHERE substr(purchase_date,1,7)=? GROUP BY purchase_date ORDER BY purchase_date`).bind(m).all()).results;
  const other = (await db.prepare(`
    SELECT expense_date as date, SUM(amount) as amount FROM canteen_other_expenses
    WHERE substr(expense_date,1,7)=? GROUP BY expense_date ORDER BY expense_date`).bind(m).all()).results;
  // 合并成按日数组
  const map = {};
  for (const r of income) {
    map[r.date] = { date: r.date, income: r.total_amount || 0, count: r.total_count || 0, breakfast: r.breakfast_amount || 0, lunch: r.lunch_amount || 0, dinner: r.dinner_amount || 0, expense: 0, profit: (r.total_amount || 0) };
  }
  for (const r of expense) {
    if (!map[r.date]) map[r.date] = { date: r.date, income: 0, count: 0, breakfast: 0, lunch: 0, dinner: 0, expense: 0, profit: 0 };
    map[r.date].expense += r.amount || 0;
    map[r.date].profit = (map[r.date].income || 0) - map[r.date].expense;
  }
  for (const r of other) {
    if (!map[r.date]) map[r.date] = { date: r.date, income: 0, count: 0, breakfast: 0, lunch: 0, dinner: 0, expense: 0, profit: 0 };
    map[r.date].expense += r.amount || 0;
    map[r.date].profit = (map[r.date].income || 0) - map[r.date].expense;
  }
  return Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
}

// 支出构成（食材 vs 其他费用明细）
export async function canteenExpenseBreakdown(db, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const food = (await db.prepare(`
    SELECT IFNULL(SUM(total_amount),0) as amount FROM canteen_purchases WHERE substr(purchase_date,1,7)=?`).bind(m).first());
  const others = (await db.prepare(`
    SELECT category, SUM(amount) as amount FROM canteen_other_expenses
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
export async function canteenTopSupplies(db, month, limit = 5) {
  const m = month || new Date().toISOString().slice(0, 7);
  return (await db.prepare(`
    SELECT s.name, s.unit, IFNULL(SUM(pi.quantity),0) as quantity, IFNULL(SUM(pi.subtotal),0) as amount
    FROM canteen_purchase_items pi
    LEFT JOIN canteen_supplies s ON pi.supply_id = s.id
    LEFT JOIN canteen_purchases p ON pi.purchase_id = p.id
    WHERE substr(p.purchase_date,1,7)=?
    GROUP BY s.id ORDER BY quantity DESC LIMIT ?`).bind(m, limit).all()).results;
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
  // 收入按月
  const incomeRows = (await db.prepare(`
    SELECT substr(income_date,1,7) as month, SUM(total_amount) as income, SUM(total_count) as count
    FROM canteen_daily_income ${where} GROUP BY substr(income_date,1,7) ORDER BY month`).bind(...params).all()).results;
  // 采购按月
  const foodRows = (await db.prepare(`
    SELECT substr(purchase_date,1,7) as month, SUM(total_amount) as food
    FROM canteen_purchases ${where.replace('income_date', 'purchase_date')} GROUP BY substr(purchase_date,1,7) ORDER BY month`).bind(...params).all()).results;
  // 其他费用按月
  const otherRows = (await db.prepare(`
    SELECT substr(expense_date,1,7) as month, SUM(amount) as other
    FROM canteen_other_expenses ${where.replace('income_date', 'expense_date')} GROUP BY substr(expense_date,1,7) ORDER BY month`).bind(...params).all()).results;
  // 资源占用费按月
  const resourceRows = (await db.prepare(`
    SELECT substr(fee_date,1,7) as month, SUM(amount) as resource
    FROM canteen_resource_fees ${where.replace('income_date', 'fee_date')} GROUP BY substr(fee_date,1,7) ORDER BY month`).bind(...params).all()).results;

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
