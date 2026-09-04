import os
file_path = r'c:\Users\sebas\Desktop\agenteInteligente\agencia-ia-core\apps\admin-dashboard\app\portal\dashboard\components\P2pMarketplaceView.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

mapping = {
  'Ã¢Â Â±': '⏳',
  'MÃƒÂ³vil': 'Móvil',
  'bÃƒÂ³veda': 'bóveda',
  'ÃƒÂ³rdenes': 'órdenes',
  'Ãƒâ€œrdenes': 'Órdenes',
  'DelegaciÃƒÂ³n': 'Delegación',
  'EscÃƒÂ¡ner': 'Escáner',
  'AcciÃƒÂ³n': 'Acción',
  'VÃƒÂ­a': 'Vía',
  'Ã‚Â¿': '¿',
  'OcurriÃƒÂ³': 'Ocurrió',
  'conexiÃƒÂ³n': 'conexión',
  'CÃƒÂ©dula': 'Cédula',
  'nÃƒÂºmero': 'número',
  'dÃƒÂ­gitos': 'dígitos',
  'escrÃƒÂ­belos': 'escríbelos',
  'aquÃƒÂ­': 'aquí',
  'automÃƒÂ¡ticamente': 'automáticamente',
  'Ã‚Â¡': '¡',
  'MÃƒâ€°TODO': 'MÉTODO',
  'TELÃ‰FONO': 'TELÉFONO',
  'Ã°Å¸Å’Â': '🌎',
  'Ã°Å¸Â Â¦': '🏦',
  'Ã°Å¸â€œÂ±': '📱',
  'Ã°Å¸â€ Âµ': '🔵',
  'Ã°Å¸â€ Â´': '🔴',
  'TransferÃƒÂ­': 'Transferí',
  'MÃ“VIL': 'MÓVIL'
}

for bad, good in mapping.items():
    text = text.replace(bad, good)

# also fix spaces around emojis that might be weird
text = text.replace('🌎  General', '🌎 General')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
