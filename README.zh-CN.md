# Bambu NFC

PWA 工具，通过蓝牙连接 [Chameleon Ultra](https://github.com/RfidResearchGroup/ChameleonUltra) 设备，读写 Bambu Lab 3D 打印机耗材盘上的 MIFARE Classic 1K NFC 标签。

**🔗 在线使用：[kuaner.github.io/bambu-nfc](https://kuaner.github.io/bambu-nfc/)**

> ⚠️ **浏览器兼容性：** 本工具依赖 **Web Bluetooth API**，仅支持 **Chrome / Edge 桌面版**（Windows、macOS、Linux）。Safari、Firefox 及所有手机浏览器均**不支持**。
>
> ⚠️ **NFC 卡类型：** 必须使用 **FUID** 卡。**UID** 和 **CUID** 卡会被打印机识别并拒绝。

## 功能

- 📖 **读取** — 扫描 NFC 标签，解析耗材信息（类型、颜色、温度、直径等），并在标签库中匹配
- ✏️ **写入** — 从标签库选择耗材，写入空白 NFC 标签，支持多 dump 随机切换
- 📱 **PWA** — 安装为桌面应用，离线可用
- 🔒 **密钥派生** — 自动通过 HKDF-SHA256 从 UID 派生读/写密钥

## 技术栈

- [Svelte 5](https://svelte.dev/) + [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [chameleon-ultra.js](https://github.com/taichunmin/chameleon-ultra.js) — 蓝牙通信 SDK
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — Service Worker 自动生成
- Web Bluetooth API + Web Crypto API

## 开发

```bash
npm install
npm run dev      # 启动开发服务器
npm run build    # 生产构建 → dist/
npm run preview  # 预览生产构建
```

### 重新生成标签数据库

```bash
npm run generate-db
```

## 项目结构

```
src/
  main.ts                  # 入口：mount App.svelte
  app.css                  # 全局样式（暗色主题）
  App.svelte               # 根组件
  lib/
    nfc-parser.ts           # NFC 标签 dump 解析器
    nfc.ts                  # 硬件操作：readTag, writeTag, deriveKeys
    i18n/                   # 国际化
  stores/
    bluetooth.svelte.ts     # 蓝牙连接状态
    tag-db.svelte.ts        # 标签数据库加载与查询
    write.svelte.ts         # 写入页级联选择状态
  components/               # UI 组件
public/
  bambu-tags.json           # 标签数据库（4.5MB，运行时 fetch）
scripts/
  generate-db.ts            # 构建脚本：从 RFID 库生成 bambu-tags.json
docs/
  architecture.md           # 应用架构与设计系统
  nfc-tag-format.md         # Block 布局、颜色编码、密钥派生
  tag-db.md                 # 数据库结构与重新生成方法
```

## 致谢

本项目依赖以下开源项目和研究资料：

- [chameleon-ultra.js](https://github.com/taichunmin/chameleon-ultra.js) — Chameleon Ultra 设备的 JavaScript SDK，提供蓝牙通信和 NFC 操作能力
- [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — Bambu Lab RFID 标签 dump 库，本项目的标签数据来源
- [RFID-Tag-Guide](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — Bambu Lab NFC 标签格式分析与密钥派生文档

## 免责声明

本工具仅作为一个便捷的 NFC 标签读取与写入工具，旨在方便用户管理和识别自己的耗材。使用者需自行承担使用本工具的一切风险和责任。作者不对因使用本工具造成的任何直接或间接损失负责，包括但不限于设备损坏、耗材浪费、打印质量问题等。请遵守当地法律法规，合理合法使用。
