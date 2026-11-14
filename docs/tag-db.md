# 标签数据库 (bambu-tags.json)

由 `scripts/generate-db.ts` 扫描 [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library) 并按 Bambu 官方命名重归类后生成。

## 重新生成

```bash
npm run generate-db
```

脚本自动浅克隆 RFID 库到临时目录，加载官方颜色库，生成 `src/data/bambu-tags.json` 后清理临时目录。

输出文件约 6 MB（含所有 dump 的 base64 编码）。

## 颜色名与归类规则

归类以**标签自身数据**为准，而非上游目录布局——上游目录常有不规范命名（如 `PLA Silk Multi-Color`、`PETG CF`），直接采用会得到错误的颜色/材料标签。

- **材料（Material）**：取 dump block 4 的 detailed filament type（如 `PLA Silk+`、`PETG HF`），与 Bambu Studio 的 `fila_type` 一致。
- **分类（Category）**：由 material/block 2 短码映射到八大分类，仅在标签字段缺失时回退到目录。
- **颜色名（Color）**：用 dump 颜色 hex（block 5 主色 + block 16 辅色）在 [Bambu Studio 官方颜色库](https://github.com/bambulab/BambuStudio/blob/master/resources/profiles/BBL/filament/filaments_color_codes.json) 中精确反查（hex + material 双重匹配），取官方英文名。单色只匹配 `单色` 条目，多色只匹配 `渐变色`/`多拼色`。查不到时回退目录原名。
- **颜色值（colorHex/colorCSS）**：始终来自 dump 字节，与归类无关。
- **中文名（displayNameZh）**：精确匹配命中官方库时一并取出 `fila_color_name.zh`；未命中则为 `null`（UI 回退只显示英文名）。当前覆盖率约 96%。

这套逻辑移植自 NickWaterton 的 `colordb.py` / `fix_library.py`（见 [PR #79/#80/#81](https://github.com/queengooborg/Bambu-Lab-RFID-Library/pull/81)），但只做重归类与改名，不删除/隔离任何 dump，确保 UID 识别覆盖率不下降。

官方颜色库快照保存在 `scripts/bambu-color-db.json`（随仓库提交），每次 `generate-db` 运行时尝试从网络刷新，失败则使用本地快照。

## JSON 结构

三级级联：Category → Material → Color

```json
{
  "generated": "ISO 8601 时间戳",
  "totalDumps": 1234,
  "categories": {
    "PLA": {
      "materials": {
        "PLA Basic": {
          "displayName": "PLA Basic",
          "filamentType": "PLA",
          "colors": {
            "White": {
              "displayName": "White",
              "displayNameZh": "白色",
              "colorCSS": "rgb(255,255,255)",
              "colorHex": "#ffffff",
              "secondaryColorCSS": null,
              "dumps": [
                {
                  "uid": "0123ABCD",
                  "spoolWeight": 1000,
                  "filamentLength": 330,
                  "diameter": 1.75,
                  "nozzleDiameter": 0.4,
                  "temps": {
                    "drying": 55,
                    "dryingTime": 8,
                    "bed": 35,
                    "hotendMin": 190,
                    "hotendMax": 220
                  },
                  "dumpBase64": "..."
                }
              ]
            }
          }
        }
      }
    }
  }
}
```

## 有效 Category

`PLA` `PETG` `ABS` `ASA` `PA` `PC` `TPU` `Support Material`

库中的 `.bin` 文件路径格式：`Category/Material/Color/UID_dir/file.bin`，`*-key.bin` 会被跳过。路径仅作为回退依据，最终归类以标签数据 + 官方颜色库为准。

## App 共享库自动合并

上游库不包含所有市售颜色。发布流水线在每次生成数据库时自动从 Android App 的
在线共享库补充上游缺失的颜色/材料组合，仓库中不保存任何快照文件。

处理流程（`scripts/generate-db.ts` + `scripts/lib/app-shared.ts`）：

1. 扫描上游 `Bambu-Lab-RFID-Library`，按原有规则生成分类；
2. 用 `APP_SHARED_INSTALL_ID` + `APP_SHARED_TAG_PACKAGE_KEY` 调用
   `/api/public/tags/can-download` 和 `/api/public/tags/download/v2`；
3. 在内存中解密 M0RF 包（PBKDF2-HMAC-SHA256 + AES-256-GCM），解压 `<UID>.txt`；
4. 用与上游相同的解析、颜色识别和排序逻辑处理 App dump；
5. 只补充 `(material, color)` 上游没有的组合，已有组合整组跳过；
6. App dump 的 UID 已存在于上游时也跳过，避免同一张卡同时挂在两个颜色名下。

凭据放在 GitHub Actions Secrets：

- `APP_SHARED_INSTALL_ID`
- `APP_SHARED_TAG_PACKAGE_KEY`

缺少凭据、网络失败或接口拒绝时，构建会跳过 App 数据并继续发布；设置
`APP_SHARED_STRICT=1` 可改为直接失败。

### 本地调试

已有解密后的 zip 时：

```bash
APP_SHARED_ZIP=/path/to/shared_library.zip npm run generate-db
```

需要完整下载 + 解密时：

```bash
APP_SHARED_INSTALL_ID=... APP_SHARED_TAG_PACKAGE_KEY=... npm run generate-db
```
