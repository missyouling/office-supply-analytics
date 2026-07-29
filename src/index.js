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
  exportsPurchasesCsv, exportPurchaseCsv,
} from './db.js';
import { generatePurchasePdf, generateReportPdf } from './pdf.js';
import { getAnalyticsSummary, getCategoryTrend, getFrequency, getTopItems, getPriceAnomaly, getSuggestions } from './analytics.js';

const app = new Hono();
app.use('*', cors());

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
    const body = await c.req.text();
    const lines = body.split('\n').filter(Boolean);
    if (lines.length < 2) return c.json({ ok: false, error: '数据不足（至少含表头和一行数据）' }, 400);
    // 解析 CSV: 品名,规格,单位,参考单价,安全库存,分类(名称),备注
    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      if (!cols[0]) continue;
      // 查找分类 ID
      let catId = null;
      if (cols[5]) {
        const cat = await c.env.DB.prepare('SELECT id FROM categories WHERE name=?').bind(cols[5]).first();
        if (cat) catId = cat.id;
      }
      items.push({
        name: cols[0], spec: cols[1]||'', unit: cols[2]||'个',
        reference_price: parseFloat(cols[3])||0, safety_stock: parseInt(cols[4])||0,
        category_id: catId, remark: cols[6]||'',
      });
    }
    const result = await batchCreateSupplies(c.env.DB, items);
    return c.json({ ok: true, ...result });
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});
// 导出 CSV
app.get('/api/supplies/export', async (c) => {
  try {
    const { keyword, category_id, status } = c.req.query();
    const csv = '\uFEFF' + await exportSuppliesCsv(c.env.DB, { keyword, category_id, status });
    c.header('Content-Type', 'text/csv;charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="supplies.csv"');
    return c.body(csv);
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
    const pdf = await generatePurchasePdf(p, c.env);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="${p.order_no}.pdf"`);
    return c.body(pdf);
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
app.post('/api/analytics/report-pdf', async (c) => {
  try {
    const body = await c.req.json();
    const pdf = await generateReportPdf(body, c.env);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'attachment; filename="analytics-report.pdf"');
    return c.body(pdf);
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ 健康检查 ============
app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// ============ SPA 回退 ============
const SPA_HTML = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>办公劳保用品管理系统</title>
    <script type="module" crossorigin src="/assets/index-BxjpJ2Wp.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-D_1zzoEp.css">
  </head>
  <body><div id="root"></div></body>
</html>`;
app.all('*', async (c) => {
  if (c.req.path.startsWith('/api/')) return c.notFound();
  return c.html(SPA_HTML);
});

export default app;
