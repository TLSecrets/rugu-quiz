# 如故题库

专业刷题网站：纯前端 SPA，部署到 **GitHub Pages** 即可使用。题库、收藏、笔记与设置保存在浏览器本机（IndexedDB），不依赖后端账号。

## 功能一览

- 刷题：单选 / 多选 / 判断 / 填空 / 简答；顺序/随机；多题库与领域筛选；选项乱序；题号导航；自动下一题；即时/手动看答案；字号调节；浅色/深色/跟随系统；移动端适配
- **模拟考试（不限时）**：按题型 / 领域组卷、空白试卷 PDF、交卷评分、简答自评、错题入库
- 题库：Excel / Word / CSV / JSON 导入导出（选项 A–H、题型可空自动推断、预览可改）；仓库 `banks/` 构建扫描自动收录；领域分类与搜索筛选
- 学习：搜索（含领域）、收藏、笔记、**持久错题本**（专项训练 / 筛选移出 / PDF）
- 排版：Markdown + `$...$` / `$$...$$`（KaTeX）；PDF 导出（当前题 / 错题 / 整库）
- 可选：AI 辅助导入（OpenAI 兼容，默认 DeepSeek；用户自配 Key，浏览器直连，不经第三方）

## 明确不做

- 账号登录 / 注册
- 考试计时 / 正式考场限时
- Docker / 自建后端
- 多用户云同步
- 单文件离线 HTML 包（成本较高，暂缓）

## 本地开发

```bash
npm install
npm run dev
```

常用脚本：

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发（会先扫描 `banks/`） |
| `npm run build` | 生成模板 + 扫描题库 + 构建 |
| `npm run build:banks` | 仅扫描 `banks/` → `public/generated/` |
| `npm run gen:templates` | 重生成导入模板 |
| `npm run preview` | 预览生产构建 |

## GitHub Pages 部署

1. 推送代码到 GitHub（建议默认分支 `main`）
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**
3. 推送或手动运行 workflow：**Deploy to GitHub Pages**
4. 等待 Actions 成功后打开 Pages 地址

### `base` 路径

默认 `vite.config.ts` 使用 `base: './'`，配合 **Hash 路由**，多数 project site（`https://<user>.github.io/<repo>/`）可直接使用。

若静态资源 404，在仓库设置 **Actions Variables** 增加：

- 名称：`VITE_BASE`
- 值：`/<你的仓库名>/`（首尾斜杠保留）

用户站（`https://<user>.github.io/`）可设 `VITE_BASE=/`。

### 安全提示

- **不要**把 API Key 写进仓库或 Actions Secrets（本应用只在浏览器本地使用 Key）
- 勿提交含隐私的真实题库到公开 `banks/`（可用 `banks/examples` 示例）

## 题库放置（`banks/`）

将 `.xlsx` / `.xls` / `.csv` / `.json` / `.docx` 放入 `banks/`（可分子目录），构建时生成 `public/generated/manifest.json`。应用启动时会自动同步尚未入库的构建题库。

字段约定见站点内可下载的 `templates/字段说明.md`，或本地 `public/templates/字段说明.md`。

| 字段 | 说明 |
|------|------|
| 题型 | 单选 / 多选 / 判断 / 填空 / 简答；**可空（自动推断）** |
| 题干 | 支持 Markdown 与 LaTeX |
| 选项A–H | 选择题、判断题 |
| 答案 | 单选 `A`；多选 `A,C`；判断 `正确/错误`；填空多空用 `\|` |
| 解析 / 图片 / 标签 / 领域 | 可选；多图用 `;`，答案图前缀 `答案:`；领域为空可用首个标签兜底 |

导入模板下载：打开站点 → **导入导出**。

## AI Key（OpenAI 兼容）

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建 API Key（或其他兼容服务）  
2. 站点 **设置** 中填写 Key（可选改 Base URL / 模型，默认 `deepseek-chat`）  
3. 到 **导入导出 → AI 辅助导入** 粘贴杂乱文本并转换  

费用由你的 API 账户结算。若浏览器报 CORS，需本机自行放行（产品不设中转代理）。

## 技术栈

Vue 3 · Vite · TypeScript · Pinia · Vue Router（hash）· Dexie · KaTeX · markdown-it · SheetJS · mammoth · jsPDF

## 版本阶段

Phase 1–8 与功能补全 **Phase A–E** 已完成（错题本、练习配置、模拟考试、导入增强、设置/主题/字号打磨）。单文件离线包暂缓。
