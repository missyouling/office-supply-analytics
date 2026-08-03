// =============================================
// 食堂管理模块 — Hono 路由 v1.0
// 挂在 /api/canteen/* 下，与办公用品 API 共存
// =============================================
import { Hono } from 'hono';
import {
  listCanteenCategories, createCanteenCategory, updateCanteenCategory, deleteCanteenCategory,
  listCanteenSupplies, listCanteenSuppliesAll, createCanteenSupply, updateCanteenSupply, deleteCanteenSupply,
  listCanteenExpenseCategories, createCanteenExpenseCategory, updateCanteenExpenseCategory, deleteCanteenExpenseCategory,
  listCanteenPurchases, getCanteenPurchaseDetail, createCanteenPurchase, updateCanteenPurchase, deleteCanteenPurchase,
  listCanteenOtherExpenses, createCanteenOtherExpense, updateCanteenOtherExpense, deleteCanteenOtherExpense,
  listCanteenDailyIncome, getCanteenDailyIncome, saveCanteenDailyIncome, deleteCanteenDailyIncome,
  listCanteenResourceFees, createCanteenResourceFee, updateCanteenResourceFee, deleteCanteenResourceFee, summaryCanteenResourceFees,
  getCanteenWeeklyMenu, saveCanteenWeeklyMenu, copyCanteenWeeklyMenu,
  listCanteenMenuTemplates, createCanteenMenuTemplate, deleteCanteenMenuTemplate,
  canteenMonthlySummary, canteenDailyTrend, canteenExpenseBreakdown, canteenFoodCategoryShare,
  canteenTopSupplies, canteenMonthlyCompare, canteenSuggestions, exportCanteenPurchasesCsv,
  listCanteenRecharges, deleteCanteenRecharge, summaryCanteenRecharges, importCanteenRecharges,
} from './canteen-db.js';

const canteen = new Hono();
const ok = (data) => ({ ok: true, ...data });
const fail = (c, e) => c.json({ ok: false, error: e.message }, 500);

