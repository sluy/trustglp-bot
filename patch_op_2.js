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

// 1. ADD STATES (Wait, this was successful in the first run of the script. Let's see if it's there already)
if (!content.includes('const [chatMessage, setChatMessage] = useState("");')) {
    const stateSearch = `  const [completedTransfers, setCompletedTransfers] = useState(0);`;
    const stateReplace = `  const [completedTransfers, setCompletedTransfers] = useState(0);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);`;
    ensureReplace(stateSearch, stateReplace, "states");
}

if (!content.includes('const handleSendChat = async () => {')) {
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
}

// 4. ADD COPIAR TODO and CHAT GUI
if (!content.includes('Botón Copiar Todo de un click')) {
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
}

if (!content.includes('Escribir mensaje en el chat')) {
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
}

fs.writeFileSync(file, content);
console.log("ALL PATCHES APPLIED SUCCESSFULLY");
