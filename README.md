# 📋 办公劳保用品采购与用量分析

基于 **Cloudflare Workers + D1** 构建的轻量全栈 Web 应用，支持办公用品字典管理、采购单快速录入与 PDF 导出、多维度动态图表分析与优化建议。

## 功能模块

| 模块 | 功能 |
|------|------|
| 📖 **用品字典** | 用品 CRUD、模糊搜索、分类筛选、分页 |
| 📝 **采购录入** | 实时检索用品、采购清单编辑、保存采购单、PDF 导出 |
| 📊 **数据分析** | 按月/半年/年度图表（柱状图+折线图+饼图）、优化建议、报告 PDF 导出 |

## 技术栈

- **后端**：Cloudflare Workers + [Hono](https://hono.dev/) 框架
- **数据库**：Cloudflare D1（SQLite 兼容）
- **前端**：原生 HTML/CSS/JS + [Chart.js](https://www.chartjs.org/)
- **PDF 生成**：服务端 pdf-lib（含 CJK 字体支持）+ 客户端 jsPDF 兜底
- **部署**：Wrangler CLI

## 项目结构

```
office-supply-analytics/
├── wrangler.toml          # Cloudflare Workers 配置
├── package.json           # Node.js 依赖
├── schema.sql             # D1 数据库初始化 SQL
├── src/
│   ├── index.js           # Worker 入口 - Hono 路由
│   ├── db.js              # 数据库操作模块
│   └── pdf.js             # 服务端 PDF 生成（pdf-lib）
├── public/
│   ├── index.html         # SPA 入口
│   ├── css/
│   │   └── style.css      # 响应式样式
│   └── js/
│       ├── api.js         # API 客户端
│       ├── app.js         # 应用主逻辑
│       └── pdf-export.js  # 客户端 PDF 导出（jsPDF）
└── README.md
```

## 部署步骤

### 前置条件

1. 安装 [Node.js](https://nodejs.org/) >= 18
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：
   ```bash
   npm install -g wrangler
   ```
3. 登录 Cloudflare：
   ```bash
   wrangler login
   ```

### 1. 安装依赖

```bash
cd office-supply-analytics
npm install
```

### 2. 创建 D1 数据库

```bash
# 创建 D1 数据库
wrangler d1 create office-supply-db
```

创建完成后会输出类似：
```
✅ Successfully created DB 'office-supply-db' in region APAC
Created your new D1 database.
[[d1_databases]]
binding = "DB"
database_name = "office-supply-db"
database_id = "<your-database-id>"
```

### 3. 配置 `wrangler.toml`

将上一步输出的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "office-supply-db"
database_id = "<你的 database_id>"
```

### 4. 初始化数据库表

```bash
# 本地开发环境
wrangler d1 execute office-supply-db --file=./schema.sql

# 远程生产环境
npm run init-db-remote
```

**可选**：插入示例数据（取消 `schema.sql` 底部注释后再执行）。

### 5. 本地开发

```bash
npm run dev
```

启动后访问 `http://localhost:8787` 即可使用。

### 6. 部署到生产

```bash
npm run deploy
```

部署成功后，Wrangler 会输出你的 Worker 访问地址，例如 `https://office-supply-analytics.<your-subdomain>.workers.dev`。

## API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/supplies?keyword=&category=` | 查询用品列表 |
| POST | `/api/supplies` | 新增用品 |
| PUT | `/api/supplies/:id` | 修改用品 |
| DELETE | `/api/supplies/:id` | 删除用品 |
| POST | `/api/purchases` | 保存采购单 |
| GET | `/api/purchases/:id/pdf` | 获取采购单 PDF |
| GET | `/api/analytics?type=&date=&category=` | 查询分析数据 |
| POST | `/api/analytics/report-pdf` | 生成分析报告 PDF |
| GET | `/api/health` | 健康检查 |

### 分析参数说明

- `type`：`monthly` | `half-yearly` | `yearly`
- `date`：
  - 月度：`2026-07`
  - 半年：`2026-01`（上半年）或 `2026-07`（下半年）
  - 年度：`2026`
- `category`：分类名称或 `all`

## 数据库表结构

```sql
-- 用品字典表
supplies (id, name, spec, unit_price, category, remark, created_at, updated_at)

-- 采购主表
purchases (id, purchase_date, total_amount, created_at)

-- 采购明细表
purchase_items (id, purchase_id, supply_id, quantity, unit_price, subtotal)
```

## 注意事项

1. **D1 数据库**需先创建再部署，`database_id` 必须正确配置。
2. **PDF 中文支持**：服务端 PDF 使用 pdf-lib 动态加载 Noto Sans SC 字体（首次生成需要~2 秒下载字体），客户端 jsPDF 兜底方案同样支持中文。
3. **金额字段**统一保留两位小数。
4. **前端资源**托管在 Workers 静态资源目录 `public/` 下，无需额外配置 CDN。
5. **优化建议**基于简单规则引擎生成（趋势对比、阈值判断），无需外部 AI 服务。
