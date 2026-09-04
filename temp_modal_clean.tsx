{/* Panel Lateral Modal para Contacto Directo C2C */}
      {selectedOrderDetails && (
         <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
            <div className="w-full md:w-[450px] bg-slate-950 border-l border-slate-800 p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full animate-in slide-in-from-right duration-300">
               
               
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className={isFrankTheme ? "text-xl font-black text-white flex items-center gap-2 font-mono" : "text-xl font-bold text-white flex items-center gap-2"}>
                      <Users className="text-xs font-mono text-slate-500 mt-1" /> "Detalle Biográfico"
                    </h3>
                    <p className="text-xs font-mono text-slate-500 mt-1">{isFrankTheme ? `// ORDER #${selectedOrderDetails.bybitOrderId}` : `Order #${selectedOrderDetails.bybitOrderId}`}</p>
                 </div>
                 <button 
                    className={isFrankTheme ? "w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 border border-orange-500/10 text-slate-400 hover:text-orange-400 hover:border-orange-500/30 transition-all" : "w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"}
                    onClick={() => setSelectedOrderDetails(null)}
                  >
                    ✖
                 </button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar">
                 <div className="bg-indigo-950/20 p-5 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/40 transition-colors">
                   <h4 className="font-bold text-indigo-400 mb-3 flex items-center gap-2">
                     <Layers className="w-4 h-4" /> KYC del Maker/Taker
                   </h4>
                   {loadingDetails ? (
                     <div className="animate-pulse flex space-x-4">
                       <div className="flex-1 space-y-3 py-1">
                         <div className="h-2 bg-slate-800 rounded"></div>
                         <div className="space-y-2">
                           <div className="h-2 bg-slate-800 rounded w-5/6"></div>
                         </div>
                       </div>
                     </div>
                   ) : selectedOrderDetails.counterparty?.result ? (
                     <div className="space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 mb-4">
                           <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nombre Registrado (ByBit KYC)</p>
                           <p className="font-bold text-white text-lg">
                             {selectedOrderDetails.counterparty.result.buyerRealName || selectedOrderDetails.counterparty.result.sellerRealName || 'IDENTIDAD OCULTA'}
                           </p>
                        </div>
                        {/* Datos de identidad / bancarios del comprador */}
                        {(() => {
                          const r = selectedOrderDetails.counterparty.result;
                          const isBinance = selectedOrderDetails.exchange === 'binance';
                          // Para Binance: identidad = cedula del chat o del order detail
                          const cedula  = r?.chatDetectedCedula || r?.identityNo || null;
                          const cuenta  = r?.chatDetectedAccount || null;
                          const titular = r?.accountHolder || r?.buyerRealName || null;
                          const hasData = !!(cedula || cuenta || r?.identityNo);

                          if (hasData) {
                            return (
                              <>
                                {r?.identityNo && (
                                  <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-2">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Documento ID</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-mono text-lg">{r.identityNo}</span>
                                      <button onClick={() => navigator.clipboard.writeText(r.identityNo)} className="text-slate-400 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button>
                                    </div>
                                  </div>
                                )}
                                {titular && (
                                  <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-2">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Titular</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-mono text-sm">{titular}</span>
                                      <button onClick={() => navigator.clipboard.writeText(titular)} className="text-slate-400 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button>
                                    </div>
                                  </div>
                                )}
                                {cuenta && (
                                  <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-4">
                                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">CUENTA CHAT</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-mono text-lg">{cuenta}</span>
                                      <button onClick={() => navigator.clipboard.writeText(cuenta)} className="text-slate-400 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button>
                                    </div>
                                  </div>
                                )}
                              </>
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
                                onClick={() => handleRequestCI(selectedOrderDetails.bybitOrderId)}
                                disabled={requestingCI}
                                className="w-full bg-rose-500 hover:bg-rose-400 text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50 shadow-md flex justify-center items-center gap-2"
                              >
                                {isBinance
                                  ? '📋 Copiar Mensaje de Solicitud'
                                  : (requestingCI ? 'Enviando Comando...' : 'Pedir Datos Ocultos por Chat')}
                              </button>
                            </div>
                          );
                        })()}
                        {/* Binance: si no hay datos aún, botón de recarga */}
                        {selectedOrderDetails.exchange === 'binance' && !selectedOrderDetails.counterparty.result.chatDetectedAccount && (
                          <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl mb-3">
                            <p className="text-amber-400 text-xs font-bold mb-1 flex items-center gap-1">
                              🔄 Cargando datos bancarios...
                            </p>
                            <p className="text-[10px] text-slate-500 mb-2">
                              Obteniendo datos de pago desde Binance API (payMethods.fields)
                            </p>
                            <button
                              onClick={() => refreshChatData(selectedOrderDetails.bybitOrderId, 'binance')}
                              className="w-full bg-amber-600/80 hover:bg-amber-500 text-white py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                              🔄 Recargar Datos de Pago
                            </button>
                          </div>
                        )}
                        {selectedOrderDetails.counterparty.result.paymentTermList?.length > 0 ? (
                           selectedOrderDetails.counterparty.result.paymentTermList.map((p: any, idx: number) => (
                            <div key={idx} className="bg-slate-900 p-4 rounded-xl border-l-[3px] border-l-emerald-500 border border-slate-800 shadow-inner">
                               <p className="text-emerald-400 font-bold mb-2 flex justify-between">
                                  {p.paymentType || p.bankName}
                                  <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">Activa</span>
                               </p>
                               <div className="space-y-3 text-sm font-mono tracking-tight text-slate-300">
                                 <p className="flex justify-between items-center group">
                                    <span className="text-slate-500">CTA:</span> 
                                    <span className="flex items-center gap-2">{p.accountNo || selectedOrderDetails.counterparty?.result?.chatDetectedAccount || '—'} <button onClick={() => navigator.clipboard.writeText(p.accountNo || selectedOrderDetails.counterparty?.result?.chatDetectedAccount || '')} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                 </p>
                                 <p className="flex justify-between items-center group">
                                    <span className="text-slate-500">TITULAR:</span> 
                                    <span className="flex items-center gap-2">{p.realName} <button onClick={() => navigator.clipboard.writeText(p.realName)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                 </p>
                                 {Object.entries(p).map(([k, v]) => {
                                    if (typeof v !== 'string' || !v || ['accountNo', 'realName', 'paymentType', 'paymentId', 'id', 'online'].includes(k)) return null;
                                    let label = k;
                                    if (k === 'bankName') label = 'Banco Destino';
                                    if (k.toLowerCase().startsWith('paymenttext')) label = 'Personal ID number';
                                    return (
                                       <p key={k} className="flex justify-between items-center group">
                                          <span className="text-slate-500 uppercase">{label}:</span> 
                                          <span className="flex items-center gap-2">{v as string} <button onClick={() => navigator.clipboard.writeText(v as string)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                       </p>
                                    );
                                 })}
                               </div>
                            </div>
                           ))
                        ) : (
                           <div className="text-sm p-4 bg-yellow-950/20 text-yellow-500 rounded-xl border border-yellow-900/30 text-center">
                              No hay rieles bancarios expuestos para esta orden.
                           </div>
                        )}

                        {/* Cuadro "Datos de Pago en Chat" — siempre visible si hay datos detectados */}
                        {(selectedOrderDetails.counterparty.result.chatOnlyAccount || selectedOrderDetails.counterparty.result.chatOnlyCedula) && (
                           <div className="bg-slate-900 p-4 rounded-xl border-l-[3px] border-l-cyan-500 border border-slate-800 shadow-inner mt-2">
                             <p className="text-cyan-400 font-bold mb-3 flex justify-between items-center text-sm">
                               <span>💬 Datos de Pago en Chat</span>
                               <span className="text-xs bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full animate-pulse">En vivo</span>
                             </p>
                             <div className="space-y-3 text-sm font-mono">
                               {selectedOrderDetails.counterparty.result.chatOnlyAccount && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">CUENTA:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatOnlyAccount}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatOnlyAccount)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               {selectedOrderDetails.counterparty.result.chatOnlyCedula && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">CÉDULA:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatOnlyCedula}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatOnlyCedula)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               <button
                                 onClick={() => {
                                   const amount = selectedOrderDetails.amountFiat
                                     ? Number(selectedOrderDetails.amountFiat).toFixed(2)
                                     : '';
                                   const parts = [
                                     amount,
                                     selectedOrderDetails.counterparty.result.chatOnlyAccount,
                                     selectedOrderDetails.counterparty.result.chatOnlyCedula,
                                   ].filter(Boolean).join('\n');
                                   navigator.clipboard.writeText(parts);
                                   alert('✅ Datos del chat copiados');
                                 }}
                                 className="w-full mt-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-all"
                               >
                                 <Copy className="w-3 h-3"/> Copiar Datos del Chat
                               </button>
                             </div>
                           </div>
                         )}
                        
                        
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

               </div>
            </div>
         </div>
      )}
    </div>
  );
}
