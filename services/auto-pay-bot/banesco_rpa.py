import os
import asyncio
import time
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from dotenv import load_dotenv
import requests
import re
from gmail_otp import obtener_clave_gmail

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8204244360:AAEhBziF0jBMBcI91eVhreQd7uQ_IRi60-8')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '-1004472055488')
TELEGRAM_REPORTS_CHAT_ID = os.getenv('TELEGRAM_REPORTS_CHAT_ID', '-1004302088476')

def send_debug_photo(photo_path, caption):
    if not TELEGRAM_BOT_TOKEN:
        return
    is_error = "❌" in caption or "⚠️" in caption
    target_chat_id = TELEGRAM_REPORTS_CHAT_ID if is_error else TELEGRAM_CHAT_ID
    if not target_chat_id:
        return
    
    # Auto-format chat ID to include -100 prefix if missing
    target_chat_id = target_chat_id.strip()
    if target_chat_id.startswith("-") and not target_chat_id.startswith("-100"):
        target_chat_id = f"-100{target_chat_id[1:]}"
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    try:
        with open(photo_path, 'rb') as f:
            res = requests.post(url, data={'chat_id': target_chat_id, 'caption': caption[:1024]}, files={'photo': f})
            if res.status_code != 200:
                print(f"[TELEGRAM PHOTO ERROR] status={res.status_code}, response={res.text}")
    except Exception as e:
        print(f"[TELEGRAM PHOTO ERROR] {e}")

BANESCO_USUARIO = os.getenv("BANESCO_USER", "")
BANESCO_CLAVE = os.getenv("BANESCO_PASS", "")

class BanescoSessionManager:
    def __init__(self, username):
        self.username = username
        self.lock = asyncio.Lock()
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.last_activity = 0
        self.current_user = None
        self.last_otp_code = None

    async def close_session(self):
        print(f"[RPA Banesco - {self.username}] Cerrando sesión y destruyendo navegador...")
        try:
            if self.page:
                btn_salir = self.page.locator('*[title*="Salir" i], *[alt*="Salir" i]').first
                if await btn_salir.count() == 0 and await self.page.locator("iframe, frame").count() > 0:
                    btn_salir = self.page.frame_locator("iframe, frame").last.locator('*[title*="Salir" i], *[alt*="Salir" i]').first
                if await btn_salir.count() > 0:
                    await btn_salir.click(force=True, timeout=3000)
        except:
            pass
        try:
            if self.browser:
                await self.browser.close()
        except:
            pass
        try:
            if self.playwright:
                await self.playwright.stop()
        except:
            pass
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.last_activity = 0
        self.current_user = None
        self.last_otp_code = None

# Diccionario global para mantener vivos múltiples navegadores (1 por usuario)
session_managers = {}

def get_session_manager(username):
    if username not in session_managers:
        session_managers[username] = BanescoSessionManager(username)
    return session_managers[username]

