const fields = [
  { fieldName: 'Numero de cuenta', fieldValue: '01720608796084627949' },
  { fieldName: 'Email Address', fieldValue: 'aanzalone11@gmail.com' },
  { fieldName: 'Account type', fieldValue: 'corriente' },
  { fieldName: 'nombre completo del titular de la cuenta', fieldValue: 'ANZALONE FICI ANGELO ANTONIO' },
  { fieldName: 'Cédula', fieldValue: '20648499' }
];

let chatDetectedAccount = null;
let chatDetectedCedula = null;
let accountHolder = null;

for (const f of fields) {
    const n = (f.fieldName || '').toLowerCase();
    const nNorm = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Priorizamos nombre
    if (nNorm.includes('name') || nNorm.includes('nombre') || nNorm.includes('titular') || nNorm.includes('holder')) {
        accountHolder = f.fieldValue;
    }
    // Luego cuenta, excluyendo tipo de cuenta
    else if ((nNorm.includes('account') || nNorm.includes('cuenta') || nNorm.includes('cta')) && !nNorm.includes('type') && !nNorm.includes('tipo')) {
        chatDetectedAccount = f.fieldValue;
    }
    // Luego cedula / ID
    else if (nNorm.includes('cedula') || nNorm.includes('identity') || nNorm.includes('id number') || nNorm.includes('id ') || nNorm === 'id') {
        chatDetectedCedula = f.fieldValue;
    }
}

console.log({chatDetectedAccount, chatDetectedCedula, accountHolder});
