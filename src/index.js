// =============================================
// Worker 入口 — Hono API v2.0
// 覆盖用品字典、分类、供应商、采购单管理、分析
// =============================================
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  listCategories, getCategory, createCategory, updateCategory, deleteCategory,
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  listSupplies, getSupply, createSupply, updateSupply, deleteSupply, batchCreateSupplies, exportSuppliesCsv,
  listPurchases, getPurchaseDetail, createPurchase, updatePurchase, deletePurchase, copyPurchase,
  exportsPurchasesCsv, exportPurchaseCsv, listUnpaidPurchases, resetSystem,
  listBackups, createBackup, restoreBackup, deleteBackup,
  listPaymentRequests, getPaymentRequest, createPaymentRequest, updatePaymentRequest, deletePaymentRequest,
} from './db.js';
import { generatePurchasePdf, generateReportPdf } from './pdf.js';
import { getAnalyticsSummary, getCategoryTrend, getFrequency, getTopItems, getPriceAnomaly, getSuggestions, getMonthlyTrend } from './analytics.js';
import canteen from './canteen-routes.js';

const app = new Hono();
app.use('*', cors());

// 食堂管理模块（挂载在 /api/canteen 前缀下）
app.route('/api/canteen', canteen);

// ============ 基础密码认证 ============
// 启用方式：Worker 环境变量 PASS（未设置则默认 2153）
// GET /api/auth/config  -> 是否启用认证（供前端决定是否展示登录页）
app.get('/api/auth/config', async (c) => {
  const enabled = c.env.PASS !== undefined && c.env.PASS !== '' ? true : true; // 默认始终启用
  return c.json({ ok: true, enabled });
});
// POST /api/auth/verify { password } -> 服务端比对，避免密码写死在前端
app.post('/api/auth/verify', async (c) => {
  try {
    const b = await c.req.json();
    const pass = c.env.PASS || '2153';
    return c.json({ ok: true, success: String(b.password || '') === pass });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 分类 API ============
app.get('/api/categories', async (c) => {
  try { return c.json({ ok: true, items: await listCategories(c.env.DB) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/categories', async (c) => {
  try { const b = await c.req.json(); if (!b.name) return c.json({ ok: false, error: '名称不能为空' }, 400);
    return c.json({ ok: true, ...await createCategory(c.env.DB, b) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.put('/api/categories/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateCategory(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到或未修改' }, 404);
    return c.json({ ok: true }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.delete('/api/categories/:id', async (c) => {
  try { return c.json(await deleteCategory(c.env.DB, Number(c.req.param('id')))); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 供应商 API ============
app.get('/api/suppliers', async (c) => {
  try { return c.json({ ok: true, items: await listSuppliers(c.env.DB) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/suppliers', async (c) => {
  try { const b = await c.req.json(); if (!b.name) return c.json({ ok: false, error: '名称不能为空' }, 400);
    return c.json({ ok: true, ...await createSupplier(c.env.DB, b) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.put('/api/suppliers/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateSupplier(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json({ ok: true }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.delete('/api/suppliers/:id', async (c) => {
  try { return c.json(await deleteSupplier(c.env.DB, Number(c.req.param('id')))); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 用品 API ============
app.get('/api/supplies', async (c) => {
  try {
    const { keyword, category_id, status, page, limit } = c.req.query();
    const r = await listSupplies(c.env.DB, { keyword, category_id, status, page: Number(page)||1, limit: Number(limit)||20 });
    return c.json({ ok: true, ...r });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/supplies/all', async (c) => {
  try {
    const r = await listSupplies(c.env.DB, { page: 1, limit: 99999 });
    return c.json({ ok: true, items: r.items });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
// 获取所有单位（去重）— 必须在 :id 路由之前
app.get('/api/supplies/units', async (c) => {
  try {
    const rows = await c.env.DB.prepare("SELECT DISTINCT unit FROM supplies WHERE unit IS NOT NULL AND unit!='' ORDER BY unit").all();
    let units = rows.results.map(r => r.unit);
    // 检查是否有新单位需要加入（从 supplies 表中收集所有未在预设列表中的）
    const defaults = ['个','包','箱','瓶','支','双','卷','盒','条','袋'];
    const all = [...units];
    // 同时从最近新增的用品中提取单位
    const recent = await c.env.DB.prepare("SELECT DISTINCT unit FROM supplies WHERE unit IS NOT NULL AND unit!='' AND unit NOT IN ('个','包','箱','瓶','支','双','卷','盒','条','袋') ORDER BY id DESC LIMIT 20").all();
    const news = (recent.results || []).map(r => r.unit);
    for (const u of news) { if (!all.includes(u)) all.push(u); }
    return c.json({ ok: true, units: all });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/supplies/export', async (c) => {
  try {
    const { keyword, category_id, status } = c.req.query();
    const csv = '\uFEFF' + await exportSuppliesCsv(c.env.DB, { keyword, category_id, status });
    c.header('Content-Type', 'text/csv;charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="supplies.csv"');
    return c.body(csv);
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/supplies/:id', async (c) => {
  try { const s = await getSupply(c.env.DB, Number(c.req.param('id'))); if (!s) return c.json({ ok: false, error: '不存在' }, 404);
    return c.json({ ok: true, ...s }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/supplies', async (c) => {
  try { const b = await c.req.json(); if (!b.name) return c.json({ ok: false, error: '品名不能为空' }, 400);
    return c.json({ ok: true, ...await createSupply(c.env.DB, b) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.put('/api/supplies/:id', async (c) => {
  try { const b = await c.req.json();
    if (!await updateSupply(c.env.DB, Number(c.req.param('id')), b)) return c.json({ ok: false, error: '未找到' }, 404);
    return c.json({ ok: true }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.delete('/api/supplies/:id', async (c) => {
  try { return c.json(await deleteSupply(c.env.DB, Number(c.req.param('id')))); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
// 批量导入 (CSV)
app.post('/api/supplies/import', async (c) => {
  try {
    const buf = await c.req.arrayBuffer();
    let body = '';
    // 尝试 UTF-8 解码
    try {
      body = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    } catch { body = ''; }
    // 如果出现替换字符，尝试 GBK
    if (body.indexOf('\uFFFD') >= 0) {
      try { body = new TextDecoder('gbk', { fatal: false }).decode(buf); } catch { /* 保留 UTF-8 */ }
    }
    // 移除 UTF-8 BOM
    if (body.charCodeAt(0) === 0xFEFF) body = body.slice(1);
    const lines = body.split('\n').filter(Boolean);
    if (lines.length < 2) return c.json({ ok: false, error: '数据不足（至少含表头和一行数据）' }, 400);
    // 按表头识别列位置（兼容：导出格式 品名,规格,单位,参考单价,分类,供应商,状态,备注 / 新模板 品名,规格,单位,参考单价,分类名称,备注 / 旧模板含安全库存）
    const header = lines[0].split(',').map(s => s.trim());
    let nameIdx = 0, specIdx = 1, unitIdx = 2, priceIdx = 3, catIdx = 4, remarkIdx = -1;
    if (header.some(h => h.includes('品名'))) {
      nameIdx = header.findIndex(h => h.includes('品名'));
      specIdx = header.findIndex(h => h.includes('规格'));
      unitIdx = header.findIndex(h => h.includes('单位'));
      priceIdx = header.findIndex(h => h.includes('参考单价') || h.includes('单价'));
      catIdx = header.findIndex(h => h.includes('分类'));
      remarkIdx = header.findIndex(h => h.includes('备注'));
    } else {
      // 无表头时按新模板位置：品名,规格,单位,参考单价,分类名称,备注
      remarkIdx = 5;
    }
    if (nameIdx < 0) nameIdx = 0;
    if (specIdx < 0) specIdx = 1;
    if (unitIdx < 0) unitIdx = 2;
    if (priceIdx < 0) priceIdx = 3;
    if (catIdx < 0) catIdx = 4;
    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      if (!cols[nameIdx]) continue;
      // 查找分类 ID
      let catId = null;
      if (cols[catIdx]) {
        const cat = await c.env.DB.prepare('SELECT id FROM categories WHERE name=?').bind(cols[catIdx]).first();
        if (cat) catId = cat.id;
      }
      items.push({
        name: cols[nameIdx], spec: cols[specIdx]||'', unit: cols[unitIdx]||'个',
        reference_price: parseFloat(cols[priceIdx])||0,
        category_id: catId, remark: (remarkIdx >= 0 ? cols[remarkIdx] : '')||'',
      });
    }
    const result = await batchCreateSupplies(c.env.DB, items);
    return c.json({ ok: true, ...result });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 采购单 API ============
app.get('/api/purchases', async (c) => {
  try {
    const { page, limit, date_from, date_to, keyword } = c.req.query();
    const r = await listPurchases(c.env.DB, { page: Number(page)||1, limit: Number(limit)||20, date_from, date_to, keyword });
    return c.json({ ok: true, ...r });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
// 按品名查询所有采购记录（商品查询）— 必须在 :id 路由之前
app.get('/api/purchases/search-by-supply', async (c) => {
  try {
    const name = (c.req.query('name') || '').trim();
    if (!name) return c.json({ ok: true, items: [] });
    const rows = await c.env.DB.prepare(`
      SELECT pi.id, pi.purchase_id, pi.supply_id, pi.quantity, pi.unit_price, pi.subtotal, pi.date,
             s.name as supply_name, s.spec as supply_spec, s.unit, s.reference_price,
             p.order_no, p.purchase_date, p.total_amount, p.supplier_name, p.status
      FROM purchase_items pi
      JOIN supplies s ON pi.supply_id = s.id
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE s.name LIKE ?
      ORDER BY p.purchase_date DESC, p.id DESC, pi.id
    `).bind(`%${name}%`).all();
    return c.json({ ok: true, items: rows.results });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
// 未付款采购单列表（请款时选择）— 必须在 :id 路由之前
app.get('/api/purchases/unpaid', async (c) => {
  try { return c.json({ ok: true, items: await listUnpaidPurchases(c.env.DB) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/purchases/:id', async (c) => {
  try { const p = await getPurchaseDetail(c.env.DB, Number(c.req.param('id'))); if (!p) return c.json({ ok: false, error: '不存在' }, 404);
    return c.json({ ok: true, ...p }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/purchases', async (c) => {
  try { const b = await c.req.json();
    if (!b.items?.length) return c.json({ ok: false, error: '明细不能为空' }, 400);
    const r = await createPurchase(c.env.DB, b);
    return c.json({ ok: true, ...r }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.put('/api/purchases/:id', async (c) => {
  try { const b = await c.req.json(); const r = await updatePurchase(c.env.DB, Number(c.req.param('id')), b);
    if (!r) return c.json({ ok: false, error: '不存在' }, 404); return c.json({ ok: true, ...r }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.delete('/api/purchases/:id', async (c) => {
  try { await deletePurchase(c.env.DB, Number(c.req.param('id'))); return c.json({ ok: true }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/purchases/:id/copy', async (c) => {
  try { const r = await copyPurchase(c.env.DB, Number(c.req.param('id'))); if (!r) return c.json({ ok: false, error: '不存在' }, 404);
    return c.json({ ok: true, ...r }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/purchases/:id/pdf', async (c) => {
  try {
    const p = await getPurchaseDetail(c.env.DB, Number(c.req.param('id')));
    if (!p) return c.json({ ok: false, error: '不存在' }, 404);
    // 返回打印友好 HTML（浏览器原生渲染中文，支持打印为 PDF）
    const items = (p.items || []).map((item, i) => `
      <tr${i % 2 === 0 ? ' class="even"' : ''}>
        <td>${i + 1}</td>
        <td>${item.supply_name || ''}</td>
        <td>${item.supply_spec || ''}</td>
        <td class="num">${item.unit || ''}</td>
        <td class="num">¥${Number(item.unit_price).toFixed(2)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">¥${Number(item.subtotal).toFixed(2)}</td>
      </tr>`).join('');
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${p.order_no || '采购单'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif;padding:40px 50px;color:#333;font-size:14px}
h1{font-size:24px;margin-bottom:6px}
.meta{color:#666;font-size:13px;margin-bottom:20px;display:flex;justify-content:space-between}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{background:#1e40af;color:#fff;padding:8px 6px;text-align:left;font-size:13px}
td{padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:13px}
tr.even td{background:#f8fafc}
.num{text-align:right;font-family:"Courier New",monospace}
.total{font-size:18px;font-weight:bold;color:#dc2626;text-align:right;margin-bottom:30px}
@media print{body{padding:20px 30px}th{background:#1e40af!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>📋 采购单</h1>
<div class="meta">
  <span><strong>单号：</strong>${p.order_no || ''}</span>
  <span><strong>日期：</strong>${p.purchase_date || ''}</span>
</div>
<table><thead><tr>
  <th style="width:40px">序号</th><th>品名</th><th>规格</th><th style="width:50px">单位</th>
  <th style="width:80px">单价</th><th style="width:60px">数量</th><th style="width:90px">小计</th>
</tr></thead><tbody>
${items}
</tbody></table>
<div class="total">合计：¥${Number(p.total_amount).toFixed(2)}</div>
<script>if(new URLSearchParams(location.search).get('print')==='1')setTimeout(()=>window.print(),300)</script>
</body></html>`;
    return c.html(html);
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/purchases/:id/excel', async (c) => {
  try {
    const csv = '\uFEFF' + await exportPurchaseCsv(c.env.DB, Number(c.req.param('id')));
    if (!csv) return c.json({ ok: false, error: '不存在' }, 404);
    c.header('Content-Type', 'text/csv;charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="purchase.csv"');
    return c.body(csv);
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/purchases/export', async (c) => {
  try {
    const { date_from, date_to, keyword } = c.req.query();
    const csv = '\uFEFF' + await exportsPurchasesCsv(c.env.DB, { date_from, date_to, keyword });
    c.header('Content-Type', 'text/csv;charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="purchases.csv"');
    return c.body(csv);
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 分析 API ============
app.get('/api/analytics/summary', async (c) => {
  try { return c.json({ ok: true, ...await getAnalyticsSummary(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/analytics/category-trend', async (c) => {
  try { return c.json({ ok: true, ...await getCategoryTrend(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/analytics/frequency', async (c) => {
  try { return c.json({ ok: true, ...await getFrequency(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/analytics/top-items', async (c) => {
  try { return c.json({ ok: true, ...await getTopItems(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/analytics/price-anomaly', async (c) => {
  try { return c.json({ ok: true, ...await getPriceAnomaly(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/analytics/suggestions', async (c) => {
  try { return c.json({ ok: true, ...await getSuggestions(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/analytics/trend', async (c) => {
  try { return c.json({ ok: true, trend: await getMonthlyTrend(c.env.DB, c.req.query()) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/analytics/report-pdf', async (c) => {
  try {
    const body = await c.req.json();
    const pdf = await generateReportPdf(body, c.env);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'attachment; filename="analytics-report.pdf"');
    return c.body(pdf);
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 请款单 API ============
app.get('/api/payment-requests', async (c) => {
  try {
    const { page, limit, keyword, status, date_from, date_to } = c.req.query();
    const r = await listPaymentRequests(c.env.DB, { page: Number(page)||1, limit: Number(limit)||20, keyword, status, date_from, date_to });
    return c.json({ ok: true, ...r });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.get('/api/payment-requests/:id', async (c) => {
  try { const p = await getPaymentRequest(c.env.DB, Number(c.req.param('id'))); if (!p) return c.json({ ok: false, error: '不存在' }, 404);
    return c.json({ ok: true, ...p }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.post('/api/payment-requests', async (c) => {
  try { const b = await c.req.json(); if (!b.request_date) return c.json({ ok: false, error: '申请日期不能为空' }, 400);
    return c.json(await createPaymentRequest(c.env.DB, b)); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.put('/api/payment-requests/:id', async (c) => {
  try { const b = await c.req.json(); return c.json(await updatePaymentRequest(c.env.DB, Number(c.req.param('id')), b)); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
app.delete('/api/payment-requests/:id', async (c) => {
  try { return c.json(await deletePaymentRequest(c.env.DB, Number(c.req.param('id')))); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 系统重置 — 清除所有数据（支持选择性清除）============
app.post('/api/system/reset', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await resetSystem(c.env.DB, body));
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// 备份列表
app.get('/api/system/backups', async (c) => {
  try { return c.json({ ok: true, items: await listBackups(c.env.DB) }); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// 创建备份
app.post('/api/system/backups', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await createBackup(c.env.DB, body));
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// 恢复备份
app.post('/api/system/backups/:id/restore', async (c) => {
  try {
    return c.json(await restoreBackup(c.env.DB, Number(c.req.param('id'))));
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// 删除备份
app.delete('/api/system/backups/:id', async (c) => {
  try { return c.json(await deleteBackup(c.env.DB, Number(c.req.param('id')))); }
  catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 健康检查 ============
app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// ============ SPA 回退 ============
const SPA_HTML = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>综合管理平台</title>
    <script type="module" crossorigin src="/assets/index-CXVRufmb.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DXKYnGVR.css">
  </head>
  <body><div id="root"></div></body>
</html>`;
app.all('*', async (c) => {
  if (c.req.path.startsWith('/api/')) return c.notFound();
  return c.html(SPA_HTML);
});

export default app;
