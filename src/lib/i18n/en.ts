const en: Record<string, string> = {
  // app chrome
  'app.title': 'Bambu NFC',
  'loading': 'Loading...',
  'load_failed': 'Failed to load tag database',

  // connection
  'conn.subtitle': 'Connect your Chameleon Ultra via Bluetooth to get started',
  'conn.button': 'Connect via Bluetooth',
  'conn.connecting': 'Connecting...',
  'conn.failed': 'Connection failed — make sure Bluetooth is on and the device is nearby: ',
  'conn.connected': 'Connected',
  'conn.not_connected': 'Not connected',
  'conn.disconnect': 'Disconnect',
  'conn.last_disconnect': 'Last disconnect: ',

  // tabs
  'tab.scan': 'Scan',
  'tab.write': 'Write',

  // scan page
  'scan.empty_text': 'Place a Bambu NFC tag on the reader<br>and tap the button below',
  'scan.scanning': 'Scanning...',
  'scan.button': 'Read NFC Tag',
  'scan.button_again': 'Scan Again',
  'scan.just_now': 'Just now',
  'scan.minutes_ago': '{0}m ago',
  'scan.not_in_library': 'Not in library',
  'scan.repair': 'Repair Tag',
  'scan.section_basic': 'Basic Info',
  'scan.section_temp': 'Temperatures',
  'scan.section_extra': 'Details',
  'scan.no_tag': 'No tag detected — reposition and retry',
  'scan.read_failed': 'Read failed — try again',

  // write page
  'write.category': 'Category',
  'write.material': 'Material',
  'write.color': 'Color',
  'write.select': '-- Select --',
  'write.select_material': '-- Select material --',
  'write.next': 'Next',
  'write.button': 'Write to Tag',
  'write.empty_text': 'Select a filament above',
  'write.done': 'Done!',
  'write.progress.format': 'Preparing sector {0}/16',
  'write.progress.write': 'Writing sector {0}/16',
  'write.sector_failed': 'Write sector {0} failed',

  // nfc write errors (codes thrown by src/lib/nfc.ts)
  'nfc.format_sector0_auth': 'Format sector 0 auth failed',
  'nfc.format_trailer_reset': 'Format sector {0} trailer reset failed',
  'nfc.format_ff_auth': 'Format sector {0} FF key auth failed',
  'nfc.format_clear_block': 'Format sector {0} clear block {1} failed',
  'nfc.format_verify_read': 'Format sector {0} verify read block {1} failed',
  'nfc.format_verify_block0': 'Format verify failed: block 0 was modified',
  'nfc.format_verify_not_zero': 'Format verify failed: block {0} not zero',
  'nfc.write_ff_auth': 'Write sector {0} FF key auth failed',
  'nfc.write_block': 'Write block {0} failed',
  'nfc.read_failed': 'Read failed — try repositioning the tag',

  // tag info card labels
  'tag.uid': 'UID',
  'tag.uid_copied': 'Copied',
  'tag.weight': 'Weight',
  'tag.length': 'Length',
  'tag.diameter': 'Diameter',
  'tag.hotend': 'Hotend',
  'tag.bed': 'Bed',
  'tag.drying': 'Drying',
  'tag.nozzle': 'Nozzle',
  'tag.type': 'Type',
  'tag.variant': 'Variant',
  'tag.material': 'Material',
  'tag.date': 'Date',
  'tag.tray_uid': 'Tray',
  'tag.not_set': 'Not set',

  // update prompt
  'update.title': 'Update available',
  'update.desc': 'A new version is ready to install',
  'update.button': 'Update',

  // unsupported
  'unsupported.title': 'Unsupported Device',
  'unsupported.desc': 'This tool requires the Web Bluetooth API, which is only available on Chrome / Edge desktop browsers. Mobile browsers are not supported.',

  // disclaimer
  'disclaimer': 'For research purposes only.<br>All tag data and trademarks belong to Bambu Lab.',
}

export default en
