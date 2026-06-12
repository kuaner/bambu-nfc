# Bambu NFC

PWA 工具，通过蓝牙连接 Chameleon Ultra 设备，读写 Bambu Lab 3D 打印机耗材盘上的 MIFARE Classic 1K NFC 标签。

仅支持 **Chrome / Edge 桌面版**（依赖 Web Bluetooth API）。

## 技术栈

- **Svelte 5 + Vite + TypeScript**（不用 SvelteKit，独立 PWA 工具无路由/SSR 需求）
- **chameleon-ultra.js** — npm 安装（蓝牙 SDK）
- **Svelte 5 runes** — 状态管理（$state, $derived）
- **vite-plugin-pwa** — Service Worker + manifest 自动生成
- **Web Bluetooth API** + **Web Crypto API**
- **Tailwind CSS v4**

## 开发

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建 → dist/
npm run preview      # 预览生产构建
npm run generate-db  # 重新生成标签数据库
```

## 文件结构

```
src/
  main.ts                    # 入口：mount App.svelte
  app.css                    # 全局样式（暗色主题 + Tailwind）
  App.svelte                 # 根组件
  lib/
    nfc-parser.ts             # NFC 标签 dump 解析器
    nfc.ts                    # 硬件操作：readTag, writeTag, deriveKeys
    i18n/                     # 国际化（中/英）
  stores/
    bluetooth.svelte.ts       # 蓝牙连接状态
    tag-db.svelte.ts          # 标签数据库（直接 import JSON 打包进 JS）
    write.svelte.ts           # 写入页级联选择状态
  components/                 # UI 组件
    TagInfoCard.svelte        # Scan 和 Write 共用耗材详情卡片
    UpdatePrompt.svelte       # PWA 更新提示
    ...
  data/
    bambu-tags.json           # 标签数据库（generate-db 生成，打包进 JS）
scripts/
  generate-db.ts              # 构建脚本：浅克隆 RFID 库 → 生成 JSON → 清理
docs/
  architecture.md             # 应用架构、核心流程、API、设计系统
  nfc-tag-format.md           # Block 布局、颜色编码、密钥派生
  tag-db.md                   # 数据库结构与重新生成方法
```

## 标签数据库

```bash
npm run generate-db
```

自动浅克隆 [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library)，解析所有 dump 生成 `src/data/bambu-tags.json`，完成后自动清理临时目录。

## 发布流程

1. 更新 `package.json` 中的 `version` 字段（版本号同时显示在 TopBar）
2. 提交改动：`git add -A && git commit -m "..." && git push origin main`
3. 打 tag 并推送：`git tag v1.x.x && git push origin v1.x.x`
4. tag push 自动触发 GitHub Actions（`.github/workflows/deploy.yml`）：
   - 浅克隆 RFID 库 → 生成标签数据
   - `npm run build`（带 `GITHUB_PAGES=1` 环境变量设置 base URL）
   - 自动部署到 GitHub Pages
   - 自动创建 GitHub Release（基于 commit history 生成 release notes）

PWA 更新机制：使用 `registerType: 'prompt'`，新版本部署后用户打开 PWA 会看到更新提示，点击即可刷新。

## 参考资料

- [chameleon-ultra.js](https://github.com/taichunmin/chameleon-ultra.js) — 蓝牙 SDK 文档
- [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — 标签 dump 库
- [RFID-Tag-Guide](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — 标签格式与密钥派生文档
