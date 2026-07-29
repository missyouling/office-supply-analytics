// =============================================
// 分析数据聚合 — 供 analytics API 使用
// =============================================

function getPeriodFilter(type, date) {
  if (type === 'yearly') {
    const year = date;
    return { current: `p.purchase_date LIKE '${year}%'`, prev: `p.purchase_date LIKE '${parseInt(year)-1}%'` };
  } else if (type === 'half-yearly') {
    const [y, h] = date.split('-');
    const hN = parseInt(h);
    const startM = hN <= 6 ? '01' : '07';
    const endM = hN <= 6 ? '06' : '12';
    return {
      current: `p.purchase_date >= '${y}-${startM}-01' AND p.purchase_date <= '${y}-${endM}-31'`,
      prev: hN <= 6
        ? `p.purchase_date >= '${parseInt(y)-1}-07-01' AND p.purchase_date <= '${parseInt(y)-1}-12-31'`
        : `p.purchase_date >= '${y}-01-01' AND p.purchase_date <= '${y}-06-30'`
    };
  }
  // monthly
  const days = new Date(parseInt(date), parseInt(date.split('-')[1]), 0).getDate();
  const [y, m] = date.split('-').map(Number);
  const prev = new Date(y, m-2, 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth()+1).padStart(2,'0');
  const pd = new Date(py, prev.getMonth()+1, 0).getDate();
  return {
    current: `p.purchase_date >= '${date}-01' AND p.purchase_date <= '${date}-${days}'`,
    prev: `p.purchase_date >= '${py}-${pm}-01' AND p.purchase_date <= '${py}-${pm}-${pd}'`
  };
}

export async function getAnalyticsSummary(db, query) {
  const { type='monthly', date } = query;
  const d = date || new Date().toISOString().substring(0,7);
  const pf = getPeriodFilter(type, d);

  const cur = await db.prepare(`
    SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as cnt
    FROM purchases p WHERE ${pf.current}
  `).first();
  const prv = await db.prepare(`
    SELECT COALESCE(SUM(total_amount),0) as amount, COUNT(*) as cnt
    FROM purchases p WHERE ${pf.prev}
  `).first();

  const curAmt = cur.amount || 0;
  const prvAmt = prv.amount || 0;
  const curCnt = cur.cnt || 0;
  const prvCnt = prv.cnt || 0;
  const yoy = prvAmt > 0 ? Math.round(((curAmt - prvAmt)/prvAmt)*10000)/100 : 0;

  return {
    totalAmount: curAmt,
    totalPurchases: curCnt,
    avgOrderAmount: curCnt > 0 ? Math.round(curAmt/curCnt*100)/100 : 0,
    yoyChange: yoy,
    prevTotal: prvAmt,
    currentTotal: curAmt,
    changePercent: yoy,
  };
}

export async function getCategoryTrend(db, query) {
  const { type='monthly', date } = query;
  const d = date || new Date().toISOString().substring(0,7);
  const pf = getPeriodFilter(type, d);
  const data = await db.prepare(`
    SELECT c.name as category, SUM(pi.subtotal) as amount, SUM(pi.quantity) as quantity
    FROM purchase_items pi JOIN purchases p ON pi.purchase_id=p.id
    JOIN supplies s ON pi.supply_id=s.id JOIN categories c ON s.category_id=c.id
    WHERE ${pf.current} GROUP BY c.name ORDER BY amount DESC
  `).all();
  return { categoryStats: data.results };
}

export async function getFrequency(db, query) {
  const { type='monthly', date } = query;
  const d = date || new Date().toISOString().substring(0,7);
  const pf = getPeriodFilter(type, d);
  const data = await db.prepare(`
    SELECT p.purchase_date as period, COUNT(*) as count, SUM(p.total_amount) as total_amount
    FROM purchases p WHERE ${pf.current} GROUP BY period ORDER BY period
  `).all();
  return { frequencyData: data.results };
}

export async function getTopItems(db, query) {
  const { type='monthly', date, limit=10 } = query;
  const d = date || new Date().toISOString().substring(0,7);
  const pf = getPeriodFilter(type, d);
  const data = await db.prepare(`
    SELECT s.id, s.name, s.spec, c.name as category, SUM(pi.quantity) as total_qty,
           SUM(pi.subtotal) as total_amount, AVG(pi.unit_price) as avg_price
    FROM purchase_items pi JOIN purchases p ON pi.purchase_id=p.id
    JOIN supplies s ON pi.supply_id=s.id LEFT JOIN categories c ON s.category_id=c.id
    WHERE ${pf.current} GROUP BY s.id ORDER BY total_amount DESC LIMIT ?
  `).bind(Number(limit)).all();
  return { topSupplies: data.results };
}

