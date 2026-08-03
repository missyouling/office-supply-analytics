# 🏢 综合管理平台（office-supply-analytics）

基于 **Cloudflare Workers + D1 + Hono** 构建的多业务模块综合管理 Web 应用，包含办公用品管理与食堂管理两大业务模块，共用同一个 D1 数据库。

## 业务模块

### 🏠 首页（日常事务）
卡片式业务模块入口，展示所有可用模块，点击进入对应管理页面。

### 📋 办公用品模块
办公劳保用品采购与用量分析，功能保持不变：

| 功能 | 说明 |
|------|------|
| 📖 用品字典 | 用品 CRUD、模糊搜索、分类筛选、CSV 导入导出 |
| 📋 采购单 | 批量录入、按品名商品查询、打印预览、Excel 导出 |
| 💰 请款单 | 关联未付款采购单、多级审批字段、金额大写自动生成 |
| 📊 数据分析 | 按月/半年/年度图表、优化建议、报告导出 |
| 🏷️ 分类 / 🏭 供应商 | 基础数据管理（供应商含默认标记、结算账户） |

### 🍚 食堂管理模块（新增）
五大功能页签，覆盖食堂日常运营与成本核算：

| 页签 | 功能 |
|------|------|
| 数据字典 | 食材分类、食材/菜品字典（名称/规格/单位/参考单价）、费用科目、供应商（复用办公用品表） |
| 采购费用 | 食材采购单（批量明细、采购单号自动生成 CT-YYYYMMDD-NN、CSV 导出）+ 其他费用（水电气/人工费，月度汇总） |
| 食堂收入 | 每日刷卡收入（早/中/晚次数与金额，自动计算总人次与总收入）+ 资源占用费收取（同人按月合并、打印预览） |
| 每周菜单 | 周一至周日 × 早/午/晚餐排布、复制上周菜单、打印预览、菜单模板保存与套用 |
| 数据分析 | 月度/半年度/年度三维度：收支总览指标卡、每日收支趋势、支出构成饼图、食材分类占比、采购量 Top5、月度对比、自动优化建议、明细导出 |

## 技术栈

