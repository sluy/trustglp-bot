const fs = require('fs');
const file = 'c:/Users/sebas/Desktop/agenteInteligente/agencia-ia-core/apps/admin-dashboard/app/portal/dashboard/components/P2pMarketplaceView.tsx';
let data = fs.readFileSync(file, 'utf8');

const mapping = {
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
  'Ã°Å¸Å’Â ': '🌎',
  'Ã°Å¸Â Â¦': '🏦',
  'Ã°Å¸â€œÂ±': '📱',
  'Ã°Å¸â€ Âµ': '🔵',
  'Ã°Å¸â€ Â´': '🔴',
  'TransferÃƒÂ­': 'Transferí',
  'MÃ“VIL': 'MÓVIL'
};

for (const [bad, good] of Object.entries(mapping)) {
  data = data.split(bad).join(good);
}

fs.writeFileSync(file, data, 'utf8');
console.log('Mojibake fixed!');
