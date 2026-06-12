# 标签数据库 (bambu-tags.json)

由 `scripts/generate-db.js` 扫描 [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library) 生成。

## 重新生成

```bash
# 1. clone 库到项目根目录（临时）
git clone https://github.com/queengooborg/Bambu-Lab-RFID-Library.git

# 2. 运行脚本
node scripts/generate-db.js

# 3. 删除库
rm -rf Bambu-Lab-RFID-Library
```

输出文件 `bambu-tags.json` 约 4.8 MB（含所有 dump 的 base64 编码）。

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

库中的 `.bin` 文件路径格式：`Category/Material/Color/UID_dir/file.bin`，`*-key.bin` 会被跳过。
