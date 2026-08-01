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
