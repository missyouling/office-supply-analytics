// =============================================
// 办公劳保用品采购与用量分析 - Worker 入口
// 基于 Hono 框架构建 API
// =============================================
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  listSupplies, getSupply, createSupply, updateSupply, deleteSupply,
  createPurchase, getPurchaseDetail, getAnalytics
} from './db.js';
import { generatePurchasePdf, generateReportPdf } from './pdf.js';

const app = new Hono();

// CORS 中间件（开发环境允许跨域）
app.use('*', cors());

// =============================================
// 静态资源 - SPA 入口（所有非 API 请求返回 index.html）
// =============================================
// Cloudflare Workers with assets 配置会自动处理 public/ 目录的静态文件
// 以下路由仅处理 API 请求，静态资源由 [assets] 配置自动提供

// =============================================
// 用品字典 API
// =============================================

// 查询用品列表
app.get('/api/supplies', async (c) => {
  try {
    const { keyword, category, page, pageSize } = c.req.query();
    const db = c.env.DB;
    const result = await listSupplies(db, {
      keyword,
      category,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50
    });
    return c.json({ ok: true, ...result });
  } catch (e) {
    console.error('GET /api/supplies error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// 新增用品
app.post('/api/supplies', async (c) => {
  try {
    const body = await c.req.json();
    const { name, unit_price, category } = body;

    // 校验必填字段
    if (!name || !name.trim()) return c.json({ ok: false, error: '品名不能为空' }, 400);
    if (unit_price === undefined || unit_price === null || isNaN(Number(unit_price)) || Number(unit_price) < 0) {
      return c.json({ ok: false, error: '单价必须为有效数字且不小于 0' }, 400);
    }
    if (!category || !category.trim()) return c.json({ ok: false, error: '分类不能为空' }, 400);
    if (body.quantity !== undefined && body.quantity !== null) {
      // 兼容旧数据格式
    }

    const db = c.env.DB;
    const result = await createSupply(db, {
      name: name.trim(),
      spec: (body.spec || '').trim(),
      unit_price: Math.round(Number(unit_price) * 100) / 100,
      category: category.trim(),
      remark: (body.remark || '').trim()
    });
    return c.json({ ok: true, ...result });
  } catch (e) {
    console.error('POST /api/supplies error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// 修改用品
app.put('/api/supplies/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: '无效 ID' }, 400);

    const body = await c.req.json();
    const { name, unit_price, category } = body;

    if (!name || !name.trim()) return c.json({ ok: false, error: '品名不能为空' }, 400);
    if (unit_price === undefined || unit_price === null || isNaN(Number(unit_price)) || Number(unit_price) < 0) {
      return c.json({ ok: false, error: '单价必须为有效数字且不小于 0' }, 400);
    }
    if (!category || !category.trim()) return c.json({ ok: false, error: '分类不能为空' }, 400);

    const db = c.env.DB;
    const success = await updateSupply(db, id, {
      name: name.trim(),
      spec: (body.spec || '').trim(),
      unit_price: Math.round(Number(unit_price) * 100) / 100,
      category: category.trim(),
      remark: (body.remark || '').trim()
    });
    if (!success) return c.json({ ok: false, error: '用品不存在或未修改' }, 404);
    return c.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/supplies/:id error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// 删除用品
app.delete('/api/supplies/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: '无效 ID' }, 400);

    const db = c.env.DB;
    const result = await deleteSupply(db, id);
    if (!result.ok) {
      return c.json({ ok: false, error: result.message || '删除失败' }, 400);
    }
    return c.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/supplies/:id error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// =============================================
// 采购记录 API
// =============================================

// 保存采购单
app.post('/api/purchases', async (c) => {
  try {
    const body = await c.req.json();
    const { purchase_date, items } = body;

    if (!purchase_date) return c.json({ ok: false, error: '采购日期不能为空' }, 400);
    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ ok: false, error: '采购明细至少需要一条记录' }, 400);
    }

    // 校验每条明细
    for (const item of items) {
      if (!item.supply_id) return c.json({ ok: false, error: '用品 ID 不能为空' }, 400);
      if (!item.quantity || item.quantity < 1) return c.json({ ok: false, error: '数量必须大于 0' }, 400);
      if (item.unit_price === undefined || item.unit_price < 0) {
        return c.json({ ok: false, error: '单价无效' }, 400);
      }
    }

    const db = c.env.DB;
    const result = await createPurchase(db, {
      purchase_date,
      items: items.map(i => ({
        supply_id: i.supply_id,
        quantity: parseInt(i.quantity),
        unit_price: Math.round(Number(i.unit_price) * 100) / 100
      }))
    });
    return c.json({ ok: true, ...result });
  } catch (e) {
    console.error('POST /api/purchases error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// 获取采购单 PDF
app.get('/api/purchases/:id/pdf', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: '无效 ID' }, 400);

    const db = c.env.DB;
    const purchase = await getPurchaseDetail(db, id);
    if (!purchase) return c.json({ ok: false, error: '采购单不存在' }, 404);

    const pdfBytes = await generatePurchasePdf(purchase, c.env);

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="采购单_${purchase.purchase_date}.pdf"`);
    return c.body(pdfBytes);
  } catch (e) {
    console.error('GET /api/purchases/:id/pdf error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// =============================================
// 统计分析 API
// =============================================

// 查询分析数据
app.get('/api/analytics', async (c) => {
  try {
    const { type, date, category } = c.req.query();
    const t = type || 'monthly';
    const d = date || new Date().toISOString().substring(0, 7);
    const cat = category || 'all';

    const db = c.env.DB;
    const result = await getAnalytics(db, { type: t, date: d, category: cat });
    return c.json({ ok: true, ...result });
  } catch (e) {
    console.error('GET /api/analytics error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// 生成分析报告 PDF
app.post('/api/analytics/report-pdf', async (c) => {
  try {
    const body = await c.req.json();
    const { title, dateRange, charts, suggestions, summaryData } = body;

    if (!charts || !Array.isArray(charts)) {
      return c.json({ ok: false, error: '图表数据不能为空' }, 400);
    }

    const pdfBytes = await generateReportPdf({
      title: title || '办公劳保用品采购分析报告',
      dateRange: dateRange || '',
      charts,
      suggestions: suggestions || [],
      summaryData
    }, c.env);

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="分析报告_${new Date().toISOString().substring(0, 10)}.pdf"`);
    return c.body(pdfBytes);
  } catch (e) {
    console.error('POST /api/analytics/report-pdf error:', e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// =============================================
// 健康检查
// =============================================
app.get('/api/health', (c) => {
  return c.json({ ok: true, time: new Date().toISOString() });
});

export default app;
