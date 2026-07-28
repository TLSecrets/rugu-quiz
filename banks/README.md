# 题库源文件目录

将 Excel / Word / CSV / JSON 题库放在此目录（可分子目录）。

```bash
npm run build:banks   # 仅扫描生成
npm run build         # 会先扫描再构建前端
```

产物写入 `public/generated/manifest.json`。应用启动时自动同步尚未入库的构建题库。

字段约定见 `public/templates/字段说明.md`。
