// 食堂模块数据库逻辑冒烟测试 — 直接用 miniflare D1 模拟
import { Miniflare } from 'miniflare';
import fs from 'fs';

const schema = fs.readFileSync('./canteen-schema.sql', 'utf-8')
  .split('\n').filter(l => !l.trim().startsWith('--')).join(' ')
  .split(';').map(s => s.trim()).filter(Boolean);

const mf = new Miniflare({
  modules: true,
  script: `export default { fetch() { return new Response('ok'); } }`,
  d1Databases: ['DB'],
});

const db = await mf.getD1Database('DB');
for (const stmt of schema) await db.exec(stmt);
// 食堂采购外键引用办公用品 suppliers 表 — 测试环境补建
await db.exec("CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT DEFAULT '', phone TEXT DEFAULT '', bank_name TEXT DEFAULT '', bank_account TEXT DEFAULT '', is_default INTEGER DEFAULT 0, remark TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','+8 hours')), updated_at TEXT DEFAULT (datetime('now','+8 hours')));");

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name} ${extra}`); }
};

// 动态 import canteen-db
const m = await import('./src/canteen-db.js');

// 1. 分类 CRUD
const cats = await m.listCanteenCategories(db);
assert('初始分类 6 个', cats.length === 6, `实际 ${cats.length}`);
const newCat = await m.createCanteenCategory(db, { name: '海鲜', sort_order: 7 });
assert('新增分类', newCat.id > 0);
assert('分类列表 7 个', (await m.listCanteenCategories(db)).length === 7);
await m.updateCanteenCategory(db, newCat.id, { name: '海鲜水产', sort_order: 7 });
const catCheck = (await m.listCanteenCategories(db)).find(c => c.id === newCat.id);
assert('更新分类名', catCheck.name === '海鲜水产');

// 2. 食材字典
const s1 = await m.createCanteenSupply(db, { name: '五花肉', spec: '新鲜', unit: '斤', reference_price: 15, category_id: 1 });
const s2 = await m.createCanteenSupply(db, { name: '土豆', unit: '斤', reference_price: 2.5, category_id: 3 });
const s3 = await m.createCanteenSupply(db, { name: '大米', spec: '50kg', unit: '袋', reference_price: 120, category_id: 4 });
assert('新增食材 x3', s1.id > 0 && s2.id > 0 && s3.id > 0);
const allSupplies = await m.listCanteenSuppliesAll(db);
assert('食材 all = 3', allSupplies.length === 3, `实际 ${allSupplies.length}`);
assert('食材含分类名', allSupplies[0].category_name === '肉类');
const filtered = await m.listCanteenSupplies(db, { category_id: 3 });
assert('按分类过滤 = 1', filtered.items.length === 1);
const searched = await m.listCanteenSupplies(db, { keyword: '五花' });
assert('按关键词搜索 = 1', searched.items.length === 1);
const delSupply = await m.deleteCanteenSupply(db, s1.id);
assert('删除未引用食材成功', delSupply.ok === true);
assert('删除后 2 个', (await m.listCanteenSuppliesAll(db)).length === 2);

// 3. 费用科目
const expCats = await m.listCanteenExpenseCategories(db);
assert('费用科目初始 6 个', expCats.length === 6, `实际 ${expCats.length}`);

// 4. 采购单（含明细）
const p1 = await m.createCanteenPurchase(db, {
  purchase_date: '2026-08-03',
  supplier_name: '菜市场老王',
  channel: '批发市场',
  actual_pay: 100,
  items: [
    { supply_id: s2.id, quantity: 10, unit_price: 2.5 },   // 土豆 25
    { supply_id: s3.id, quantity: 1, unit_price: 120 },    // 大米 120
  ],
});
assert('创建采购单', p1.ok === true && p1.order_no.startsWith('CT-'), `单号 ${p1.order_no}`);
assert('采购单合计 = 145', p1.total_amount === 145, `实际 ${p1.total_amount}`);
const pDetail = await m.getCanteenPurchaseDetail(db, p1.id);
assert('采购明细 2 行', pDetail.items.length === 2);
assert('明细含品名', pDetail.items[0].supply_name === '土豆');
assert('明细小计正确', pDetail.items[0].subtotal === 25);
const pList = await m.listCanteenPurchases(db, {});
assert('采购单列表 1 条', pList.total === 1);
const pUpdate = await m.updateCanteenPurchase(db, p1.id, { purchase_date: '2026-08-03', items: [{ supply_id: s3.id, quantity: 2, unit_price: 120 }] });
assert('更新采购单', pUpdate.ok === true && pUpdate.total_amount === 240);
assert('更新后明细 1 行', (await m.getCanteenPurchaseDetail(db, p1.id)).items.length === 1);

// 5. 其他费用
const e1 = await m.createCanteenOtherExpense(db, { expense_date: '2026-08-05', category: '水费', amount: 300 });
const e2 = await m.createCanteenOtherExpense(db, { expense_date: '2026-08-10', category: '电费', amount: 800 });
const e3 = await m.createCanteenOtherExpense(db, { expense_date: '2026-07-15', category: '人工费', amount: 5000 });
assert('新增其他费用 x3', e1.id && e2.id && e3.id);
const expList = await m.listCanteenOtherExpenses(db, { month: '2026-08' });
assert('8月费用 2 条', expList.items.length === 2, `实际 ${expList.items.length}`);
const expYear = await m.listCanteenOtherExpenses(db, { year: '2026' });
assert('2026 全年 3 条', expYear.items.length === 3);

// 6. 每日收入
const i1 = await m.saveCanteenDailyIncome(db, { income_date: '2026-08-01', breakfast_count: 50, breakfast_amount: 250, lunch_count: 80, lunch_amount: 800, dinner_count: 60, dinner_amount: 600 });
assert('保存收入', i1.ok === true);
const i1Check = await m.getCanteenDailyIncome(db, i1.id);
assert('自动计算总人次 190', i1Check.total_count === 190, `实际 ${i1Check.total_count}`);
assert('自动计算总收入 1650', i1Check.total_amount === 1650, `实际 ${i1Check.total_amount}`);
const i2 = await m.saveCanteenDailyIncome(db, { income_date: '2026-08-02', lunch_count: 90, lunch_amount: 900 });
const i2Check = await m.getCanteenDailyIncome(db, i2.id);
assert('次日收入 900', i2Check.total_amount === 900);
const i1Upd = await m.saveCanteenDailyIncome(db, { income_date: '2026-08-01', breakfast_count: 60, breakfast_amount: 300, lunch_count: 80, lunch_amount: 800, dinner_count: 60, dinner_amount: 600 });
assert('同日期更新而非新增', i1Upd.updated === true);
assert('更新后总数仍 2 条', (await m.listCanteenDailyIncome(db, { month: '2026-08' })).total === 2);

// 7. 资源占用费
const r1 = await m.createCanteenResourceFee(db, { fee_date: '2026-08-03', meal_type: '午餐', amount: 15, payer: '张三', reason: '已报餐未用餐', handler: '李四' });
const r2 = await m.createCanteenResourceFee(db, { fee_date: '2026-08-05', meal_type: '晚餐', amount: 15, payer: '张三', reason: '未报餐未刷卡', handler: '李四' });
const r3 = await m.createCanteenResourceFee(db, { fee_date: '2026-08-08', meal_type: '午餐', amount: 15, payer: '王五', reason: '未报餐而用餐' });
assert('资源占用费 x3', r1.id && r2.id && r3.id);
const rSum = await m.summaryCanteenResourceFees(db, '2026-08');
assert('汇总 2 人', rSum.summary.length === 2, `实际 ${rSum.summary.length}`);
assert('张三合并 30 元', rSum.summary[0].payer === '张三' && rSum.summary[0].total_amount === 30);
assert('总金额 45', rSum.total === 45, `实际 ${rSum.total}`);

// 8. 每周菜单
const weekDays = [
  { day_of_week: 1, 早餐: '包子 豆浆', 午餐: '红烧肉 清炒时蔬', 晚餐: '番茄鸡蛋面', remark: '' },
  { day_of_week: 2, 早餐: '油条 粥', 午餐: '土豆烧鸡', 晚餐: '', remark: '周二元宵节' },
  { day_of_week: 3, 早餐: '', 午餐: '', 晚餐: '', remark: '' },
];
const menuSave = await m.saveCanteenWeeklyMenu(db, '2026-08-03', weekDays);
assert('保存菜单', menuSave.ok === true);
const menuGet = await m.getCanteenWeeklyMenu(db, '2026-08-03');
assert('菜单 7 天', menuGet.days.length === 7);
assert('周一午餐正确', menuGet.days[0].午餐 === '红烧肉 清炒时蔬');
assert('周二只有早餐午餐', menuGet.days[1].晚餐 === '');
// 复制上周
const weekDaysPrev = [
  { day_of_week: 1, 早餐: '鸡蛋 牛奶', 午餐: '梅菜扣肉', 晚餐: '稀饭', remark: '' },
];
await m.saveCanteenWeeklyMenu(db, '2026-07-27', weekDaysPrev);
const copyR = await m.copyCanteenWeeklyMenu(db, '2026-07-27', '2026-08-03');
assert('复制上周覆盖本周', copyR.ok === true);
const menuAfterCopy = await m.getCanteenWeeklyMenu(db, '2026-08-03');
assert('复制后周一是梅菜扣肉', menuAfterCopy.days[0].午餐 === '梅菜扣肉');

// 9. 菜单模板
const t1 = await m.createCanteenMenuTemplate(db, { name: '标准周菜单', data: { days: weekDays } });
const tList = await m.listCanteenMenuTemplates(db);
assert('模板列表 1 个', tList.length === 1);
await m.deleteCanteenMenuTemplate(db, t1.id);
assert('删除模板', (await m.listCanteenMenuTemplates(db)).length === 0);

// 10. 数据分析
const summary = await m.canteenMonthlySummary(db, '2026-08');
// 收入：8/1 = 1700（更新后 300+800+600），8/2 = 900 → 2600；资源费 45 → 2645
// 支出：采购 240 + 水费300 + 电费800 = 1340
assert('月收入 2645', summary.income.total === 2645, `实际 ${summary.income.total}`);
assert('月餐费收入 2600', summary.income.meal === 2600);
assert('月支出 1340', summary.expense.total === 1340, `实际 ${summary.expense.total}`);
assert('月盈利 1305', summary.profit === 1305, `实际 ${summary.profit}`);

const trend = await m.canteenDailyTrend(db, '2026-08');
// 8/1、8/2 收入 + 8/3 采购 + 8/5、8/10 其他费用 = 5 个有记录的日期
assert('每日趋势 5 天', trend.length === 5, `实际 ${trend.length}`);
assert('8/1 收支正确', trend[0].income === 1700 && trend[0].expense === 0);

const breakdown = await m.canteenExpenseBreakdown(db, '2026-08');
assert('支出构成 食材 240', breakdown.food === 240, `实际 ${breakdown.food}`);
assert('其他费用 2 类', breakdown.others.length === 2);

const share = await m.canteenFoodCategoryShare(db, '2026-08');
// 更新后采购只有大米（粮油 240）
assert('食材分类占比 1 类', share.length === 1, `实际 ${JSON.stringify(share)}`);
assert('粮油 240', share[0].category === '粮油' && share[0].amount === 240);

const top = await m.canteenTopSupplies(db, '2026-08', 5);
assert('Top 食材 1 个', top.length === 1);
assert('大米数量 2', top[0].quantity === 2);

const compare = await m.canteenMonthlyCompare(db, { year: '2026' });
assert('年度对比 2 个月', compare.length === 2, `实际 ${compare.length}`);
const aug = compare.find(r => r.month === '2026-08');
// income 字段只统计餐费收入（资源费 45 单独在 resource 字段）
assert('8月对比餐费收入 2600', aug.income === 2600 && aug.resource === 45, `实际 income=${aug.income} resource=${aug.resource}`);

const sugg = await m.canteenSuggestions(db, '2026-08');
assert('优化建议有内容', Array.isArray(sugg) && sugg.length >= 1, `实际 ${JSON.stringify(sugg)}`);

// 11. CSV 导出
const csv = await m.exportCanteenPurchasesCsv(db, {});
assert('CSV 含表头', csv.includes('采购单号'));
assert('CSV 含大米', csv.includes('大米'));

// 12. 删除逻辑
await m.deleteCanteenResourceFee(db, r1.id);
assert('删除资源占用费', (await m.listCanteenResourceFees(db, { month: '2026-08' })).total === 2);
await m.deleteCanteenOtherExpense(db, e1.id);
assert('删除其他费用', (await m.listCanteenOtherExpenses(db, { month: '2026-08' })).total === 1);
await m.deleteCanteenDailyIncome(db, i1.id);
assert('删除收入', (await m.listCanteenDailyIncome(db, { month: '2026-08' })).total === 1);
await m.deleteCanteenPurchase(db, p1.id);
assert('删除采购单（级联明细）', (await m.listCanteenPurchases(db, {})).total === 0);

// 13. 分类删除保护
await m.deleteCanteenSupply(db, s2.id);
await m.deleteCanteenSupply(db, s3.id);
const delCat = await m.deleteCanteenCategory(db, 1); // 肉类，此时无食材引用
assert('删除无引用分类成功', delCat.ok === true);
await m.createCanteenSupply(db, { name: '排骨', category_id: 2 });
const delCat2 = await m.deleteCanteenCategory(db, 2);
assert('删除被引用分类被拒', delCat2.ok === false);

console.log(`\n===== 结果: ${pass} 通过 / ${fail} 失败 =====`);
await mf.dispose();
process.exit(fail > 0 ? 1 : 0);
