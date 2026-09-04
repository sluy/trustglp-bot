const fs = require('fs');
const file = 'apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx';
let content = fs.readFileSync(file, 'utf8');

function ensureReplace(search, replaceWith, label) {
    if (!content.includes(search)) {
        console.error("FAIL: Could not find " + label);
        process.exit(1);
    }
    content = content.replace(search, replaceWith);
    console.log("SUCCESS: Replaced " + label);
}

// 1. ADD STATES
const stateSearch = `  const [completedTransfers, setCompletedTransfers] = useState(0);`;
const stateReplace = `  const [completedTransfers, setCompletedTransfers] = useState(0);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);`;
ensureReplace(stateSearch, stateReplace, "states");

// 2. ADD METHOD
const methodSearch = `  const chatPollRef = useRef<NodeJS.Timeout | null>(null);`;
const methodReplace = `  const chatPollRef = useRef<NodeJS.Timeout | null>(null);

  const handleSendChat = async () => {
     if(!chatMessage.trim() || !selectedOrderDetails) return;
     setIsSendingChat(true);
     try {
        const isBinance = selectedOrderDetails.exchange === 'binance';
        const orderId = selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId;
        const url = isBinance 
            ? \`/api/binance/order/\${orderId}/chat/send\` 
            : \`/api/bybit/order/\${orderId}/chat\`;
        
        const body = isBinance
            ? { textContent: chatMessage }
            : { action: 'send_message', message: chatMessage };

        const res = await fetch(url, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok || data.success) {
           setChatMessage("");
           alert(\`🚀 Mensaje enviado al chat de \${isBinance ? 'Binance' : 'Bybit'} con éxito.\`);
        } else {
           alert(\`Error: \${data.error || 'Fallo desconocido'}\`);
        }
     } catch(e) {
        console.error(e);
        alert('Error de conexión al enviar mensaje.');
     } finally {
        setIsSendingChat(false);
     }
  };`;
ensureReplace(methodSearch, methodReplace, "handleSendChat");

// 3. FIX hasData
const hasDataSearchTop = `                          if (hasData) {
                            return (
                              <>
                                {r?.identityNo && (
                                  <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-2">`;
const hasDataReplaceTop = `                          return (
                            <>
                              {hasData && (
                                <>
                                  {r?.identityNo && (
                                    <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-2">`;
ensureReplace(hasDataSearchTop, hasDataReplaceTop, "hasData top");

const hasDataSearchBottom = `                              </>
                            );
                          }

                          // Sin datos: mostrar caja de acción
                          return (
                            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-center mb-4">
                              <p className="text-xs text-rose-400 font-bold mb-1">Cédula o Cuenta faltante</p>
                              {isBinance && (
                                <p className="text-[10px] text-slate-500 mb-2">Binance: el mensaje se copiará para pegarlo manualmente en el chat</p>
                              )}
                              <button
                                onClick={() => handleRequestCI((selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId))}
                                disabled={requestingCI}
                                className="w-full bg-rose-500 hover:bg-rose-400 text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50 shadow-md flex justify-center items-center gap-2"
                              >
                                {isBinance
                                  ? '📋 Copiar Mensaje de Solicitud'
                                  : (requestingCI ? 'Enviando Comando...' : 'Pedir Datos Ocultos por Chat')}
                              </button>
                            </div>
                          );
                        })()}`;
const hasDataReplaceBottom = `                              </>
                            )}

                          {/* Siempre mostrar el boton de accion */}
                            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-center mb-4 mt-2">
                              <p className="text-xs text-rose-400 font-bold mb-1">Solicitar / Corregir Datos en Chat</p>
                              {isBinance && (
                                <p className="text-[10px] text-slate-500 mb-2">Binance: el mensaje se copiará para pegarlo manualmente en el chat</p>
                              )}
                              <button
                                onClick={() => handleRequestCI((selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId))}
                                disabled={requestingCI}
                                className="w-full bg-rose-500 hover:bg-rose-400 text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50 shadow-md flex justify-center items-center gap-2"
                              >
                                {isBinance
                                  ? '📋 Copiar Mensaje de Solicitud'
                                  : (requestingCI ? 'Enviando Comando...' : 'Pedir Datos Ocultos por Chat')}
                              </button>
                            </div>
                          </>
                        );
                      })()}`;
ensureReplace(hasDataSearchBottom, hasDataReplaceBottom, "hasData bottom");

// 4. ADD COPIAR TODO and CHAT GUI
const chatGuiSearch = `                         )}
                        
                        
                        <div className="bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col pt-12">`;
const chatGuiReplace = `                         )}
                        
                        {/* Botón Copiar Todo de un click */}
                        {(() => {
                           const cp = selectedOrderDetails.counterparty?.result;
                           const term = cp?.paymentTermList?.[0];
                           const cuenta = term?.accountNo || cp?.chatDetectedAccount || '';
                           const cedula = cp?.identityNo || cp?.chatDetectedCedula || term?.paymentText1 || '';
                           const montoRaw = selectedOrderDetails.amountFiat || '';
                           const monto = montoRaw ? Number(montoRaw).toFixed(2) : '';
                           if (!cuenta && !cedula) return null;
                           const copyText = [monto, cuenta, cedula].filter(Boolean).join('\\n');
                           return (
                             <button
                               onClick={() => {
                                 navigator.clipboard.writeText(copyText);
                                 alert('✅ Datos copiados: Monto + Cuenta + Cédula');
                               }}
                               className="w-full mb-4 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                             >
                               <Copy className="w-4 h-4"/> Copiar Todo (Monto + Cuenta + Cédula)
                             </button>
                           );
                         })()}

                        <div className="bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col pt-12">`;
ensureReplace(chatGuiSearch, chatGuiReplace, "Copiar Todo");

const chatBoxSearch = `                                  </button>
                              </div>
                          </div>
                        </div>
                      </div>
                   ) : (
                      <p className="text-rose-400 text-sm">No se encontraron métodos de pago o hubo un error al leer la API de ByBit.</p>`;
const chatBoxReplace = `                                  </button>
                              </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
                           <h4 className="font-bold text-emerald-400 mb-3 flex items-center gap-2 text-sm">
                             <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                             </span>
                             Chat con Contraparte
                           </h4>
                           <textarea
                             value={chatMessage}
                             onChange={(e) => setChatMessage(e.target.value)}
                             className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all mb-4 resize-none shadow-inner font-mono max-h-32"
                             rows={3}
                             placeholder="> Escribir mensaje en el chat..."
                           ></textarea>
                           <button
                             onClick={handleSendChat}
                             disabled={isSendingChat || !chatMessage.trim()}
                             className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-all font-mono tracking-wider shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_20px_rgba(5,150,105,0.5)] flex justify-center items-center gap-2"
                           >
                             {isSendingChat ? (
                                <>
                                   <RefreshCw className="w-4 h-4 animate-spin"/> Enviando...
                                </>
                             ) : 'ENVIAR MENSAJE'}
                           </button>
                         </div>

                      </div>
                   ) : (
                      <p className="text-rose-400 text-sm">No se encontraron métodos de pago o hubo un error al leer la API de ByBit.</p>`;
ensureReplace(chatBoxSearch, chatBoxReplace, "Chat input");

fs.writeFileSync(file, content);
console.log("ALL PATCHES APPLIED SUCCESSFULLY");
