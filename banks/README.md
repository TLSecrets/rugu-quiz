# 题库源文件目录

将 Excel / Word / CSV / JSON 题库放在此目录（可分子目录）。

```bash
npm run build:banks   # 仅扫描生成
npm run build         # 会先扫描再构建前端
```

产物写入 `public/generated/manifest.json`。应用启动时自动同步尚未入库的构建题库。

字段约定见 `public/templates/字段说明.md`。

## 学期归档 `2025-2026-2/`

由 `npm run import:semester` 从各独立刷题站拉取并转换成如故 JSON（题库级标签 `2025-2026-2`）。改源后重新导入再 `build:banks`。