// ============ 食材分类 ============
canteen.get('/categories', async (c) => {
  try { return c.json(ok({ items: await listCanteenCategories(c.env.DB) })); } catch (e) { return fail(c, e); }
});
canteen.post('/categories', async (c) => {
  try { const b = await c.req.json(); if (!b.name) return c.json({ ok: false, error: '名称不能为空' }, 400);
    return c.json(ok(await createCanteenCategory(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.put('/categories/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateCanteenCategory(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json(ok({})); } catch (e) { return fail(c, e); }
});
canteen.delete('/categories/:id', async (c) => {
  try { return c.json(await deleteCanteenCategory(c.env.DB, Number(c.req.param('id')))); } catch (e) { return fail(c, e); }
});

// ============ 食材字典 ============
canteen.get('/supplies', async (c) => {
  try {
    const { keyword, category_id, status, page, limit } = c.req.query();
    const r = await listCanteenSupplies(c.env.DB, { keyword, category_id, status, page: Number(page) || 1, limit: Number(limit) || 50 });
    return c.json(ok(r));
  } catch (e) { return fail(c, e); }
});
canteen.get('/supplies/all', async (c) => {
  try { return c.json(ok({ items: await listCanteenSuppliesAll(c.env.DB) })); } catch (e) { return fail(c, e); }
});
canteen.post('/supplies', async (c) => {
  try { const b = await c.req.json(); if (!b.name) return c.json({ ok: false, error: '品名不能为空' }, 400);
    return c.json(ok(await createCanteenSupply(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.put('/supplies/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateCanteenSupply(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json(ok({})); } catch (e) { return fail(c, e); }
});
canteen.delete('/supplies/:id', async (c) => {
  try { return c.json(await deleteCanteenSupply(c.env.DB, Number(c.req.param('id')))); } catch (e) { return fail(c, e); }
});

// ============ 费用科目 ============
canteen.get('/expense-categories', async (c) => {
  try { return c.json(ok({ items: await listCanteenExpenseCategories(c.env.DB) })); } catch (e) { return fail(c, e); }
});
canteen.post('/expense-categories', async (c) => {
  try { const b = await c.req.json(); if (!b.name) return c.json({ ok: false, error: '名称不能为空' }, 400);
    return c.json(ok(await createCanteenExpenseCategory(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.put('/expense-categories/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateCanteenExpenseCategory(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json(ok({})); } catch (e) { return fail(c, e); }
});
canteen.delete('/expense-categories/:id', async (c) => {
  try { return c.json(await deleteCanteenExpenseCategory(c.env.DB, Number(c.req.param('id')))); } catch (e) { return fail(c, e); }
});

// ============ 采购单 ============
canteen.get('/purchases', async (c) => {
  try {
    const { page, limit, date_from, date_to, keyword } = c.req.query();
    const r = await listCanteenPurchases(c.env.DB, { page: Number(page) || 1, limit: Number(limit) || 20, date_from, date_to, keyword });
    return c.json(ok(r));
  } catch (e) { return fail(c, e); }
});
canteen.get('/purchases/:id', async (c) => {
  try { const p = await getCanteenPurchaseDetail(c.env.DB, Number(c.req.param('id'))); if (!p) return c.json({ ok: false, error: '不存在' }, 404);
    return c.json(ok(p)); } catch (e) { return fail(c, e); }
});
canteen.post('/purchases', async (c) => {
  try { const b = await c.req.json();
    const r = await createCanteenPurchase(c.env.DB, b);
    if (!r.ok) return c.json({ ok: false, error: r.error }, 400);
    return c.json(ok(r)); } catch (e) { return fail(c, e); }
});
canteen.put('/purchases/:id', async (c) => {
  try { const b = await c.req.json(); const r = await updateCanteenPurchase(c.env.DB, Number(c.req.param('id')), b);
    if (!r) return c.json({ ok: false, error: '不存在' }, 404); return c.json(ok(r)); } catch (e) { return fail(c, e); }
});
canteen.delete('/purchases/:id', async (c) => {
  try { await deleteCanteenPurchase(c.env.DB, Number(c.req.param('id'))); return c.json(ok({})); } catch (e) { return fail(c, e); }
});
// 采购明细导出 CSV（日期范围）
canteen.get('/purchases/export/csv', async (c) => {
  try {
    const { date_from, date_to } = c.req.query();
    const csv = '\uFEFF' + await exportCanteenPurchasesCsv(c.env.DB, { date_from, date_to });
    c.header('Content-Type', 'text/csv;charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="canteen-purchases.csv"');
    return c.body(csv);
  } catch (e) { return fail(c, e); }
});

// ============ 其他费用 ============
canteen.get('/expenses', async (c) => {
  try {
    const { month, year, category, page, limit } = c.req.query();
    const r = await listCanteenOtherExpenses(c.env.DB, { month, year, category, page: Number(page) || 1, limit: Number(limit) || 100 });
    return c.json(ok(r));
  } catch (e) { return fail(c, e); }
});
canteen.post('/expenses', async (c) => {
  try { const b = await c.req.json(); if (!b.expense_date || !b.category) return c.json({ ok: false, error: '日期和科目不能为空' }, 400);
    return c.json(ok(await createCanteenOtherExpense(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.put('/expenses/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateCanteenOtherExpense(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json(ok({})); } catch (e) { return fail(c, e); }
});
canteen.delete('/expenses/:id', async (c) => {
  try { await deleteCanteenOtherExpense(c.env.DB, Number(c.req.param('id'))); return c.json(ok({})); } catch (e) { return fail(c, e); }
});

// ============ 每日收入 ============
canteen.get('/income', async (c) => {
  try {
    const { month, date_from, date_to, page, limit } = c.req.query();
    const r = await listCanteenDailyIncome(c.env.DB, { month, date_from, date_to, page: Number(page) || 1, limit: Number(limit) || 100 });
    return c.json(ok(r));
  } catch (e) { return fail(c, e); }
});
canteen.get('/income/:id', async (c) => {
  try { const r = await getCanteenDailyIncome(c.env.DB, Number(c.req.param('id'))); if (!r) return c.json({ ok: false, error: '不存在' }, 404);
    return c.json(ok(r)); } catch (e) { return fail(c, e); }
});
canteen.post('/income', async (c) => {
  try { const b = await c.req.json(); if (!b.income_date) return c.json({ ok: false, error: '日期不能为空' }, 400);
    return c.json(ok(await saveCanteenDailyIncome(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.put('/income/:id', async (c) => {
  try { const b = await c.req.json(); return c.json(ok(await saveCanteenDailyIncome(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.delete('/income/:id', async (c) => {
  try { await deleteCanteenDailyIncome(c.env.DB, Number(c.req.param('id'))); return c.json(ok({})); } catch (e) { return fail(c, e); }
});

// ============ 资源占用费 ============
canteen.get('/resource-fees', async (c) => {
  try {
    const { month, year, payer, page, limit } = c.req.query();
    const r = await listCanteenResourceFees(c.env.DB, { month, year, payer, page: Number(page) || 1, limit: Number(limit) || 200 });
    return c.json(ok(r));
  } catch (e) { return fail(c, e); }
});
canteen.post('/resource-fees', async (c) => {
  try { const b = await c.req.json(); if (!b.fee_date || !b.payer) return c.json({ ok: false, error: '日期和缴费人不能为空' }, 400);
    return c.json(ok(await createCanteenResourceFee(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.put('/resource-fees/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateCanteenResourceFee(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json(ok({})); } catch (e) { return fail(c, e); }
});
canteen.delete('/resource-fees/:id', async (c) => {
  try { await deleteCanteenResourceFee(c.env.DB, Number(c.req.param('id'))); return c.json(ok({})); } catch (e) { return fail(c, e); }
});
// 月度汇总（同人合并，打印用）
canteen.get('/resource-fees/summary/:month', async (c) => {
  try { return c.json(ok(await summaryCanteenResourceFees(c.env.DB, c.req.param('month')))); } catch (e) { return fail(c, e); }
});

// ============ 每周菜单 ============
canteen.get('/menus', async (c) => {
  try {
    const week = c.req.query('week');
    if (!week) return c.json({ ok: false, error: '缺少 week 参数' }, 400);
    return c.json(ok(await getCanteenWeeklyMenu(c.env.DB, week)));
  } catch (e) { return fail(c, e); }
});
canteen.post('/menus', async (c) => {
  try {
    const b = await c.req.json();
    if (!b.week_start_date || !b.days) return c.json({ ok: false, error: '缺少参数' }, 400);
    return c.json(ok(await saveCanteenWeeklyMenu(c.env.DB, b.week_start_date, b.days)));
  } catch (e) { return fail(c, e); }
});
canteen.post('/menus/copy', async (c) => {
  try {
    const b = await c.req.json();
    if (!b.from || !b.to) return c.json({ ok: false, error: '缺少参数' }, 400);
    return c.json(await copyCanteenWeeklyMenu(c.env.DB, b.from, b.to));
  } catch (e) { return fail(c, e); }
});

// ============ 菜单模板 ============
canteen.get('/menu-templates', async (c) => {
  try { return c.json(ok({ items: await listCanteenMenuTemplates(c.env.DB) })); } catch (e) { return fail(c, e); }
});
canteen.post('/menu-templates', async (c) => {
  try { const b = await c.req.json(); if (!b.name || !b.data) return c.json({ ok: false, error: '名称和内容不能为空' }, 400);
    return c.json(ok(await createCanteenMenuTemplate(c.env.DB, b))); } catch (e) { return fail(c, e); }
});
canteen.delete('/menu-templates/:id', async (c) => {
  try { await deleteCanteenMenuTemplate(c.env.DB, Number(c.req.param('id'))); return c.json(ok({})); } catch (e) { return fail(c, e); }
});

// ============ 数据分析 ============
canteen.get('/analytics/summary', async (c) => {
  try { return c.json(ok(await canteenMonthlySummary(c.env.DB, c.req.query('month')))); } catch (e) { return fail(c, e); }
});
canteen.get('/analytics/daily-trend', async (c) => {
  try { return c.json(ok({ items: await canteenDailyTrend(c.env.DB, c.req.query('month')) })); } catch (e) { return fail(c, e); }
});
canteen.get('/analytics/expense-breakdown', async (c) => {
  try { return c.json(ok(await canteenExpenseBreakdown(c.env.DB, c.req.query('month')))); } catch (e) { return fail(c, e); }
});
canteen.get('/analytics/food-share', async (c) => {
  try { return c.json(ok({ items: await canteenFoodCategoryShare(c.env.DB, c.req.query('month')) })); } catch (e) { return fail(c, e); }
});
canteen.get('/analytics/top-supplies', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 5;
    return c.json(ok({ items: await canteenTopSupplies(c.env.DB, c.req.query('month'), limit) }));
  } catch (e) { return fail(c, e); }
});
canteen.get('/analytics/monthly-compare', async (c) => {
  try {
    const { from, to, year } = c.req.query();
    return c.json(ok({ items: await canteenMonthlyCompare(c.env.DB, { from, to, year }) }));
  } catch (e) { return fail(c, e); }
});
canteen.get('/analytics/suggestions', async (c) => {
  try { return c.json(ok({ items: await canteenSuggestions(c.env.DB, c.req.query('month')) })); } catch (e) { return fail(c, e); }
});

// ============ 饭卡充值 ============
canteen.get('/recharges', async (c) => {
  try {
    const { month, year, keyword, page, limit } = c.req.query();
    const r = await listCanteenRecharges(c.env.DB, { month, year, keyword, page: Number(page) || 1, limit: Number(limit) || 20 });
    return c.json(ok(r));
  } catch (e) { return fail(c, e); }
});
canteen.get('/recharges/summary', async (c) => {
  try { return c.json(ok(await summaryCanteenRecharges(c.env.DB, c.req.query('month')))); } catch (e) { return fail(c, e); }
});
canteen.delete('/recharges/:id', async (c) => {
  try { await deleteCanteenRecharge(c.env.DB, Number(c.req.param('id'))); return c.json(ok({})); } catch (e) { return fail(c, e); }
});
// CSV 导入：POST /api/canteen/recharges/import  (multipart: file + mode + mapping JSON)
canteen.post('/recharges/import', async (c) => {
  try {
    const form = await c.req.parseBody();
    const file = form['file'];
    if (!file || typeof file === 'string' || !file.arrayBuffer) return c.json({ ok: false, error: '缺少 CSV 文件' }, 400);
    const mode = String(form['mode'] || 'upsert');
    let mapping = {};
    try { mapping = JSON.parse(String(form['mapping'] || '{}')); } catch { mapping = {}; }

    const buf = await file.arrayBuffer();
    let text = '';
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { try { text = new TextDecoder('gbk').decode(buf); } catch { text = new TextDecoder('utf-8', { fatal: false }).decode(buf); } }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    // 解析 CSV（支持双引号）
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return c.json({ ok: false, error: 'CSV 数据不足' }, 400);
    const parseLine = (line) => {
      const out = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim().replace(/^"|"$/g, ''));
    };
    const header = parseLine(lines[0]);
    // 若 mapping 为空则按列名智能匹配
    const norm = (h) => h.replace(/[|｜]/g, '').replace(/\s+/g, '').toLowerCase();
    const headerNorm = header.map(norm);
    const autoMap = (targets) => {
      for (const t of targets) {
        const idx = headerNorm.findIndex((h) => h.includes(t));
        if (idx >= 0) return header[idx];
      }
      return '';
    };
    if (!mapping.external_sn) mapping.external_sn = autoMap(['卡流水号', '流水号', 'externalsn']);
    if (!mapping.user_name) mapping.user_name = autoMap(['姓名', '用户名', 'username']);
    if (!mapping.user_id) mapping.user_id = autoMap(['工号', 'userid', '员工编号']);
    if (!mapping.card_no) mapping.card_no = autoMap(['卡号', 'cardno']);
    if (!mapping.department_code) mapping.department_code = autoMap(['部门编号', 'departmentcode']);
    if (!mapping.user_department) mapping.user_department = autoMap(['部门名称', '部门', 'department']);
    if (!mapping.recharge_date) mapping.recharge_date = autoMap(['充值时间', '充值日期', '时间', 'rechargedate']);
    if (!mapping.amount) mapping.amount = autoMap(['充值金额', '金额', 'amount']);
    if (!mapping.balance_recorded) mapping.balance_recorded = autoMap(['卡余额', '余额', 'balance']);
    if (!mapping.payment_method) mapping.payment_method = autoMap(['类型', '支付方式', 'paymentmethod']);
    if (!mapping.operator) mapping.operator = autoMap(['操作员', 'operator']);
    if (!mapping.machine_no) mapping.machine_no = autoMap(['机号', 'machineno']);
    if (!mapping.bill_no) mapping.bill_no = autoMap(['账单号', 'billno']);

    // 必填映射检查
    const required = ['external_sn', 'user_name', 'recharge_date', 'amount'];
    const missingCols = required.filter((k) => !mapping[k]);
    if (missingCols.length) return c.json({ ok: false, error: `缺少必填列映射：${missingCols.join(', ')}`, debug: { header, mapping } }, 400);

    // 构造行对象
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (/汇总|合计|总计|小计/.test(cols[0] || '')) continue;
      const row = {};
      for (const [sysKey, colName] of Object.entries(mapping)) {
        if (!colName) continue;
        const idx = header.findIndex((h) => h === colName);
        if (idx >= 0) row[sysKey] = cols[idx] || '';
      }
      rows.push(row);
    }
    const result = await importCanteenRecharges(c.env.DB, { rows, mode, mapping });
    return c.json({ ok: true, data: result });
  } catch (e) { return fail(c, e); }
});

export default canteen;