async def iniciar_sesion_banesco(cedula_destino, telefono_destino, cuenta_destino, monto_ves, banco_destino, nombre_beneficiario, banesco_user, banesco_pass, preguntas_seguridad=None, gmail_user=None, gmail_pass=None, is_test=False):
    banesco_user = banesco_user or BANESCO_USUARIO
    banesco_pass = banesco_pass or BANESCO_CLAVE
    
    # Obtener el manager ESPECÍFICO para esta cuenta de Banesco
    manager = get_session_manager(banesco_user)
    
    print(f"\n=======================================================")
    print(f"[🏦 BANESCO RPA] EJECUCION DE TRANSFERENCIA INICIADA")
    print(f" > Cuenta Origen   : {banesco_user}")
    print(f" > Cuenta Destino  : {cuenta_destino}")
    print(f" > Cedula Benefici : {cedula_destino}")
    print(f" > Monto Exacto    : {monto_ves} VES")
    print(f"=======================================================\n")
    
    if not banesco_user or not banesco_pass:
        print("[ERROR RPA] Credenciales de Banesco no configuradas en el .env")
        return False
        
    async with manager.lock:
        now = time.time()
        # Verificar inactividad
        if manager.page and (now - manager.last_activity > 480 or manager.current_user != banesco_user):
            print(f"[RPA Banesco - {banesco_user}] Sesión inactiva por >8 min o cambio de usuario. Reiniciando.")
            await manager.close_session()
            
        needs_login = False
        if manager.page is None:
            needs_login = True
        else:
            # Check si nos botaron
            try:
                url = manager.page.url.lower()
                if "about:blank" in url or "login.aspx" in url or "cierresesion.aspx" in url or "login" in url or "cierre" in url:
                    needs_login = True
            except:
                needs_login = True
                
        if not needs_login:
            try:
                # Vamos a Resumen.aspx rápido para validar que la sesión sigue viva y el estado ASP.NET es limpio
                print(f"[RPA Banesco - {banesco_user}] Validando sesión activa en Resumen...")
                await manager.page.goto("https://www.banesconline.com/mantis/Website/Resumen.aspx", timeout=15000)
                await asyncio.sleep(1)
                url_after = manager.page.url.lower()
                if "login" in url_after or "cierresesion" in url_after:
                    needs_login = True
                else:
                    b_frame_test = manager.page.frame_locator("iframe, frame").last if await manager.page.locator("iframe, frame").count() > 0 else manager.page
                    if await b_frame_test.locator('input[type="password"]').count() > 0 or await b_frame_test.locator('text="NUEVOS USUARIOS"').count() > 0:
                        needs_login = True
            except:
                needs_login = True

        if needs_login:
            await manager.close_session()
            print(f"[RPA Banesco - {banesco_user}] Lanzando navegador...")
            manager.playwright = await async_playwright().start()
            manager.browser = await manager.playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
            manager.context = await manager.browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            manager.page = await manager.context.new_page()
            manager.page.on("dialog", lambda dialog: asyncio.create_task(dialog.accept()))
            await stealth_async(manager.page)
            manager.current_user = banesco_user
            
        page = manager.page
        
        try:
            if needs_login:
                print(f"[RPA Banesco - {banesco_user}] Accediendo a la boveda web...")
                await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", timeout=60000)
                print(f"[RPA Banesco - {banesco_user}] Portal cargado. Buscando inputs en el IFrame de seguridad Mantis...")
                await asyncio.sleep(2)
                
                await page.screenshot(path="debug_login.png")
                send_debug_photo("debug_login.png", "🤖 RPA Banesco: Portal Cargado (Reconocimiento IFrame Inicial)")
                
                b_frame = page.frame_locator("iframe, frame").last
                print("[RPA Banesco] IFrame interceptado. Aguardando render interno...")
                await asyncio.sleep(2.5)
                
                input_usuario = b_frame.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="password"])').first
                await input_usuario.fill(banesco_user, force=True)
                
                btn_aceptar = b_frame.locator('button:has-text("Aceptar"), input[type="submit"][value*="Aceptar" i], a:has-text("Aceptar")').first
                await btn_aceptar.click(force=True)
                
                print("[RPA Banesco] Evaluando bifurcacion de seguridad anti-bot...")
                try: await page.wait_for_load_state("networkidle", timeout=3000)
                except: pass
                await asyncio.sleep(1.5)
                
                await page.screenshot(path="debug_bifurcacion.png")
                send_debug_photo("debug_bifurcacion.png", "🛡️ Bifurcación: Evaluando si pide Clave o Preguntas")
                
                preguntas_count = await b_frame.get_by_text("VALIDACIÓN DE PREGUNTAS").count()
                if preguntas_count > 0:
                    print("[RPA Banesco] ⚠️ Desafío de Seguridad detectado. Extrayendo preguntas del DOM...")
                    text_content = await b_frame.locator("body").inner_text()
                    text_lower = text_content.lower()
                    
                    if preguntas_seguridad:
                        diccionario_seguridad = preguntas_seguridad
                    else:
                        diccionario_seguridad = {}
                        for i in range(1, 9):
                            q = os.getenv(f"BANESCO_SEC_Q{i}", "").strip().lower()
                            a = os.getenv(f"BANESCO_SEC_A{i}", "").strip()
                            if q and a:
                                diccionario_seguridad[q] = a
                    
                    if not diccionario_seguridad:
                        print("[RPA BANESCO FATAL] No hay preguntas/respuestas de seguridad configuradas.")
                        send_debug_photo("debug_bifurcacion.png", "❌ Preguntas de seguridad detectadas pero no hay respuestas configuradas en ENV")
                        return False
                    
                    encontradas = []
                    for p_clave, r_valor in diccionario_seguridad.items():
                        idx = text_lower.find(p_clave)
                        if idx != -1:
                            encontradas.append((idx, r_valor))
                    
                    encontradas.sort(key=lambda x: x[0])
                    respuestas_a_inyectar = [x[1] for x in encontradas]
                    
                    inputs_respuestas = b_frame.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')
                    count_inputs = await inputs_respuestas.count()
                    
                    if count_inputs >= 2 and len(respuestas_a_inyectar) >= 2:
                        await inputs_respuestas.nth(0).fill(respuestas_a_inyectar[0], force=True)
                        await inputs_respuestas.nth(1).fill(respuestas_a_inyectar[1], force=True)
                        print(f"[RPA Banesco] Respondido: {respuestas_a_inyectar[0]} y {respuestas_a_inyectar[1]}")
                        await b_frame.locator('button:has-text("Aceptar"), input[type="submit"][value*="Aceptar" i], a:has-text("Aceptar")').first.click(force=True)
                        try: await page.wait_for_load_state("networkidle", timeout=3000)
                        except: pass
                        await asyncio.sleep(1.5)
                    else:
                        print(f"[RPA BANESCO FATAL] Falla tactica: Solo reconoci estas respuestas mapeadas en mi cerebro: {respuestas_a_inyectar}")
                        return False
                        
                print("[RPA Banesco] Detectando caja fuerte de Contraseña...")
                input_clave = b_frame.locator('input[type="password"]').first
                
                if await input_clave.count() == 0:
                    print("[RPA Banesco] Contraseña no lograda a la primera, esperando render del IFrame...")
                    await asyncio.sleep(2)
                    input_clave = b_frame.locator('input[type="password"]').first
                    
                await input_clave.fill(banesco_pass, force=True)
                
                checkbox = b_frame.locator('input[type="checkbox"]')
                if await checkbox.count() > 0:
                    await checkbox.first.check(force=True)
                    print("[RPA Banesco] Checkbox de equipo frecuente marcado.")
                    
                await b_frame.locator('button:has-text("Aceptar"), input[type="submit"][value*="Aceptar" i], a:has-text("Aceptar")').first.click(force=True)
                try: await page.wait_for_load_state("networkidle", timeout=3000)
                except: pass
                
                await asyncio.sleep(1.5)
                
                await page.screenshot(path="debug_exito.png")
                send_debug_photo("debug_exito.png", "🤑 ¡Infiltración Exitosa en HomeBanking!")
                print("[RPA Banesco] 🤑 ¡Infiltración Exitosa! Estamos dentro del HomeBanking.")
            else:
                print("[RPA Banesco] Sesión Activa Detectada. Saltando flujo de Login.")

            print("[RPA Banesco] Escaneando Balance Disponible...")
            await asyncio.sleep(1.5) 
            
            if await page.locator("iframe, frame").count() > 0:
                 action_frame = page.frame_locator("iframe, frame").last
            else:
                 action_frame = page
                 
            dashboard_text = await action_frame.locator("body").inner_text()
            
            saldo_match = re.search(r"0134[\\d\\s\\*\\-]*?\\s+([\\d\\.]+,\d{2})", dashboard_text)
            if saldo_match:
                 saldo_str = saldo_match.group(1).replace(".", "").replace(",", ".")
                 saldo_flt = float(saldo_str)
                 print(f"[RPA Banesco] Saldo Auditado: {saldo_flt:,.2f} VES")
                 
                 if saldo_flt < float(monto_ves):
                      print(f"[RPA BANESCO] FONDOS INSUFICIENTES. Orden exige {monto_ves} VES y la bóveda reporta {saldo_flt} VES")
                      send_debug_photo("debug_exito.png", f"❌ Fondos Insuficientes en {banesco_user}.\\nRequerido: {monto_ves} Bs\\nDisponible: {saldo_flt} Bs")
                      return "NO_FUNDS"
            else:
                 print("[RPA Banesco] Advertencia: No pude parsear el saldo matemáticamente de la tabla visual.")
                 
            print("[RPA Banesco] Invocando Menú de Transferencias a Terceros...")
            pagina_alcanzada = False
            action_frame = page
            
            # Detectamos si es Pago Movil basandonos en que la cuenta destino es un numero de telefono de 11 digitos
            es_pago_movil = len(cuenta_destino) == 11 and cuenta_destino.startswith("04")
            es_pago_movil_banesco = es_pago_movil and (banco_destino == "0134" or banco_destino.upper() == "BANESCO")
            es_pago_movil_otros = es_pago_movil and not es_pago_movil_banesco
            
            try:
                if es_pago_movil_banesco:
                    print("[RPA Banesco] Modalidad Pago Movil Banesco Detectada -> 'Pago Móvil' > 'Enviar Pago'")
                    js_pago_movil = """
                        let cls = Array.from(document.querySelectorAll('a, span, td'));
                        let pbtn = cls.find(e => e.innerText && e.innerText.trim() === 'Pago Móvil');
                        if (pbtn) { 
                            pbtn.focus(); pbtn.click(); 
                            if(pbtn.tagName === 'TD' && pbtn.children.length > 0) pbtn.children[0].click();
                        }
                    """
                    await page.evaluate(f"() => {{ {js_pago_movil} }}")
                    await asyncio.sleep(1.0)
                    
                    js_enviar = """
                        let cls2 = Array.from(document.querySelectorAll('a, span, td'));
                        let ebtn = cls2.find(e => e.innerText && e.innerText.trim() === 'Enviar Pago');
                        if (ebtn) { 
                            ebtn.focus(); ebtn.click(); 
                            if(ebtn.tagName === 'TD' && ebtn.children.length > 0) ebtn.children[0].click();
                        }
                    """
                    await page.evaluate(f"() => {{ {js_enviar} }}")
                    await asyncio.sleep(1.5)
                else:
                    js_transf = """
                        let cls = Array.from(document.querySelectorAll('a, span, td'));
                        let cbtn = cls.find(e => e.innerText && e.innerText.trim() === 'Transferencias');
                        if (cbtn) { cbtn.focus(); cbtn.click(); }
                    """
                    await page.evaluate(f"() => {{ {js_transf} }}")
                    await asyncio.sleep(1.0)
                    
                    if es_pago_movil_otros:
                        print("[RPA Banesco] Modalidad Pago Movil Otros Bancos Detectada -> 'Terceros Otros Bancos'")
                        js_terc = """
                            let cls = Array.from(document.querySelectorAll('a, span, td'));
                            let cbtn = cls.find(e => e.innerText && e.innerText.trim() === 'Terceros Otros Bancos');
                            if (cbtn) {
                                cbtn.focus();
                                cbtn.click();
                                if(cbtn.tagName === 'TD' && cbtn.children.length > 0) cbtn.children[0].click();
                            }
                        """
                    else:
                        print("[RPA Banesco] Modalidad Estandar -> 'Terceros en Banesco'")
                        js_terc = """
                            let cls = Array.from(document.querySelectorAll('a, span, td'));
                            let cbtn = cls.find(e => e.innerText && e.innerText.trim() === 'Terceros en Banesco');
                            if (cbtn) {
                                cbtn.focus();
                                cbtn.click();
                                if(cbtn.tagName === 'TD' && cbtn.children.length > 0) cbtn.children[0].click();
                            }
                        """
                    await page.evaluate(f"() => {{ {js_terc} }}")
                    await asyncio.sleep(1.5)
                
                for _ in range(4):
                    try:
                        final_text = await page.locator("body").inner_text()
                        if "A DEBITAR" in final_text.upper() or "ESTA OPCIÓN LE PERMITE" in final_text.upper():
                             action_frame = page
                             pagina_alcanzada = True
                             break
                        else:
                            for i in range(await page.locator("iframe, frame").count()):
                                f_can = page.frame_locator("iframe, frame").nth(i)
                                body_text_iframe = await f_can.locator("body").inner_text()
                                if "A DEBITAR" in body_text_iframe.upper() or "ESTA OPCIÓN LE PERMITE" in body_text_iframe.upper():
                                    action_frame = f_can
                                    pagina_alcanzada = True
                                    break
                    except:
                        pass
                    
                    if pagina_alcanzada:
                        break
                    await asyncio.sleep(1.0)
            except Exception as ex_kb:
                print(f"[RPA Banesco] Falla en Navegación del Menú: {ex_kb}")
                
            if not pagina_alcanzada:
                 print("[RPA BANESCO FATAL] Fallo Definitivo de Navegación hacia la Bóveda de Transferencias.")
                 await page.screenshot(path="debug_nav_error.png")
                 send_debug_photo("debug_nav_error.png", "❌ [RPA ERROR] No se pudo cargar la vista de 'Terceros en Banesco'. Ambos motores fallaron.")
                 return False
                 
            print("[RPA Banesco] Seleccionando Cuenta a Debitar para invocar el Formulario AJAX...")
            try:
                select_origen = action_frame.locator("select").first
                try:
                    await select_origen.wait_for(state="visible", timeout=10000)
                except:
                    pass 
                
                print("[RPA Banesco] Aplicando Primer Clic (Despierta el Lazy-Load del Banco)...")
                await select_origen.focus()
                await select_origen.click(force=True)
                
                print("[RPA Banesco] Aguardando inyección dinámica de cuentas en el DOM...")
                for _ in range(15):
                    if await select_origen.locator("option").count() > 0:
                        break
                    await asyncio.sleep(1)
                    
                opciones = await select_origen.locator("option").count()
                print(f"[RPA Banesco] Select origen detectado con {opciones} opciones internas emergentes.")
                
                if opciones > 0:
                    target_index = 1 if opciones > 1 else 0
                    
                    await select_origen.focus()
                    await select_origen.click(force=True)
                    await asyncio.sleep(1.5)
                    
                    await select_origen.select_option(index=target_index, force=True)
                    await asyncio.sleep(0.5)
                    
                    print("[RPA Banesco] Inyectando emulación biomecánica: Enter -> ArrowDown -> Enter")
                    await select_origen.press("Enter")
                    await asyncio.sleep(0.5)
                    await select_origen.press("ArrowDown")
                    await asyncio.sleep(0.5)
                    await select_origen.press("Enter")
                    
                    try:
                        await select_origen.press("Tab") 
                    except:
                        pass
                    
                    js_code = f"el => {{ try {{ el.selectedIndex = {target_index}; el.dispatchEvent(new Event('change', {{ bubbles: true }})); }} catch(e) {{}} }}"
                    try:
                        await select_origen.evaluate(js_code)
                    except:
                        pass
                    
                try:
                    await page.wait_for_load_state("load", timeout=3000)
                except:
                    pass
                await asyncio.sleep(2)
            except Exception as se:
                print(f"[RPA Banesco] Select-Debit AJAX warning: {se}")
                 
            print("[RPA Banesco] Geometría del Formulario Detectada. Llenando campos...")
            
            selects = action_frame.locator("select:visible")
            text_inputs = action_frame.locator('input[type="text"]:visible')
            
            if es_pago_movil_banesco:
                pass # No hay método de transferencia extra que seleccionar aquí
            elif es_pago_movil_otros:
                print("[RPA Banesco] Seleccionando Método de Transferencia: Pago Movil...")
                try:
                    await selects.nth(1).select_option(label="Teléfono Operaciones Inmediatas", force=True)
                    await asyncio.sleep(2)
                    try: await page.wait_for_load_state("load", timeout=3000)
                    except: pass
                    # Refrescar locators tras el postback
                    selects = action_frame.locator("select:visible")
                    text_inputs = action_frame.locator('input[type="text"]:visible')
                except Exception as e:
                    print(f"[RPA Banesco] Error seleccionando Método de Transferencia: {e}")
            
            inputs_listos = False
            for _ in range(8):
                 if await text_inputs.count() >= (4 if es_pago_movil_otros else (4 if es_pago_movil_banesco else 3)):
                     inputs_listos = True
                     break
                 await asyncio.sleep(2)
                 text_inputs = action_frame.locator('input[type="text"]:visible')
                 selects = action_frame.locator("select:visible")
                 
            if not inputs_listos:
                 print("[RPA BANESCO FATAL] El formulario de destino no se reveló tras el Postback.")
                 await page.screenshot(path="debug_ajax_error.png")
                 if is_test:
                     send_debug_photo("debug_ajax_error.png", "❌ [RPA ERROR] AJAX Fallido u Oculto al cargar el formulario de transferencia.")
                 return False
            
            letra_cedula = "V"
            ced_limpia = cedula_destino.replace("-", "").replace(" ", "")
            numero_cedula = ced_limpia
            
            if len(ced_limpia) > 0 and ced_limpia[0].upper() in ["V", "E", "J", "P", "G"]:
                 letra_cedula = ced_limpia[0].upper()
                 numero_cedula = ced_limpia[1:]
                 
            # Autocorrección para extranjeros (Cédulas >= 80 millones)
            if numero_cedula.isdigit() and int(numero_cedula) >= 80000000 and letra_cedula == "V":
                 letra_cedula = "E"
            
            # Garantizar siempre 2 decimales para que Banesco no se confunda
            monto_str = f"{float(monto_ves):.2f}".replace(".", ",")
            
            if es_pago_movil_banesco:
                print(f"[RPA Banesco] Llenando Formulario Pago Movil Banesco: Telf={cuenta_destino}")
                
                prefijo = cuenta_destino[:4]
                numero_tlf = cuenta_destino[4:]
                
                # Teléfono
                try: await selects.nth(1).select_option(label=prefijo, force=True)
                except: await selects.nth(1).select_option(value=prefijo, force=True)
                await text_inputs.nth(0).fill(numero_tlf, force=True)
                
                # Cédula Dropdown y Número
                try: await selects.nth(2).select_option(label=letra_cedula, force=True)
                except: await selects.nth(2).select_option(value=letra_cedula, force=True)
                await text_inputs.nth(1).fill(numero_cedula, force=True)
                
                # Banco Destino (Select 3)
                try: await selects.nth(3).select_option(label="BANESCO BANCO UNIVERSAL S.A.C.A.", force=True)
                except:
                    try: await selects.nth(3).select_option(index=1, force=True) # Usually the first option
                    except: pass
                
                # Monto y Concepto (El input tiene máscara, se llena tipeando para no romperla)
                monto_centavos = str(int(round(float(monto_ves) * 100)))
                monto_input = text_inputs.nth(2)
                await monto_input.focus()
                await page.keyboard.press("End")
                for _ in range(5): 
                    await page.keyboard.press("Backspace")
                    await asyncio.sleep(0.1)
                await monto_input.type(monto_centavos, delay=50)
                await text_inputs.nth(3).fill("Pago", force=True)
            elif es_pago_movil_otros:
                print(f"[RPA Banesco] Llenando Formulario Pago Movil: Banco={banco_destino}, Telf={cuenta_destino}, Benef={nombre_beneficiario}")
                
                # Normalización del banco (Nombres exactos de Banesco)
                bd_lower = banco_destino.lower()
                banco_normalizado = banco_destino
                if "bnc" in bd_lower or "nacional de" in bd_lower: banco_normalizado = "BANCO NACIONAL DE CREDITO"
                elif "mercantil" in bd_lower: banco_normalizado = "BANCO MERCANTIL C.A."
                elif "provincial" in bd_lower: banco_normalizado = "BANCO PROVINCIAL BBVA"
                elif "venezuela" in bd_lower or "bdv" in bd_lower: banco_normalizado = "BANCO DE VENEZUELA S.A.I.C.A."
                elif "bancamiga" in bd_lower: banco_normalizado = "BANCAMIGA BANCO UNIVERSAL, C.A."
                elif "100%" in bd_lower: banco_normalizado = "100%BANCO"
                elif "caribe" in bd_lower: banco_normalizado = "BANCO DEL CARIBE C.A."
                elif "exterior" in bd_lower: banco_normalizado = "BANCO EXTERIOR C.A."
                elif "bfc" in bd_lower or "fondo comun" in bd_lower: banco_normalizado = "FONDO COMUN"
                elif "bicentenario" in bd_lower: banco_normalizado = "BANCO DIGITAL DE LOS TRABAJADORES" # Antes Bicentenario
                elif "tesoro" in bd_lower: banco_normalizado = "BANCO DEL TESORO"
                elif "plaza" in bd_lower: banco_normalizado = "BANCO PLAZA"
                elif "caroni" in bd_lower: banco_normalizado = "BANCO CARONI, C.A. BANCO UNIVERSAL"
                elif "venezolano de" in bd_lower: banco_normalizado = "BANCO VENEZOLANO DE CREDITO S.A."
                elif "activo" in bd_lower: banco_normalizado = "BANCO ACTIVO BANCO COMERCIAL, C.A."
                elif "agricola" in bd_lower: banco_normalizado = "BANCO AGRICOLA"
                elif "banfanb" in bd_lower or "fuerza armada" in bd_lower: banco_normalizado = "BANFANB"
                elif "sur" in bd_lower: banco_normalizado = "DELSUR BANCO UNIVERSAL, C.A."
                elif "bancrecer" in bd_lower: banco_normalizado = "BANCRECER S.A. BANCO DE DESARROLLO"
                elif "bangente" in bd_lower: banco_normalizado = "BANGENTE C.A."
                elif "banplus" in bd_lower: banco_normalizado = "BANPLUS BANCO COMERCIAL C.A"
                elif "citibank" in bd_lower: banco_normalizado = "CITIBANK N.A."
                elif "municipal de" in bd_lower: banco_normalizado = "INSTITUTO MUNICIPAL DE CREDITO POPULAR"
                elif "mi banco" in bd_lower: banco_normalizado = "MI BANCO BANCO MICROFINANCIERO, C.A."
                elif "sofitasa" in bd_lower: banco_normalizado = "SOFITASA"
                
                print(f"[RPA Banesco] Banco normalizado a: {banco_normalizado}")
                
                # Banco Destino (búsqueda difusa)
                try:
                    await selects.nth(2).select_option(label=banco_normalizado, force=True)
                except Exception as e:
                    print(f"[RPA Banesco] Fallo seleccion exacta de banco '{banco_normalizado}', intentando aproximacion... {e}")
                    try:
                        js_banco = f"""
                            let sel = document.querySelectorAll('select')[2];
                            let match = Array.from(sel.options).find(o => o.text.toLowerCase().includes('{banco_normalizado.lower()}'));
                            if(match) {{ sel.value = match.value; sel.dispatchEvent(new Event('change', {{ bubbles: true }})); }}
                        """
                        await action_frame.evaluate(js_banco)
                    except:
                        pass
                
                # Beneficiario
                await text_inputs.nth(0).fill(nombre_beneficiario, force=True)
                
                # Cédula Dropdown y Número
                try: await selects.nth(3).select_option(label=letra_cedula, force=True)
                except: await selects.nth(3).select_option(value=letra_cedula, force=True)
                await text_inputs.nth(1).fill(numero_cedula, force=True)
                
                # Teléfono (0414) + Número
                prefijo = cuenta_destino[:4]
                numero_tlf = cuenta_destino[4:]
                try: await selects.nth(4).select_option(label=prefijo, force=True)
                except: await selects.nth(4).select_option(value=prefijo, force=True)
                await text_inputs.nth(2).fill(numero_tlf, force=True)
                
                # Monto y Concepto
                await text_inputs.nth(3).fill(monto_str, force=True)
                await text_inputs.nth(4).fill("Pago", force=True)
                
            else:
                print(f"[RPA Banesco] Llenando Formulario Estandar: Cuenta={cuenta_destino}")
                await text_inputs.nth(0).fill(cuenta_destino, force=True)
                
                if await selects.count() > 1:
                    try:
                        await selects.nth(1).select_option(label=letra_cedula, force=True)
                    except Exception as se2:
                        await selects.nth(1).select_option(value=letra_cedula, force=True)
                
                await text_inputs.nth(1).fill(numero_cedula, force=True)
                await text_inputs.nth(2).fill(monto_str, force=True)
                await text_inputs.nth(3).fill("Pago", force=True)
            
            await page.screenshot(path="debug_form_lleno.png")
            if is_test:
                send_debug_photo("debug_form_lleno.png", "📝 [TEST] Formulario completado matemáticamente. Listo para Aceptar.")
            
            print("[RPA Banesco] Ejecutando transferencia en Bóveda...")
            if es_pago_movil_banesco:
                print("[RPA Banesco] Usando TAB x3 + ENTER para enviar formulario Pago Móvil Banesco...")
                await page.keyboard.press("Tab")
                await asyncio.sleep(0.5)
                await page.keyboard.press("Tab")
                await asyncio.sleep(0.5)
                await page.keyboard.press("Tab")
                await asyncio.sleep(0.5)
                await page.keyboard.press("Enter")
            else:
                btn_aceptar_trans = action_frame.locator('button:has-text("Aceptar"), input[type="submit"][value*="Aceptar" i], input[type="button"][value*="Aceptar" i], a:has-text("Aceptar")').first
                await btn_aceptar_trans.click(force=True)
            
            if es_pago_movil_banesco:
                print("[RPA Banesco] Detectando Pantalla de Confirmación (Full Page Pago Movil Banesco)...")
                try:
                    await action_frame.locator('text=/CONFIRMACIÓN DE PAGO/i').or_(action_frame.locator('text=/confirmar que los datos/i')).first.wait_for(timeout=6000)
                    print("[RPA Banesco] Pantalla de Confirmación detectada. Dando clic a Pagar vía TAB TAB ENTER...")
                    if is_test:
                        await page.screenshot(path="debug_pantalla_confirmacion_pmb.png")
                        send_debug_photo("debug_pantalla_confirmacion_pmb.png", "🔎 [TEST] Pantalla de confirmación Pago Móvil Banesco detectada.")
                    await asyncio.sleep(1)
                    
                    # Emulación manual exacta indicada por el usuario para la pantalla de confirmación
                    await page.keyboard.press("Tab")
                    await asyncio.sleep(0.5)
                    await page.keyboard.press("Tab")
                    await asyncio.sleep(0.5)
                    await page.keyboard.press("Enter")
                except Exception as conf_page_e:
                    print(f"[RPA Banesco] (Warning) No vi el titulo de confirmacion exacto. {conf_page_e}")
                
                try: await page.wait_for_load_state("networkidle", timeout=3000)
                except: pass
                await asyncio.sleep(1.5)
            elif es_pago_movil_otros:
                print("[RPA Banesco] Detectando Pantalla de Confirmación (Full Page Pago Movil Otros)...")
                try:
                    await action_frame.locator('text=/DATOS DE LA TRANSFERENCIA/i').or_(action_frame.locator('text=/confirmar los datos/i')).first.wait_for(timeout=6000)
                    print("[RPA Banesco] Pantalla de Confirmación detectada. Aplicando Emulación Humana (TAB | TAB | ENTER)...")
                    if is_test:
                        await page.screenshot(path="debug_pantalla_confirmacion_pm.png")
                        send_debug_photo("debug_pantalla_confirmacion_pm.png", "🔎 [TEST] Pantalla de confirmación completa de Pago Móvil detectada.")
                except Exception as conf_page_e:
                    print(f"[RPA Banesco] (Warning) No vi el titulo de confirmacion exacto, pero intentare TAB TAB ENTER de todos modos. {conf_page_e}")
                
                await asyncio.sleep(1)
                
                # Emulación de teclado exacta descrita por el usuario
                try:
                    await page.keyboard.press("Tab")
                    await asyncio.sleep(0.5)
                    await page.keyboard.press("Tab")
                    await asyncio.sleep(0.5)
                    await page.keyboard.press("Enter")
                except Exception as e:
                    print(f"[RPA Banesco] Error en TAB TAB ENTER: {e}")
                
                try: await page.wait_for_load_state("networkidle", timeout=3000)
                except: pass
                await asyncio.sleep(1.5)
            else:
                print("[RPA Banesco] Detectando Modal de Confirmación...")
                try:
                    await page.locator('text="seguro de realizar esta"').or_(action_frame.locator('text="seguro de realizar esta"')).wait_for(timeout=3000)
                    print("[RPA Banesco] Modal/Texto superpuesto interceptado.")
                except:
                    pass
                
                print("[RPA Banesco] Inyectando Enter para el Modal...")
                await page.keyboard.press("Enter")
                await asyncio.sleep(2)
                    
                js_click = """() => {
                    const btns = Array.from(document.querySelectorAll('input, button, a'));
                    const aceptarBtn = btns.find(el => (el.value || el.innerText || "").toLowerCase().includes("aceptar") && el.offsetParent !== null);
                    if(aceptarBtn) aceptarBtn.click();
                }"""
                
                try:
                    await action_frame.evaluate(js_click)
                    await page.evaluate(js_click)
                except:
                    pass
                
                try: await page.wait_for_load_state("networkidle", timeout=3000)
                except: pass
                await asyncio.sleep(1.5)
                
                print("[RPA Banesco] Detectando Pantalla de Confirmación (Full Page Estándar)...")
                try:
                    await action_frame.locator('text="confirmar que los datos ingresados"').or_(action_frame.locator('text="confirmar los datos de la operación"')).wait_for(timeout=6000)
                    print("[RPA Banesco] Pantalla de Confirmación detectada. Dando clic a Aceptar...")
                    if is_test:
                        await page.screenshot(path="debug_pantalla_confirmacion_std.png")
                        send_debug_photo("debug_pantalla_confirmacion_std.png", "🔎 [TEST] Pantalla de confirmación Estándar detectada.")
                    await asyncio.sleep(1)
                    await page.keyboard.press("Enter")
                    await asyncio.sleep(2)
                    
                    try:
                        await action_frame.locator('input[value*="Aceptar" i], button:has-text("Aceptar"), a:has-text("Aceptar")').last.click(force=True)
                    except:
                        pass
                    
                    try:
                        await action_frame.evaluate(js_click)
                        await page.evaluate(js_click)
                    except:
                        pass
                    
                    try: await page.wait_for_load_state("networkidle", timeout=3000)
                    except: pass
                    await asyncio.sleep(1.5)
                except Exception as conf_page_e:
                    print("[RPA Banesco] (Ignorable) No apareció pantalla de confirmación completa, quizas fuimos directo al OTP o Recibo.")

            print("[RPA Banesco] Esperando cambio de pantalla (Clave Especial o Recibo final)...")
            pantalla_detectada = None
            for _ in range(15):
                try:
                    frame_text = await action_frame.locator("body").inner_text(timeout=1000)
                except:
                    frame_text = ""
                
                frame_text_upper = frame_text.upper()
                if "CLAVE DE OPERACIONES" in frame_text_upper or "EN SU CORREO ELECTR" in frame_text_upper or "RECUERDE QUE LA CLAVE" in frame_text_upper:
                    pantalla_detectada = "CLAVE"
                    break
                elif "OPERACIÓN EXITOSA" in frame_text_upper or "N° DE RECIBO" in frame_text_upper or "N DE RECIBO" in frame_text_upper:
                    pantalla_detectada = "RECIBO"
                    break
                    
                await asyncio.sleep(1)

            if pantalla_detectada == "CLAVE":
                print("[RPA Banesco] 🔐 ¡Banesco pide Clave de Operaciones Especiales! Analizando pantalla...")
                
                # Revisar si estamos en la pantalla intermedia de advertencia (sin inputs visibles)
                visible_inputs = await action_frame.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([readonly]):visible').count()
                if visible_inputs == 0:
                    if es_pago_movil_otros or es_pago_movil_banesco:
                        print("[RPA Banesco] Pantalla intermedia de OTP detectada (Solo Aviso). Aplicando Emulación Humana Exacta (TAB | TAB | ENTER)...")
                        await page.keyboard.press("Tab")
                        await asyncio.sleep(0.5)
                        await page.keyboard.press("Tab")
                        await asyncio.sleep(0.5)
                        await page.keyboard.press("Enter")
                    else:
                        print("[RPA Banesco] Pantalla intermedia de OTP detectada (Solo Aviso). Presionando Aceptar para ir al formulario real...")
                        btn_aceptar_aviso = action_frame.locator('button:has-text("Aceptar"):visible, input[type="submit"][value*="Aceptar" i]:visible, a:has-text("Aceptar"):visible').first
                        await btn_aceptar_aviso.click(force=True)
                        
                    try: await page.wait_for_load_state("networkidle", timeout=3000)
                    except: pass
                    await asyncio.sleep(1)
                    
                print("[RPA Banesco] Leyendo Gmail para extraer la clave OTP...", flush=True)
                await page.screenshot(path="debug_esperando_clave.png")
                if is_test:
                    send_debug_photo("debug_esperando_clave.png", "🔎 [TEST] Pantalla de Clave Especial OTP detectada. Leyendo correo...")
                
                # Si ya tenemos clave cacheada en esta sesión, reducimos el timeout de espera a solo 4 segundos
                timeout_espera = 4 if manager.last_otp_code else 120
                clave_otp = await obtener_clave_gmail(timeout=timeout_espera, gmail_user=gmail_user, gmail_pass=gmail_pass)
                
                if clave_otp:
                    manager.last_otp_code = clave_otp
                elif not clave_otp and manager.last_otp_code:
                    clave_otp = manager.last_otp_code
                    print(f"[RPA Banesco] Reusando Clave Especial anterior: {clave_otp}", flush=True)
                
                if clave_otp:
                    input_otp = action_frame.locator('input[type="password"], input[type="text"]:not([readonly])').first
                    await input_otp.fill(clave_otp, force=True)
                    
                    if es_pago_movil_otros or es_pago_movil_banesco:
                        print("[RPA Banesco] Clave ingresada. Aplicando Emulación Humana Exacta (TAB | TAB | ENTER)...", flush=True)
                        await page.keyboard.press("Tab")
                        await asyncio.sleep(0.5)
                        await page.keyboard.press("Tab")
                        await asyncio.sleep(0.5)
                        await page.keyboard.press("Enter")
                        print("[RPA Banesco] Clave de Operaciones enviada a Banesco (Vía Emulación Humana).", flush=True)
                    else:
                        btn_aceptar_otp = action_frame.locator('button:has-text("Aceptar"):visible, input[type="submit"][value*="Aceptar" i]:visible, input[type="button"][value*="Aceptar" i]:visible, a:has-text("Aceptar"):visible').first
                        await btn_aceptar_otp.click(force=True)
                        print("[RPA Banesco] Clave de Operaciones enviada a Banesco.", flush=True)
                        
                    try: await page.wait_for_load_state("networkidle", timeout=3000)
                    except: pass
                    await asyncio.sleep(1.5)
                else:
                    print("[RPA Banesco] ❌ No se pudo extraer la clave OTP a tiempo y no hay código en caché. Operación Abortada.")
                    try: await page.screenshot(path="debug_otp_fail.png")
                    except: pass
                    send_debug_photo("debug_otp_fail.png", "❌ No se pudo extraer la Clave Especial del correo.")
                    return False

            # Validación FINAL de éxito absoluto
            print("[RPA Banesco] Verificando confirmación final estricta (Recibo)...")
            exito_final = False
            for _ in range(10):
                try:
                    frame_text = await action_frame.locator("body").inner_text(timeout=1000)
                except:
                    frame_text = ""
                
                frame_text_upper = frame_text.upper()
                if "OPERACIÓN EXITOSA" in frame_text_upper or "N° DE RECIBO" in frame_text_upper or "N DE RECIBO" in frame_text_upper:
                    exito_final = True
                    break
                await asyncio.sleep(1)
                
            if not exito_final:
                print("[RPA Banesco] ❌ Nunca apareció el recibo de éxito. Operación Abortada para evitar falsos positivos.")
                try: await page.screenshot(path="debug_falso_positivo.png")
                except: pass
                send_debug_photo("debug_falso_positivo.png", "❌ ALERTA FALSO POSITIVO: Banesco no mostró la pantalla de RECIBO (Operación Exitosa). La operación se abortó por seguridad.")
                return False

            try:
                receipt_path = f"debug_recibo_{cuenta_destino}.png"
                await action_frame.locator("body").screenshot(path=receipt_path)
            except:
                receipt_path = f"debug_recibo_{cuenta_destino}.png"
                await page.screenshot(path=receipt_path)
                
            print(f"[RPA Banesco] Transferencia completada verificada estricta 100%. Recibo guardado como {receipt_path}")
            
        except Exception as e:
            print(f"[RPA EXCEPTION] Falla en la inyeccion de UI: {e}")
            try:
                await page.screenshot(path="debug_error.png")
                send_debug_photo("debug_error.png", f"❌ ERROR FATAL RPA:\\n{str(e)[:500]}")
            except:
                pass
            print("[RPA Banesco] Hubo un error fatal, marcamos la sesión como corrupta.")
            await manager.close_session()
            return False
            
        finally:
            manager.last_activity = time.time()
            print(f"[RPA Banesco] Sesión mantenida viva. Ultima actividad: {manager.last_activity}")
            # Eliminado goto a Resumen.aspx para ahorrar 10-15 segundos muertos entre órdenes
            
    return True