- **后端**：Cloudflare Workers + [Hono](https://hono.dev/) 框架
- **数据库**：Cloudflare D1（SQLite 兼容）
- **前端**：React 18 + TypeScript + Tailwind CSS + shadcn/ui + Recharts（独立前端仓库，构建产物拷入 `public/`）
- **部署**：Wrangler CLI

## 项目结构

```
office-supply-analytics/
├── wrangler.toml          # Cloudflare Workers 配置
├── package.json           # Node.js 依赖
├── schema.sql             # 办公用品模块 D1 初始化 SQL
├── canteen-schema.sql     # 食堂管理模块 D1 迁移 SQL（可独立在已有库上执行）
├── src/
│   ├── index.js           # Worker 入口 - Hono 路由（含 SPA 回退）
│   ├── db.js              # 办公用品数据库操作模块
│   ├── canteen-db.js      # 食堂管理数据库操作模块
│   ├── canteen-routes.js  # 食堂管理 /api/canteen 路由
│   ├── analytics.js       # 办公用品分析模块
│   └── pdf.js             # 服务端 PDF 生成
└── public/
    ├── index.html         # SPA 入口
    └── assets/            # 前端构建产物（从前端仓库拷贝）
```

前端源码位于独立仓库 `office-supply-analytics-frontend`（React 18 + TS + shadcn/ui），构建后将 `dist/` 产物拷贝至本仓库 `public/`。

## 部署步骤

### 前置条件

1. 安装 [Node.js](https://nodejs.org/) >= 18
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：`npm install -g wrangler`
3. 登录 Cloudflare：`wrangler login`

### 1. 安装依赖

```bash
cd office-supply-analytics
npm install
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create office-supply-db
```

创建完成后将输出的 `database_id` 填入 `wrangler.toml`。

### 3. 初始化数据库

```bash
# 办公用品模块表
wrangler d1 execute office-supply-db --file=./schema.sql
# 食堂管理模块表（在已有库上执行）
wrangler d1 execute office-supply-db --file=./canteen-schema.sql
```

### 4. 本地开发 / 部署

```bash
npm run dev        # 本地开发 http://localhost:8787
npm run deploy     # 部署到生产
```

部署成功后访问 Wrangler 输出的 Worker 地址（如 `https://office-supply-analytics.<your-subdomain>.workers.dev`）。

### 前端构建

```bash
cd office-supply-analytics-frontend
npm run build
# 将 dist/ 产物拷贝到后端仓库 public/ 后重新部署
```

## API 概览

### 办公用品模块（/api/*）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/supplies` | 用品字典 CRUD（支持 keyword/category 筛选） |
| POST | `/api/supplies/import` | 用品 CSV 批量导入 |
| GET | `/api/supplies/export` | 用品 CSV 导出 |
| GET/POST/PUT/DELETE | `/api/purchases` | 采购单 CRUD |
| GET | `/api/purchases/:id/pdf` | 采购单打印预览（HTML） |
| GET | `/api/purchases/:id/excel` | 采购单 CSV 导出 |
| GET | `/api/purchases/search-by-supply` | 按品名查询采购明细 |
| GET/POST/PUT/DELETE | `/api/payment-requests` | 请款单 CRUD |
| GET | `/api/analytics/*` | 分析数据（summary/trend/suggestions 等） |
| POST | `/api/analytics/report-pdf` | 分析报告导出 |

### 食堂管理模块（/api/canteen/*）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/canteen/categories` | 食材分类 |
| GET/POST/PUT/DELETE | `/api/canteen/supplies` | 食材字典 |
| GET/POST/PUT/DELETE | `/api/canteen/expense-categories` | 费用科目 |
| GET/POST/PUT/DELETE | `/api/canteen/purchases` | 食堂采购单（主表+明细） |
| GET | `/api/canteen/purchases/export/csv` | 采购明细导出 |
| GET/POST/PUT/DELETE | `/api/canteen/expenses` | 其他费用 |
| GET/POST/DELETE | `/api/canteen/income` | 每日收入（同日期自动更新） |
| GET/POST/PUT/DELETE | `/api/canteen/resource-fees` | 资源占用费 |
| GET | `/api/canteen/resource-fees/summary/:month` | 资源占用费月度合并汇总 |
| GET/POST | `/api/canteen/menus` | 每周菜单（week 参数） |
| POST | `/api/canteen/menus/copy` | 复制上周菜单 |
| GET/POST/DELETE | `/api/canteen/menu-templates` | 菜单模板 |
| GET | `/api/canteen/analytics/*` | 食堂分析（summary/daily-trend/expense-breakdown/food-share/top-supplies/monthly-compare/suggestions） |

## 数据库表结构

### 办公用品模块（schema.sql）

```sql
categories / suppliers / supplies / purchases / purchase_items / payment_requests / backup_logs
```

### 食堂管理模块（canteen-schema.sql）

```sql
canteen_categories        -- 食材分类（肉类/干杂/蔬菜/粮油/调味品/其他）
canteen_supplies          -- 食材/菜品字典
canteen_expense_categories-- 费用科目（水费/电费/燃气费/人工费/设备维护费/其他）
canteen_purchases         -- 食堂采购主表
canteen_purchase_items    -- 食堂采购明细表
canteen_other_expenses    -- 其他费用表（按月）
canteen_daily_income      -- 每日收入表（自动计算总人次/总收入）
canteen_resource_fees     -- 资源占用费表
canteen_weekly_menu       -- 每周菜单表（周起始日期+星期+餐型唯一）
canteen_menu_templates    -- 菜单模板表
```

所有表均使用 `IF NOT EXISTS` 创建，食堂模块迁移脚本可在已有库上直接执行，与办公用品表共存无冲突。

## 注意事项

1. **D1 数据库**需先创建再部署，`database_id` 必须正确配置。
2. **前端资源**托管在 Workers 静态资源目录 `public/` 下，部署时需同步更新 `public/index.html` 与 `src/index.js` 中内联 SPA_HTML 的 asset hash。
3. **金额字段**统一保留两位小数。
4. **优化建议**基于规则引擎生成（趋势对比、阈值判断），无需外部 AI 服务。
5. **采购单号**：办公用品为 `BG-YYYYMMDD-NN`，食堂为 `CT-YYYYMMDD-NN`（按当日递增）。
