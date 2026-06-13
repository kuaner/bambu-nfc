# NFC 写卡流程

本文档描述 `src/lib/nfc.ts` 中 Bambu Lab 耗材标签的写入实现。逻辑对齐 [BambuNfcTool](https://github.com/kuaner/BambuNfcTool) 的 `FormatThenWriteDump` 流程，通过 Chameleon Ultra（`chameleon-ultra.js`）经 Web Bluetooth 操作 MIFARE Classic 1K 卡。

## 前置条件

- **卡类型**：FUID（Fixed UID）卡。UID / CUID 会被打印机拒绝。
- **设备**：Chameleon Ultra，浏览器为 Chrome / Edge 桌面版。
- **数据来源**：`bambu-tags.json` 中的 `dumpBase64`（1024 字节，64 blocks × 16 bytes）。

## 公开 API

```typescript
// 写入标签，返回是否成功；失败时 throw 带 i18n 错误码的 Error
writeTag(ultra, { dumpBase64 }, onProgress): Promise<boolean>

// 进度总步数 = 16（格式化）+ 16（写入）= 32
WRITE_PROGRESS_TOTAL  // 32
BAMBU_SECTOR_COUNT    // 16

// 读取标签（Scan 页使用）
readTag(ultra): Promise<{ parsed, uidHex } | null>
```

`onProgress(current, total, message?)` 在 `writeTag` 开始时报告 `(0, 32)`，每完成一个扇区的格式化报告 `1–16`，每完成一个扇区的写入报告 `17–32`。

错误码形如 `nfc.write_block:5`，由 `src/lib/nfc-errors.ts` 的 `formatNfcError()` 翻译为界面文案。

## 总流程

```
writeTag()
  ├─ cmdChangeDeviceMode(READER)
  ├─ cmdHf14aScan()          // 获取物理 UID
  ├─ deriveKeys(uid)         // HKDF 派生 16×KeyA + 16×KeyB
  ├─ sleep(90ms)             // 密钥派生后等待（对齐安卓 BALANCED 模式）
  ├─ formatToDefaultFf()     // 格式化：trailer → FF，数据块清零，读回校验
  └─ writeDumpWithFf()       // 用 FF 密钥逐块写入 dump
```

每次写入（含重复写同一张卡）都执行完整格式化 + 写入，与安卓行为一致。

## 密钥派生

与 `docs/nfc-tag-format.md` 相同：

| 参数 | 值 |
|------|-----|
| 算法 | HKDF-SHA256 |
| Salt | `9a759cf2c4f7caff222cb9769b41bc96` |
| Input | 卡片物理 UID（4 bytes，来自 `cmdHf14aScan`） |
| Info A | `RFID-A\0` → 16 把 Key A |
| Info B | `RFID-B\0` → 16 把 Key B |

实现上对 UID 做 `new Uint8Array(uid)` 拷贝，避免 `ArrayBuffer` 视图导致派生错误。

## 格式化 `formatToDefaultFf`

对每个 sector `0–15` 串行执行：

### 1. 保存 block 0

读取 block 0 原始内容（用派生 KeyA 或 FF 认证），后续校验确保 UID 制造商块未被格式化破坏。

### 2. 重置 trailer `resetTrailerToDefaultFf`

将扇区 trailer（block 3/7/11/…）改为 FF 密钥，分两个阶段（与 `BambuFormatPlanner.trailerResetStages` 一致）：

| 阶段 | 认证 | 写入 trailer |
|------|------|--------------|
| 1 | 派生 KeyB | KeyA=派生A, Access=`FF078069`, KeyB=派生B |
| 2 | 派生 KeyB | KeyA=FF, Access=`FF078069`, KeyB=FF |

若阶段 1 无法用派生 KeyB 认证，回退到 `tryResetDefaultTrailerWithFf`：用 FF KeyB 认证并直接写入默认 FF trailer。

最后用 FF KeyA + FF KeyB 认证验证。

### 3. 清零数据块

用 FF 密钥认证扇区，将 block 1–2、4–6、…（跳过 block 0 和各 trailer）写为全零。

### 4. 读回校验

再次用 FF 认证，确认 block 0 与保存值一致，其余数据块为全零。

## 写入 `writeDumpWithFf`

对每个 sector `0–15`：

1. FF KeyA + FF KeyB 认证
2. 逐块写入 dump 中对应 16 字节：

| Block | 处理 |
|-------|------|
| 0（UID） | 先 `mf1WriteBlockByKeys`；失败则 `mf1Gen1aWriteBlocks`（CUID/FUID 后门）；仍失败则跳过（FUID 固定 UID 不变） |
| 1–2, 4–62 | `writeBlockWithRetry`，FF 密钥 |
| trailer | 写入 dump 中的 trailer（含 Bambu 派生 KeyA/KeyB） |

## 底层辅助函数

| 函数 | 作用 |
|------|------|
| `authenticate(sector, keysA, keysB)` | 交错尝试 KeyA/KeyB（`INTERLEAVED_BY_INDEX`），读一个数据块验证认证 |
| `readBlockWithRetry(block, keysA, keysB)` | 读块，失败重认证 |
| `writeBlockWithRetry(block, keysA, keysB, data)` | 写块，失败重认证；最多 `BLOCK_RETRY_COUNT+1` 次 |
| `interleavedKeys(keysA, keysB)` | 构造与安卓一致的密钥尝试顺序 |

重试参数（对齐 BambuNfcTool `NfcCompatibilityMode.BALANCED`）：

| 参数 | 值 |
|------|-----|
| `AUTH_RETRY_COUNT` | 3 |
| `BLOCK_RETRY_COUNT` | 1 |
| `WRITE_INTER_BLOCK_DELAY_MS` | 100 |
| `POST_KEY_DERIVATION_DELAY_MS` | 90 |

## 修复功能（Scan → Write）

读取页扫描后：

1. 用 **`uidHex`**（射频 anticollision UID，非 block 0 字节）调用 `tagDb.findDumpByUid()`
2. 库中命中时显示「修复标签」
3. 点击后 `writeStore.selectFromLibrary()` 预选类别/材料/颜色/dump，并跳转写入页

损坏标签的 block 0 可能与物理 UID 不一致，因此修复查找必须用 `uidHex`。

## 与 chameleon-ultra.js 的交互

| SDK 方法 | 用途 |
|----------|------|
| `cmdChangeDeviceMode(READER)` | 切换为读卡器模式 |
| `cmdHf14aScan()` | 扫描 HF 标签，获取 UID |
| `mf1ReadBlockByKeys` | 认证 + 读单块 |
| `mf1WriteBlockByKeys` | 认证 + 写单块（内部选 KeyA/KeyB） |
| `mf1Gen1aWriteBlocks` | Gen1A 后门写 block 0 |
| `mf1ReadSectorByKeys` | 读取流程用（非写入路径） |

**注意**：不要在外层循环调用 `mf1CheckSectorKeys` 做预检。该 API 在蓝牙上很慢，会导致格式化阶段长时间无响应。`mf1WriteBlockByKeys` / `mf1ReadBlockByKeys` 内部已包含密钥匹配。

## 参考

- `docs/nfc-tag-format.md` — Block 布局与密钥派生
- `docs/architecture.md` — 应用整体架构
- [BambuNfcTool `BambuMifareOperator.kt`](https://github.com/kuaner/BambuNfcTool) — Android 参考实现
