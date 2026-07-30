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
  exportsPurchasesCsv, exportPurchaseCsv, resetSystem,
} from './db.js';
import { generatePurchasePdf, generateReportPdf } from './pdf.js';
import { getAnalyticsSummary, getCategoryTrend, getFrequency, getTopItems, getPriceAnomaly, getSuggestions, getMonthlyTrend } from './analytics.js';

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
// 获取所有单位（去重）— 必须在 :id 路由之前
app.get('/api/supplies/units', async (c) => {
  try {
    const rows = await c.env.DB.prepare('SELECT DISTINCT unit FROM supplies WHERE unit IS NOT NULL AND unit!=\'\' ORDER BY unit').all();
    const units = rows.results.map(r => r.unit);
    return c.json({ ok: true, units });
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
.footer{color:#999;font-size:11px;border-top:1px solid #ddd;padding-top:12px;display:flex;justify-content:space-between}
@media print{body{padding:20px 30px}th{background:#1e40af!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>📋 采购单</h1>
<div class="meta">
  <span><strong>单号：</strong>${p.order_no || ''}</span>
  <span><strong>日期：</strong>${p.purchase_date || ''}</span>
  <span><strong>状态：</strong>${p.status === 'completed' ? '已完成' : p.status === 'draft' ? '草稿' : p.status || ''}</span>
</div>
<table><thead><tr>
  <th style="width:40px">序号</th><th>品名</th><th>规格</th><th style="width:50px">单位</th>
  <th style="width:80px">单价</th><th style="width:60px">数量</th><th style="width:90px">小计</th>
</tr></thead><tbody>
${items}
</tbody></table>
<div class="total">合计：¥${Number(p.total_amount).toFixed(2)}</div>
<div class="footer">
  <span>制单日期：${p.purchase_date || ''}</span>
  <span>采购单号：${p.order_no || ''}</span>
</div>
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

// ============ 健康检查 ============
app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// 系统重置 — 清除所有数据
app.post('/api/system/reset', async (c) => {
  try {
    return c.json(await resetSystem(c.env.DB));
  } catch (e) { return c.json({ ok: false, error: e.message }, 500); }
});

// ============ SPA 回退 ============
const SPA_HTML = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>办公劳保用品管理系统</title>
    <script type="module" crossorigin src="/assets/index-wIwPeTQ2.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-N3uRaR-f.css">
  </head>
  <body><div id="root"></div></body>
</html>`;
app.all('*', async (c) => {
  if (c.req.path.startsWith('/api/')) return c.notFound();
  return c.html(SPA_HTML);
});

export default app;
