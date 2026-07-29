// =============================================
// 数据库操作辅助模块
// =============================================

/**
 * 查询用品列表（支持模糊搜索和分类筛选）
 */
export async function listSupplies(db, { keyword, category, page = 1, pageSize = 50 }) {
  const offset = (page - 1) * pageSize;
  let where = [];
  let params = [];

  if (keyword) {
    where.push('(s.name LIKE ? OR s.spec LIKE ?)');
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }
  if (category && category !== '全部' && category !== 'all') {
    where.push('s.category = ?');
    params.push(category);
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM supplies s ${whereClause}`
  ).bind(...params).first();

  const items = await db.prepare(
    `SELECT s.* FROM supplies s ${whereClause} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  return { items: items.results, total: countResult.total, page, pageSize };
}

/**
 * 获取单个用品
 */
export async function getSupply(db, id) {
  return await db.prepare('SELECT * FROM supplies WHERE id = ?').bind(id).first();
}

/**
 * 新增用品
 */
export async function createSupply(db, { name, spec, unit_price, category, remark }) {
  const result = await db.prepare(
    `INSERT INTO supplies (name, spec, unit_price, category, remark) VALUES (?, ?, ?, ?, ?)`
  ).bind(name, spec || '', unit_price, category, remark || '').run();
  return { id: result.meta.last_row_id };
}

/**
 * 修改用品
 */
export async function updateSupply(db, id, { name, spec, unit_price, category, remark }) {
  const result = await db.prepare(
    `UPDATE supplies SET name = ?, spec = ?, unit_price = ?, category = ?, remark = ?, updated_at = datetime('now', '+8 hours') WHERE id = ?`
  ).bind(name, spec || '', unit_price, category, remark || '', id).run();
  return result.meta.changes > 0;
}

/**
 * 删除用品（检查是否有关联采购记录）
 */
export async function deleteSupply(db, id) {
  // 检查是否有关联的采购明细
  const refCount = await db.prepare(
    'SELECT COUNT(*) as cnt FROM purchase_items WHERE supply_id = ?'
  ).bind(id).first();
  if (refCount.cnt > 0) {
    return { ok: false, message: `该用品已被 ${refCount.cnt} 条采购记录引用，无法删除` };
  }
  const result = await db.prepare('DELETE FROM supplies WHERE id = ?').bind(id).run();
  return { ok: result.meta.changes > 0 };
}

/**
 * 保存采购单（含明细）
 */
export async function createPurchase(db, { purchase_date, items }) {
  // 计算总金额
  let totalAmount = 0;
  for (const item of items) {
    totalAmount += item.unit_price * item.quantity;
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  // 插入采购主表
  const purchaseResult = await db.prepare(
    'INSERT INTO purchases (purchase_date, total_amount) VALUES (?, ?)'
  ).bind(purchase_date, totalAmount).run();
  const purchaseId = purchaseResult.meta.last_row_id;

  // 逐条插入采购明细
  const stmt = db.prepare(
    'INSERT INTO purchase_items (purchase_id, supply_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)'
  );
  for (const item of items) {
    const subtotal = Math.round(item.unit_price * item.quantity * 100) / 100;
    await stmt.bind(purchaseId, item.supply_id, item.quantity, item.unit_price, subtotal).run();
  }

  return { id: purchaseId, total_amount: totalAmount };
}

/**
 * 获取采购单详情（含明细）
 */
export async function getPurchaseDetail(db, id) {
  const purchase = await db.prepare('SELECT * FROM purchases WHERE id = ?').bind(id).first();
  if (!purchase) return null;

  const items = await db.prepare(
    `SELECT pi.*, s.name as supply_name, s.spec as supply_spec, s.category
     FROM purchase_items pi
     JOIN supplies s ON pi.supply_id = s.id
     WHERE pi.purchase_id = ?`
  ).bind(id).all();

  return { ...purchase, items: items.results };
}

/**
 * 获取分析数据（月度/半年/年度聚合）
 * type: 'monthly' | 'half-yearly' | 'yearly'
 * date: 示例 '2026-07' (月度), '2026' (年度), '2026-01' (半年，上半年传01，下半年传07)
 * category: 分类名称或 'all'
 */
export async function getAnalytics(db, { type, date, category }) {
  let dateFilter, groupFormat, orderFormat;

  if (type === 'yearly') {
    dateFilter = `p.purchase_date LIKE '${date}%'`;
    groupFormat = `substr(p.purchase_date, 1, 7)`;  // 按月分组
    orderFormat = `p.purchase_date`;
  } else if (type === 'half-yearly') {
    // date 格式: '2026-01' 或 '2026-07'
    const year = date.substring(0, 4);
    const month = date.substring(5, 7);
    const startMonth = month === '01' ? '01' : '07';
    const endMonth = month === '01' ? '06' : '12';
    dateFilter = `p.purchase_date >= '${year}-${startMonth}-01' AND p.purchase_date <= '${year}-${endMonth}-31'`;
    groupFormat = `substr(p.purchase_date, 1, 7)`;
    orderFormat = `p.purchase_date`;
  } else {
    // monthly
    dateFilter = `p.purchase_date LIKE '${date}%'`;
    groupFormat = `p.purchase_date`;
    orderFormat = `p.purchase_date`;
  }

  const catFilter = (category && category !== '全部' && category !== 'all')
    ? `AND s.category = '${category.replace(/'/g, "''")}'`
    : '';

  // 1. 各分类用量/金额聚合
  const categoryStats = await db.prepare(
    `SELECT s.category,
            COUNT(pi.id) as item_count,
            SUM(pi.quantity) as total_quantity,
            SUM(pi.subtotal) as total_amount
     FROM purchase_items pi
     JOIN purchases p ON pi.purchase_id = p.id
     JOIN supplies s ON pi.supply_id = s.id
     WHERE ${dateFilter} ${catFilter}
     GROUP BY s.category
     ORDER BY total_amount DESC`
  ).all();

  // 2. 采购频次趋势（按时间点统计采购单数）
  const frequencyData = await db.prepare(
    `SELECT ${groupFormat} as period,
            COUNT(DISTINCT p.id) as purchase_count,
            COUNT(pi.id) as item_count,
            SUM(pi.subtotal) as total_amount
     FROM purchases p
     LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
     LEFT JOIN supplies s ON pi.supply_id = s.id
     WHERE ${dateFilter} ${catFilter}
     GROUP BY period
     ORDER BY period`
  ).all();

  // 3. 分类成本占比
  const categoryPie = await db.prepare(
    `SELECT s.category,
            ROUND(SUM(pi.subtotal) * 100.0 / NULLIF((SELECT SUM(subtotal) FROM purchase_items pi2
               JOIN purchases p2 ON pi2.purchase_id = p2.id
               JOIN supplies s2 ON pi2.supply_id = s2.id
               WHERE ${dateFilter} ${catFilter.replace("s.", "s2.")}), 0), 2) as percentage,
            SUM(pi.subtotal) as total_amount
     FROM purchase_items pi
     JOIN purchases p ON pi.purchase_id = p.id
     JOIN supplies s ON pi.supply_id = s.id
     WHERE ${dateFilter} ${catFilter}
     GROUP BY s.category
     ORDER BY total_amount DESC`
  ).all();

  // 4. 生成优化建议
  const suggestions = await generateSuggestions(db, { type, date });

  return {
    categoryStats: categoryStats.results,
    frequencyData: frequencyData.results,
    categoryPie: categoryPie.results,
    suggestions
  };
}

/**
 * 生成优化建议（基于阈值和趋势的简单规则）
 */
async function generateSuggestions(db, { type, date }) {
  const suggestions = [];

  try {
    // 获取当前期和前一期各分类的总量（用于对比）
    let currentStart, currentEnd, prevStart, prevEnd;

    if (type === 'yearly') {
      const year = parseInt(date);
      currentStart = `${year}-01-01`;
      currentEnd = `${year}-12-31`;
      prevStart = `${year - 1}-01-01`;
      prevEnd = `${year - 1}-12-31`;
    } else if (type === 'half-yearly') {
      const year = date.substring(0, 4);
      const month = date.substring(5, 7);
      const isH2 = month === '07';
      const prevStartMonth = isH2 ? '01' : '07';
      const prevEndMonth = isH2 ? '06' : '12';
      const prevYear = isH2 ? year : String(parseInt(year) - 1);
      const prevYearStartMonth = isH2 ? '01' : '01';
      const prevYearEndMonth = isH2 ? '06' : '06';
      currentStart = `${year}-${month}-01`;
      currentEnd = isH2 ? `${year}-12-31` : `${year}-06-30`;
      prevStart = `${prevYear}-${prevStartMonth}-01`;
      prevEnd = `${prevYear}-${prevEndMonth}-30`;
    } else {
      // monthly - 对比上一月
      const [year, month] = date.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
      
      // 本月
      const daysInMonth = new Date(year, month, 0).getDate();
      currentStart = `${date}-01`;
      currentEnd = `${date}-${daysInMonth}`;
      
      // 上月
      const prevDays = new Date(prevYear, prevDate.getMonth() + 1, 0).getDate();
      prevStart = `${prevYear}-${prevMonth}-01`;
      prevEnd = `${prevYear}-${prevMonth}-${prevDays}`;
    }

    // 规则1：按分类对比当前和前一时期的采购金额变化
    const currentCats = await db.prepare(
      `SELECT s.category, SUM(pi.subtotal) as total_amount, SUM(pi.quantity) as total_qty
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       JOIN supplies s ON pi.supply_id = s.id
       WHERE p.purchase_date >= ? AND p.purchase_date <= ?
       GROUP BY s.category`
    ).bind(currentStart, currentEnd).all();

    const prevCats = await db.prepare(
      `SELECT s.category, SUM(pi.subtotal) as total_amount, SUM(pi.quantity) as total_qty
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       JOIN supplies s ON pi.supply_id = s.id
       WHERE p.purchase_date >= ? AND p.purchase_date <= ?
       GROUP BY s.category`
    ).bind(prevStart, prevEnd).all();

    // 构造对比 map
    const prevMap = {};
    for (const c of prevCats.results) {
      prevMap[c.category] = { amount: c.total_amount || 0, qty: c.total_qty || 0 };
    }

    for (const c of currentCats.results) {
      const prev = prevMap[c.category];
      if (prev && prev.amount > 0) {
        const growth = ((c.total_amount - prev.amount) / prev.amount) * 100;
        if (growth > 20) {
          suggestions.push({
            type: 'warning',
            title: `${c.category} 采购金额显著增长`,
            content: `该类用品较上期增长 ${growth.toFixed(1)}%，建议核实原因并考虑批量采购降本。`
          });
        } else if (growth < -30) {
          suggestions.push({
            type: 'info',
            title: `${c.category} 采购金额大幅下降`,
            content: `该类用品较上期减少 ${Math.abs(growth).toFixed(1)}%，库存是否充足？建议关注。`
          });
        }
      }
    }

    // 规则2：检查近半年未采购的用品
    if (type !== 'monthly') {
      const sixMonthsAgo = type === 'yearly'
        ? `${parseInt(date) - 1}-07-01`
        : date.includes('01')
          ? `${date.substring(0, 4)}-07-01`
          : `${parseInt(date.substring(0, 4)) + 1}-01-01`;

      const unusedItems = await db.prepare(
        `SELECT s.name, s.category, s.id
         FROM supplies s
         WHERE s.id NOT IN (
           SELECT DISTINCT pi.supply_id FROM purchase_items pi
           JOIN purchases p ON pi.purchase_id = p.id
           WHERE p.purchase_date >= ?
         )
         ORDER BY s.category`
      ).bind(sixMonthsAgo).all();

      if (unusedItems.results.length > 0) {
        const names = unusedItems.results.slice(0, 5).map(i => i.name).join('、');
        suggestions.push({
          type: 'info',
          title: '存在长期未采购用品',
          content: `以下${unusedItems.results.length}种用品近半年未采购：${names}${unusedItems.results.length > 5 ? '等' : ''}，建议评估是否仍有需求或考虑淘汰。`
        });
      }
    }

    // 规则3：检查采购频次过高的分类
    const purchaseCountByCat = await db.prepare(
      `SELECT s.category, COUNT(DISTINCT p.id) as purchase_count, SUM(pi.quantity) as total_qty
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       JOIN supplies s ON pi.supply_id = s.id
       WHERE p.purchase_date >= ? AND p.purchase_date <= ?
       GROUP BY s.category
       HAVING purchase_count >= 3 AND total_qty < 10`
    ).bind(currentStart, currentEnd).all();

    for (const c of purchaseCountByCat.results) {
      suggestions.push({
        type: 'suggestion',
        title: `${c.category} 采购频次过高`,
        content: `该类用品采购了 ${c.purchase_count} 次但总量仅 ${c.total_qty}，建议合并采购以降低物流成本。`
      });
    }

    // 规则4：空的
    if (currentCats.results.length === 0) {
      suggestions.push({
        type: 'info',
        title: '暂无采购数据',
        content: '所选时间范围内没有采购记录，请添加采购数据后再查看分析建议。'
      });
    }

    // 如果没有生成任何规则建议，给一条通用提示
    if (suggestions.length === 0 && currentCats.results.length > 0) {
      suggestions.push({
        type: 'success',
        title: '整体状况良好',
        content: '各分类用量和频次处于正常范围，建议继续保持当前采购节奏。'
      });
    }

  } catch (e) {
    suggestions.push({
      type: 'info',
      title: '分析提示',
      content: '数据分析完成，详细优化建议将在有更多数据后自动生成。'
    });
  }

  return suggestions;
}
