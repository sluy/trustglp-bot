const fs = require('fs');

function updateAdmin() {
  const file = 'apps/admin-dashboard/app/admin/p2p/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Change early return
  const oldCode = `if (hasData) {
                            return (
                              <>
                                {r?.identityNo && (`;
  
  const newCode = `return (
                              <>
                                {hasData && (
                                  <>
                                {r?.identityNo && (`;
  content = content.replace(oldCode, newCode);

  const oldCode2 = `</>
                            );
                          }

                          // Sin datos: mostrar caja de acción
                          return (
                            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-center mb-4">
                              <p className="text-xs text-rose-400 font-bold mb-1">Cédula o Cuenta faltante</p>`;
  const newCode2 = `</>
                                )}

                          {/* Siempre mostrar el boton de accion */}
                            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-center mb-4 mt-2">
                              <p className="text-xs text-rose-400 font-bold mb-1">Solicitar / Corregir Datos en Chat</p>`;
  
  content = content.replace(oldCode2, newCode2);

  const oldCode3 = `</button>
                            </div>
                          );
                        })()}`;
  const newCode3 = `</button>
                            </div>
                            </>
                          );
                        })()}`;
  content = content.replace(oldCode3, newCode3);

  fs.writeFileSync(file, content);
  console.log('Admin updated');
}

updateAdmin();
