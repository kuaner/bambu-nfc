# Bambu NFC

PWA 工具，通过蓝牙连接 Chameleon Ultra 设备，读写 Bambu Lab 3D 打印机耗材盘上的 MIFARE Classic 1K NFC 标签。

## 技术栈

- **Svelte 5 + Vite**（不用 SvelteKit，独立 PWA 工具无路由/SSR 需求）
- **chameleon-ultra.js** — npm 安装（蓝牙 SDK）
- **Svelte 5 runes** — 状态管理（$state, $derived）
- **vite-plugin-pwa** — 自动生成 Service Worker 和 manifest
- **Web Bluetooth API** + **Web Crypto API**

## 开发

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建 → dist/
npm run preview  # 预览生产构建
```

## 文件结构

```
index.html                # Vite 入口（极简）
package.json
vite.config.js            # Svelte + PWA 插件配置
public/
  bambu-tags.json         # 4.8MB 静态数据（不打包，运行时 fetch）
  icon.svg / icon-*.png   # 应用图标
src/
  main.js                 # 入口：mount App.svelte
  app.css                 # 全局 CSS（暗色主题变量 + 组件样式）
  App.svelte              # 根组件：overlay 层 + tab 切换
  lib/
    nfc-parser.js         # NFC 标签 dump 解析器（ESM + CJS 兼容）
    nfc.js                # 硬件操作：readTag, writeTag, deriveKeys
  stores/
    bluetooth.svelte.js   # 蓝牙连接状态
    tag-db.svelte.js      # 标签数据库加载与查询
    write.svelte.js       # 写入页级联选择状态
  components/
    LoadingOverlay.svelte
    ConnectOverlay.svelte
    TopBar.svelte
    TabBar.svelte
    ScanPage.svelte
    WritePage.svelte
    TagInfoCard.svelte    # Scan 和 Write 共用
    ColorDropdown.svelte
    ColorSwatch.svelte
    ProgressBar.svelte
    EmptyState.svelte
    Spinner.svelte
scripts/
  generate-db.js          # 构建脚本：从 RFID 库生成 bambu-tags.json
docs/
  architecture.md         # 应用架构、核心流程、API、设计系统
  nfc-tag-format.md       # Block 布局、颜色编码、密钥派生
  tag-db.md               # 数据库结构与重新生成方法
```

## 构建

重新生成标签数据库：
```bash
git clone https://github.com/queengooborg/Bambu-Lab-RFID-Library.git
node scripts/generate-db.js
rm -rf Bambu-Lab-RFID-Library
```

## 参考资料

- [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — 标签 dump 库
- [RFID-Tag-Guide](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — 标签格式与密钥派生文档