export async function getPriceAnomaly(db, query) {
  const { type='monthly', date } = query;
  const d = date || new Date().toISOString().substring(0,7);
  const pf = getPeriodFilter(type, d);
  // 价格异常：同一用品在多次采购中单价波动超过10%
  const data = await db.prepare(`
    SELECT s.name, s.spec, c.name as category, pi.unit_price, pi.quantity, p.purchase_date, pi.supply_id
    FROM purchase_items pi JOIN purchases p ON pi.purchase_id=p.id
    JOIN supplies s ON pi.supply_id=s.id LEFT JOIN categories c ON s.category_id=c.id
    WHERE ${pf.current} ORDER BY pi.supply_id, p.purchase_date
  `).all();

  // 在内存中计算价差
  const map = {};
  for (const r of data.results) {
    if (!map[r.supply_id]) map[r.supply_id] = { name: r.name, spec: r.spec, category: r.category, prices: [], dates: [] };
    map[r.supply_id].prices.push(r.unit_price);
    map[r.supply_id].dates.push(r.purchase_date);
  }
  const anomalies = [];
  for (const [sid, v] of Object.entries(map)) {
    if (v.prices.length < 2) continue;
    const last = v.prices[v.prices.length-1];
    const prev = v.prices[v.prices.length-2];
    const chg = prev > 0 ? Math.round(((last-prev)/prev)*10000)/100 : 0;
    if (Math.abs(chg) > 5) {
      anomalies.push({
        supplyId: Number(sid), supplyName: v.name, spec: v.spec, category: v.category,
        lastUnitPrice: last, prevUnitPrice: prev, changePercent: chg,
        lastPurchaseDate: v.dates[v.dates.length-1], prevPurchaseDate: v.dates[v.dates.length-2],
      });
    }
  }
  return { priceAnomalies: anomalies };
}

export async function getSuggestions(db, query) {
  const { type='monthly', date } = query;
  const d = date || new Date().toISOString().substring(0,7);
  const pf = getPeriodFilter(type, d);

  const suggestions = [];

  // 规则1: 分类金额增长 > 30%
  const cats = await db.prepare(`
    SELECT c.name, SUM(pi.subtotal) as amt
    FROM purchase_items pi JOIN purchases p ON pi.purchase_id=p.id
    JOIN supplies s ON pi.supply_id=s.id JOIN categories c ON s.category_id=c.id
    WHERE ${pf.current} GROUP BY c.id ORDER BY amt DESC
  `).all();

  for (const cat of cats.results) {
    if (cat.amt > 5000) {
      suggestions.push({
        type: 'warning', title: `${cat.name} 费用偏高`,
        description: `该分类本期采购金额 ¥${Number(cat.amt).toFixed(0)}，占总费用比例较高，建议核查实际需求。`,
        action: '审查采购计划，考虑批量议价'
      });
    }
  }

  // 规则2: 碎片化采购 — 多个月小额采购
  const count = await db.prepare(`SELECT COUNT(*) as c FROM purchases p WHERE ${pf.current} AND p.total_amount < 100`).first();
  if (count.c >= 3) {
    suggestions.push({
      type: 'optimize', title: '小额采购频次偏高',
      description: `本期有 ${count.c} 笔采购单金额低于 ¥100，存在碎片化现象，增加物流和管理成本。`,
      action: '合并小额采购为月度集中采购'
    });
  }

  // 规则3: 价格波动
  const priceData = await db.prepare(`
    SELECT s.name, pi.unit_price, p.purchase_date, pi.supply_id
    FROM purchase_items pi JOIN purchases p ON pi.purchase_id=p.id
    JOIN supplies s ON pi.supply_id=s.id
    WHERE ${pf.current} ORDER BY pi.supply_id, p.purchase_date
  `).all();
  const pmap = {};
  for (const r of priceData.results) {
    if (!pmap[r.supply_id]) pmap[r.supply_id] = [];
    pmap[r.supply_id].push(r.unit_price);
  }
  for (const [sid, prices] of Object.entries(pmap)) {
    if (prices.length >= 2) {
      const last = prices[prices.length-1];
      const prev = prices[prices.length-2];
      const chg = prev > 0 ? ((last-prev)/prev)*100 : 0;
      if (chg > 15) {
        suggestions.push({
          type: 'warning', title: `${priceData.results.find(r=>r.supply_id===Number(sid))?.name||''} 价格上涨`,
          description: `单价涨幅 ${chg.toFixed(0)}%，建议关注价格走势并寻找替代供应商。`,
          action: '询价对比，锁定长期协议价'
        });
      }
    }
  }

  // 规则4: 闲置用品
  const activeIds = new Set(priceData.results.map(r => r.supply_id));
  const all = await db.prepare(`SELECT COUNT(*) as c FROM supplies WHERE status='active'`).first();
  const totalActive = all.c || 0;
  const unusedCount = totalActive - activeIds.size;
  if (unusedCount > 0) {
    suggestions.push({
      type: 'info', title: `${unusedCount} 种用品本期未采购`,
      description: '这些用品可能库存充足或已不再需要，建议评估。',
      action: '审查用品字典，移除或停用闲置用品'
    });
  }

  // 规则5: 默认健康
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'success', title: '整体采购状况良好',
      description: '各项指标正常，建议继续保持当前采购策略。',
      action: '定期回顾数据，持续优化'
    });
  }

  return { suggestions };
}
