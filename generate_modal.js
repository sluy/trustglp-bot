const fs = require('fs');

let adminFile = fs.readFileSync('apps/admin-dashboard/app/admin/p2p/page.tsx', 'utf8');
const startIndex = adminFile.indexOf('{/* Panel Lateral Modal para Contacto Directo C2C */}');
if (startIndex === -1) {
    console.error("Modal comment not found");
    process.exit(1);
}

let adminModal = adminFile.substring(startIndex).split('</main>')[0];

// Remove the outermost section wrapper or adjust it
adminModal = adminModal.replace(/\{selectedOrderDetails && \(\s*<div.*?<\/div>\s*\)\s*\}/g, '');

const uploadSection = `
                        <div className="bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col pt-12">
                          <h3 className="text-xl font-bold text-white mb-2 pb-2 border-b border-slate-700">Detalles de la Contraparte</h3>
                          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg mb-4 flex flex-col items-center">
                              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Total a Transferir</span>
                              <div className="flex items-center gap-2">
                                 <span className="text-white font-black text-2xl">{Number(selectedOrderDetails.amountFiat).toLocaleString()} VES</span>
                                 <button onClick={() => navigator.clipboard.writeText(String(selectedOrderDetails.amountFiat))} className="text-emerald-500/50 hover:text-emerald-400 transition-colors">
                                    <Copy className="w-5 h-5"/>
                                 </button>
                              </div>
                          </div>
                          <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 mt-4">
                              <p className="text-xs text-slate-400 mb-4">Sube un comprobante. El bot lo enviará automáticamente al chat antes de soltar la orden a Bybit.</p>
                              
                              <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleFileChange}
                                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 mb-4 cursor-pointer"
                              />
                              
                              {receiptImageBase64 && (
                                  <div className="mb-4 rounded-lg overflow-hidden border border-indigo-500/30 max-h-48 relative">
                                      <img src={receiptImageBase64} alt="Preview" className="w-full object-cover" />
                                  </div>
                              )}
                              
                              <div className="flex gap-3 mt-4">
                                  <button
                                      onClick={() => handleMarkAsPaid(selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId)}
                                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-3 rounded-lg text-sm font-bold transition-all shadow-md"
                                  >
                                      Pagar Sin Adjunto
                                  </button>
                                  <button
                                      onClick={() => handleMarkAsPaidWithReceipt(selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId)}
                                      disabled={isSendingReceipt || !receiptImageBase64}
                                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 rounded-lg text-sm font-bold transition-all shadow-md flex justify-center items-center gap-2"
                                  >
                                      {isSendingReceipt ? 'Informando...' : 'Informar + Adjunto'}
                                  </button>
                              </div>
                          </div>
                        </div>
`;

// Replace the subrutina chat auto-pilot with the upload section
adminModal = adminModal.replace(/<div className="bg-slate-900 border-l border-slate-700\/50 p-6 flex flex-col pt-12">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/m, uploadSection + '\n               </div>\n            </div>\n         </div>\n      )}');

// Clean up isFrankTheme and isRafaTheme logic
adminModal = adminModal.replace(/className=\{isFrankTheme \? "[^"]*" : isRafaTheme \? "[^"]*" : "([^"]*)"\}/g, 'className="$1"');
adminModal = adminModal.replace(/className=\{isFrankTheme \? '[^']*' : isRafaTheme \? '[^']*' : '([^']*)'\}/g, 'className="$1"');
adminModal = adminModal.replace(/className=\{`[^`]*\$\{isFrankTheme \? '[^']*' : '[^']*'\}[^`]*`\}/g, 'className="text-xs font-mono text-slate-500 mt-1"');
adminModal = adminModal.replace(/\{isFrankTheme \? '[^']*' : '([^']*)'\}/g, '"$1"');
adminModal = adminModal.replace(/\{isFrankTheme \&\& [^}]*\}/g, '');
adminModal = adminModal.replace(/\{isRafaTheme \&\& [^}]*\}/g, '');
adminModal = adminModal.replace(/isCounterpartyLoading/g, 'loadingDetails');

fs.writeFileSync('temp_modal_clean.tsx', adminModal);
console.log("Extracted successfully.");
