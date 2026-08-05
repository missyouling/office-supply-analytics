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
| 采购费用 | 食材采购单（批量明细、采购单号自动生成 CT-YYYYMMDD-NN、按月份筛选、CSV 导出）+ 其他费用（水电气/人工费，月度汇总） |
| 食堂收入 | 每日刷卡收入（支持刷卡机「消费流水明细」/「个人餐别统计」CSV 导入，按文件日期自动分天、按消费时间自动分早/午/晚，GBK/UTF-8 自适应）+ 资源占用费收取（同人按月合并、打印预览）+ 充值记录（滚动加载） |
| 每周菜单 | 周一至周日 × 早/午/晚餐排布、复制上周菜单、打印预览、菜单模板保存与套用 |
| 数据分析 | 月度/半年度/年度三维度：收支总览指标卡、每日收支趋势、支出构成饼图、食材分类占比、采购量 Top5、月度对比（人均成本口径与月度明细一致）、自动优化建议、明细导出 |

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

## 部署步骤（Cloudflare Workers + D1 详细指南）

### 前置条件

1. 安装 [Node.js](https://nodejs.org/) >= 18（建议 20 LTS）
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：

```bash
npm install -g wrangler
```

### 1. 登录 Cloudflare 账号

```bash
wrangler login
```

浏览器会弹出 Cloudflare 授权页面，点击「Allow」完成登录。也可以在 Cloudflare 控制台（`dash.cloudflare.com` → 右上角头像 → My Profile → API Tokens → Create Token）创建 API Token 后使用：

```bash
# 需要 Worker Scripts:Edit + D1:Edit 权限（用你自己的 Token）
export CLOUDFLARE_API_TOKEN=你的Token
```

### 2. 安装依赖

```bash
cd office-supply-analytics
npm install
```

### 3. 创建 D1 数据库

```bash
wrangler d1 create office-supply-db
```

命令会输出一段 JSON，其中 `database_id`（形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）填入 `wrangler.toml` 的 `[[d1_databases]]` 配置中。

### 4. 初始化数据库（重要：生产库必须加 --remote）

```bash
# 办公用品模块表
wrangler d1 execute office-supply-db --remote --file=./schema.sql
# 食堂管理模块表（在已有库上执行，含食材/充值/退费/菜单等表）
wrangler d1 execute office-supply-db --remote --file=./canteen-schema.sql
```

> ⚠️ `--remote` 参数表示操作 Cloudflare 线上数据库；**不加该参数只会操作本地模拟库**，线上会报 `no such table`。

### 5. 本地开发 / 部署

```bash
npm run dev        # 本地开发 http://localhost:8787（本地需先 wrangler d1 migrations 或使用 --local 数据库）
npm run deploy     # 部署到生产
```

部署成功后访问 Wrangler 输出的 Worker 地址（如 `https://office-supply-analytics.<your-subdomain>.workers.dev`）。

### 6. 绑定自定义域名（可选）

Cloudflare 控制台 → Workers & Pages → 选择你的 Worker → Settings → Domains & Routes → Add → 输入已托管在 Cloudflare 的域名（如 `bg.example.com`），按提示完成 DNS 配置后即可通过自定义域名访问。

### 7. 设置访问密码（可选）

部署后可设置环境变量开启密码验证，保护整个应用：

```bash
# 设置访问密码（未设置时默认密码 2153）
wrangler secret put PASS
```

- 开启后访问任何页面都会先跳转登录页，密码通过服务端 `/api/auth/verify` 校验（前端不暴露密码明文）。
- 登录状态保存在 `sessionStorage`（同标签页保持，关闭标签页失效）。
- 顶部导航右侧提供「退出」按钮（二次确认），点击后清除登录状态返回登录页。
- 登录页背景为随机壁纸，右上角有 GitHub 仓库链接图标。

### 8. 更新部署（前端改版后）

```bash
# 在前端仓库构建
cd office-supply-analytics-frontend
npm run build
# 将 dist/ 产物拷入后端仓库 public/ 后重新部署
cd ../office-supply-analytics
rm -rf public/assets && cp -r ../office-supply-analytics-frontend/dist/assets public/
cp ../office-supply-analytics-frontend/dist/index.html public/index.html
# 同步 src/index.js 中的资源 hash（asset 文件名）
npm run deploy
```

> 前端仓库构建后 `dist/assets/` 中的 JS/CSS 文件名带 hash（如 `index-xxxxx.js`），部署前必须同步更新 `public/index.html` 与 `src/index.js` 内联的引用，否则会加载到旧资源。

## API 概览

### 通用（/api/*）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/config` | 查询是否启用密码验证 |
| POST | `/api/auth/verify` | 校验访问密码（body: `{ password }`） |

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
| GET | `/api/canteen/income` | 每日收入（同日期自动更新；CSV 导入按文件日期分组） |
| GET/POST/PUT/DELETE | `/api/canteen/income` | 每日收入 CRUD |
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
6. **人均成本口径**：每日人均成本 =（采购支出 + 分摊支出 − 早餐收入 − 资源占用费收入）÷ 当日消费人次（午+晚）；月度/半年度/年度的人均均为「每日人均成本的平均」，各维度数值一致。
7. **刷卡数据导入**：识别「消费流水明细」（含消费时间/金额，金额 1 元=早餐、其余按时间分午/晚）与「个人餐别统计」两种格式；文件无日期列时按当日写入并提示。
