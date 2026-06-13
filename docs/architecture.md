# 应用架构

## 页面层级

单页应用，两个 tab 页面 + 两个全屏覆盖层：

```
z-index 300  #loading         初始加载（加载 bambu-tags.json）
z-index 200  #connectOverlay  蓝牙连接引导
             #pageScan        Scan 页面（读标签）
             #pageWrite       Write 页面（写标签）
z-index 100  .tabbar          底部导航栏（fixed）
```

页面切换：`switchTab(tab)` 控制 `.page.active` class。

## 启动流程

1. `DOMContentLoaded` → `loadTagDB()` fetch `bambu-tags.json`
2. 加载完成 → 隐藏 loading → 填充 Category 下拉 → 显示 connect overlay
3. 用户点击连接 → `doConnect()` 通过 Web Bluetooth 连接 Chameleon Ultra
4. 连接成功 → 隐藏 overlay，进入 Scan 页面

## Scan（读标签）

`readTag()` 流程：
1. 切换设备到 READER 模式 → `cmdHf14aScan()` 扫描卡片
2. 优先尝试 gen1a 读全部 64 blocks
3. gen1a 失败 → 用 HKDF 派生密钥逐 sector 认证读取（见 `docs/nfc-tag-format.md`）
4. `NFCParser.parseTagDump()` 解析 1024 字节 dump
5. 渲染 info card，`findInLibrary()` 在数据库中匹配已知标签

## Write（写标签）

详见 **`docs/nfc-write.md`**。

`writeTag()` 概要：
1. 三级级联选择：Category → Material → Color
2. 选择颜色后随机选一个 dump（多种时可 🎲 切换）
3. 写入时执行 `FormatThenWriteDump`：先格式化为 FF 密钥，再用 FF 密钥写入 dump
4. 进度 32 步：格式化 16 扇区 + 写入 16 扇区
5. Scan 页「修复标签」：按物理 UID 查库，跳转写入页并预选 dump

## 关键全局变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `ultra` | ChameleonUltra \| null | 设备实例 |
| `isConnected` | boolean | 连接状态 |
| `tagDB` | Object \| null | bambu-tags.json 数据 |
| `selectedDump` | Object \| null | 当前选中的 dump |
| `selectedColorKey` | string \| null | 当前选中的颜色名 |

## nfc-parser.js API

浏览器全局 `window.BambuNFCParser`，Node.js `module.exports`。

```js
BambuNFCParser.parseTagDump(Uint8Array)  // → 解析结果对象 | null
BambuNFCParser.rgbaBytesToCSS(Uint8Array) // → "rgb(r,g,b)"
BambuNFCParser.rgbaBytesToHex(Uint8Array) // → "#rrggbb"
BambuNFCParser.EXPECTED_DUMP_SIZE         // → 1024
```

`parseTagDump` 返回结构：
```js
{
  uid, variantId, materialId, filamentType, detailedFilamentType,
  color: { count, primary: { hex, css }, secondary: { hex, css } | null },
  spoolWeight, filamentDiameter, filamentLength, spoolWidth, nozzleDiameter,
  temperatures: { dryingTemp, dryingTime, bedTempType, bedTemp, hotendMax, hotendMin },
  xCamInfo, trayUid, productionDate, shortProductionDate
}
```

## CSS 设计系统

暗色主题，变量定义在 `:root`：

| 变量 | 值 | 用途 |
|------|---|------|
| `--bg` | `#0f1117` | 页面背景 |
| `--card` | `#1a1d27` | 卡片背景 |
| `--border` | `#2a2d3a` | 边框 |
| `--text` | `#e0e0e6` | 主文字 |
| `--dim` | `#6b7084` | 次要文字 |
| `--accent` | `#4f8cff` | 主题蓝 |
| `--accent2` | `#6fa0ff` | Hover 蓝 |
| `--green` | `#34d399` | 成功/连接状态 |
| `--yellow` | `#fbbf24` | 警告 |
| `--red` | `#f87171` | 错误/断开状态 |
| `--safe-b` | `env(safe-area-inset-bottom)` | iOS 安全区域 |
| `--tab-h` | `56px` | 底部 tab 栏高度 |

## Service Worker 策略

- **Network-first**：所有请求优先走网络，失败回退缓存
- 缓存版本 `CACHE_NAME`（当前 `bambu-nfc-v2`），部署更新时需升版本号
- `install` → `skipWaiting()`，`activate` → `clients.claim()` + 清旧缓存

## 外部依赖

| 依赖 | CDN |
|------|-----|
| chameleon-ultra.js | `cdn.jsdelivr.net/npm/chameleon-ultra.js@0/dist/index.global.js` |
| WebbleAdapter | `cdn.jsdelivr.net/npm/chameleon-ultra.js@0/dist/plugin/WebbleAdapter.global.js` |

SDK 全局对象：`window.ChameleonUltraJS` → `{ ChameleonUltra, DeviceMode, Buffer }`