import json

ACCOUNTS_STATE_FILE = os.path.join(os.path.dirname(__file__), "accounts_state.json")

def get_accounts_state():
    if not os.path.exists(ACCOUNTS_STATE_FILE):
        return {}
    try:
        with open(ACCOUNTS_STATE_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_accounts_state(state):
    try:
        with open(ACCOUNTS_STATE_FILE, "w") as f:
            json.dump(state, f, indent=4)
    except Exception as e:
        print(f"[RPA BANESCO] Error guardando estado de cuentas: {e}")

def get_all_configured_accounts():
    cuentas = []
    # Expandimos a 6 cuentas
    for i in range(1, 7):
        user = os.getenv(f"BANESCO_USER_{i}", "").strip()
        passw = os.getenv(f"BANESCO_PASS_{i}", "").strip()
        
        g_user = os.getenv(f"GMAIL_USER_{i}", "").strip() or os.getenv("GMAIL_USER", "").strip()
        g_pass = os.getenv(f"GMAIL_APP_PASSWORD_{i}", "").strip() or os.getenv("GMAIL_APP_PASSWORD", "").strip()
        
        if user and passw:
            preguntas = {}
            for j in range(1, 9):
                q = os.getenv(f"BANESCO_SEC_Q{j}_{i}", "").strip().lower()
                a = os.getenv(f"BANESCO_SEC_A{j}_{i}", "").strip()
                if q and a:
                    preguntas[q] = a
            cuentas.append({"user": user, "pass": passw, "preguntas": preguntas, "gmail_user": g_user, "gmail_pass": g_pass})
    
    if not cuentas:
        user = os.getenv("BANESCO_USER", "").strip()
        passw = os.getenv("BANESCO_PASS", "") or os.getenv("BANESCO_PASSWORD", "")
        passw = passw.strip()
        
        g_user = os.getenv("GMAIL_USER", "").strip()
        g_pass = os.getenv("GMAIL_APP_PASSWORD", "").strip()
        
        if user and passw:
            preguntas = {}
            for j in range(1, 9):
                q = os.getenv(f"BANESCO_SEC_Q{j}", "").strip().lower()
                a = os.getenv(f"BANESCO_SEC_A{j}", "").strip()
                if q and a:
                    preguntas[q] = a
            cuentas.append({"user": user, "pass": passw, "preguntas": preguntas, "gmail_user": g_user, "gmail_pass": g_pass})
            
    return cuentas

def cargar_cuentas_banesco():
    todas = get_all_configured_accounts()
    estado = get_accounts_state()
    activas = []
    
    for cuenta in todas:
        val = estado.get(cuenta["user"], True)
        
        # Retrocompatibilidad: Si val es booleano, lo convertimos a dict por defecto
        if isinstance(val, bool):
            is_enabled = val
            min_val = 0
            max_val = 9999999
        else:
            is_enabled = val.get("enabled", True)
            min_val = val.get("min", 0)
            max_val = val.get("max", 9999999)
            
        if is_enabled:
            # Agregamos los límites a la cuenta que enviaremos al orquestador
            cuenta["min"] = min_val
            cuenta["max"] = max_val
            activas.append(cuenta)
            
    return activas

async def ejecutar_pago_banesco(cedula_destino, telefono_destino, cuenta_destino, monto_ves, banco_destino="0134", nombre_beneficiario="Pago", cuenta_asignada=None, is_test=False):
    if cuenta_asignada:
        cuentas = [cuenta_asignada]
    else:
        cuentas = cargar_cuentas_banesco()
    
    if not cuentas:
        print("[RPA BANESCO] No hay cuentas Banesco configuradas en el entorno.")
        return False
    
    print(f"[RPA BANESCO] {len(cuentas)} cuenta(s) Banesco configurada(s).")
    
    for idx, cuenta in enumerate(cuentas):
        print(f"\\n[RPA BANESCO] === Intentando con cuenta {idx+1}/{len(cuentas)}: {cuenta['user']} ===")
        
        resultado = await iniciar_sesion_banesco(
            cedula_destino, telefono_destino, cuenta_destino, monto_ves,
            banco_destino, nombre_beneficiario, cuenta["user"], cuenta["pass"], cuenta["preguntas"] or None,
            gmail_user=cuenta.get("gmail_user"), gmail_pass=cuenta.get("gmail_pass"),
            is_test=is_test
        )
        
        if resultado == "NO_FUNDS" and idx < len(cuentas) - 1:
            print(f"[RPA BANESCO] Fondos insuficientes en '{cuenta['user']}'. Probando siguiente cuenta en 2s...")
            await asyncio.sleep(2)
            continue
        elif resultado == "NO_FUNDS":
            print(f"[RPA BANESCO] Fondos insuficientes en TODAS las cuentas configuradas.")
            send_debug_photo("debug_exito.png", f"❌ TODAS las cuentas sin fondos suficientes para {monto_ves} VES")
            return False
        
        return resultado
    
    return False

async def cerrar_sesion_banesco():
    print("[RPA BANESCO] Orden de cierre explícito recibida desde el Orquestador. Cerrando Bóvedas y Navegadores activos...")
    for username, manager in session_managers.items():
        try:
            await manager.close_session()
        except Exception as e:
            print(f"[RPA Banesco - {username}] Error cerrando sesión: {e}")
    session_managers.clear()

if __name__ == "__main__":
    print("=== BANESCO RPA UNIT TEST ===")
    asyncio.run(ejecutar_pago_banesco("V12345678", "04140000000", "01340000000000000000", "50.00"))
