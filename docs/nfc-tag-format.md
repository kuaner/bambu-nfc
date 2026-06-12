# NFC 标签格式参考

MIFARE Classic 1K，1024 bytes（64 blocks × 16 bytes）。来源：[RFID-Tag-Guide](https://github.com/queengooborg/Bambu-Lab-RFID-Library)

## Block 布局

| Block | 内容 | 备注 |
|-------|------|------|
| 0 | UID + 厂商数据 | 只读 |
| 1 | Variant ID (8B) + Material ID (8B) | ASCII |
| 2 | Filament Type 短名 | ASCII |
| 3 | Sector 0 trailer | Key A + Access Bits + Key B |
| 4 | 详细 Filament Type | ASCII |
| 5 | 颜色 RGBA (4B) + 重量 (2B, LE) + 直径 (4B, LE float) | — |
| 6 | 温度信息（见下表） | — |
| 8 | X-Cam Info (12B) + 喷嘴直径 (4B, LE float) | — |
| 9 | Tray UID | — |
| 10 | Spool Width (2B, LE, 单位 0.01mm) | — |
| 12 | 生产日期时间 | ASCII |
| 13 | 短生产日期 | ASCII |
| 14 | Filament Length (offset 4, 2B, LE, 单位 m) | — |
| 16 | 双色信息：format id (2B) + color count (2B) + 第二色 ABGR (4B) | format id = 0x0002 表示有双色 |
| 17 | 未知 | — |
| 18–39 | 空 | — |
| 40–63 | RSA-2048 签名 | 只读 |

### Block 6 温度字段

| Offset | 长度 | 内容 |
|--------|------|------|
| 0 | 2B LE | 干燥温度 °C |
| 2 | 2B LE | 干燥时间 h |
| 4 | 2B LE | 热床温度类型 |
| 6 | 2B LE | 热床温度 °C |
| 8 | 2B LE | 热端最高温度 °C |
| 10 | 2B LE | 烯端最低温度 °C |

## 数据格式

- 所有整数：**Little Endian**
- 浮点数：**IEEE 754 Little Endian**
- Sector trailer（每 sector 的 block 3）：Access Bits 固定 `87 87 87 69`，Key B 固定 `00 00 00 00 00 00`

## 颜色编码

- **Block 5 主色**：RGBA 顺序（R, G, B, A 各 1 byte）
- **Block 16 第二色**：ABGR 顺序（A, B, G, R 各 1 byte），需逆序后提取 RGB

## 密钥派生

使用 HKDF-SHA256：

- **Salt**：`0x9a759cf2c4f7caff222cb9769b41bc96`
- **Input**：卡片 UID（4 bytes）
- **Info A**：`RFID-A\0` → 派生 96 bytes → 切为 16 把 6-byte Key A（对应 sector 0-15）
- **Info B**：`RFID-B\0` → 派生 96 bytes → 切为 16 把 6-byte Key B（备选）
- 每个扇区先尝试 Key A，失败再尝试 Key B
