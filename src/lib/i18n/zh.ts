const zh: Record<string, string> = {
  // app chrome
  'app.title': 'Bambu NFC',
  'loading': '加载中...',
  'load_failed': '标签数据库加载失败',

  // connection
  'conn.subtitle': '通过蓝牙连接 Chameleon Ultra 设备开始使用',
  'conn.button': '连接蓝牙',
  'conn.connecting': '连接中...',
  'conn.failed': '连接失败：',
  'conn.connected': '已连接',
  'conn.not_connected': '未连接',
  'conn.disconnect': '断开连接',

  // tabs
  'tab.scan': '读取',
  'tab.write': '写入',

  // scan page
  'scan.empty_text': '将 Bambu NFC 标签放在读卡器上<br>然后点击下方按钮',
  'scan.scanning': '扫描中...',
  'scan.button': '读取 NFC 标签',
  'scan.not_in_library': '未在库中找到',
  'scan.section_basic': '基本信息',
  'scan.section_temp': '温度参数',
  'scan.section_extra': '其他信息',

  // write page
  'write.category': '类别',
  'write.material': '材料',
  'write.color': '颜色',
  'write.select': '-- 请选择 --',
  'write.select_material': '-- 请先选择材料 --',
  'write.shuffle': '换一个',
  'write.button': '写入标签 (FUID)',
  'write.empty_text': '请在上方选择耗材',
  'write.done': '完成！',
  'write.sector_failed': '写入扇区 {0} 失败',

  // tag info card labels
  'tag.uid': 'UID',
  'tag.weight': '重量',
  'tag.length': '长度',
  'tag.diameter': '直径',
  'tag.hotend': '热端',
  'tag.bed': '热床',
  'tag.drying': '烘干',
  'tag.nozzle': '喷嘴',
  'tag.type': '类型',
  'tag.variant': '变体',
  'tag.material': '材料',
  'tag.date': '日期',
  'tag.tray_uid': 'Tray',
  'tag.not_set': '未设置',

  // update prompt
  'update.title': '新版本可用',
  'update.desc': '点击更新以获取最新功能',
  'update.button': '更新',

  // disclaimer
  'disclaimer': '仅供研究使用<br>所有标签数据及商标版权归拓竹（Bambu Lab）所有',
}

export default zh
