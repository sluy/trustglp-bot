import os

code = r'''import os
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

def send_debug_photo(photo_path, caption):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
        
    # Auto-format chat ID to include -100 prefix if missing
    chat_id = str(TELEGRAM_CHAT_ID).strip()
    if chat_id.startswith("-") and not chat_id.startswith("-100"):
        chat_id = f"-100{chat_id[1:]}"
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    try:
        with open(photo_path, 'rb') as f:
            res = requests.post(url, data={'chat_id': chat_id, 'caption': caption[:1024]}, files={'photo': f})
            if res.status_code != 200:
                print(f"[TELEGRAM PHOTO ERROR] status={res.status_code}, response={res.text}")
    except Exception as e:
        print(f"[TELEGRAM PHOTO ERROR] {e}")

BANESCO_USUARIO = os.getenv("BANESCO_USER", "")
BANESCO_CLAVE = os.getenv("BANESCO_PASS", "")

class BanescoSessionManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.lock = asyncio.Lock()
            cls._instance.playwright = None
            cls._instance.browser = None
            cls._instance.context = None
            cls._instance.page = None
            cls._instance.last_activity = 0
            cls._instance.current_user = None
        return cls._instance

    async def close_session(self):
        print("[RPA Banesco] Cerrando sesión y destruyendo navegador...")
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

manager = BanescoSessionManager()

async def iniciar_sesion_banesco(cedula_destino, telefono_destino, cuenta_destino, monto_ves, banco_destino="0134", usuario=None, clave=None, preguntas_seguridad=None):
    banesco_user = usuario or BANESCO_USUARIO
    banesco_pass = clave or BANESCO_CLAVE
    
    print(f"\\n=======================================================")
    print(f"[🏦 BANESCO RPA] EJECUCION DE TRANSFERENCIA INICIADA")
    print(f" > Cuenta Origen   : {banesco_user}")
    print(f" > Cuenta Destino  : {cuenta_destino}")
    print(f" > Cedula Benefici : {cedula_destino}")
    print(f" > Monto Exacto    : {monto_ves} VES")
    print(f"=======================================================\\n")
    
    if not banesco_user or not banesco_pass:
        print("[ERROR RPA] Credenciales de Banesco no configuradas en el .env")
        return False
        
    async with manager.lock:
        now = time.time()
        # Verificar inactividad
        if manager.page and (now - manager.last_activity > 480 or manager.current_user != banesco_user):
            print("[RPA Banesco] Sesión inactiva por >8 min o cambio de usuario. Reiniciando.")
            await manager.close_session()
            
        needs_login = False
        if manager.page is None:
            needs_login = True
        else:
            # Check si nos botaron
            try:
                url = manager.page.url
                if "about:blank" in url or "Login.aspx" in url or "CierreSesion.aspx" in url:
                    needs_login = True
            except:
                needs_login = True
                
        if needs_login:
            await manager.close_session()
            print("[RPA Banesco] Lanzando navegador...")
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
                print("[RPA Banesco] Accediendo a la boveda web...")
                await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", timeout=60000)
                print("[RPA Banesco] Portal cargado. Buscando inputs en el IFrame de seguridad Mantis...")
                await asyncio.sleep(2)
                
                await page.screenshot(path="debug_login.png")
                send_debug_photo("debug_login.png", "🤖 RPA Banesco: Portal Cargado (Reconocimiento IFrame Inicial)")
                
                b_frame = page.frame_locator("iframe, frame").last
                print("[RPA Banesco] IFrame interceptado. Aguardando render interno...")
                await asyncio.sleep(6)
                
                input_usuario = b_frame.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="password"])').first
                await input_usuario.fill(banesco_user, force=True)
                
                btn_aceptar = b_frame.locator('button:has-text("Aceptar"), input[type="submit"][value*="Aceptar" i], a:has-text("Aceptar")').first
                await btn_aceptar.click(force=True)
                
                print("[RPA Banesco] Evaluando bifurcacion de seguridad anti-bot...")
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(3)
                
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
                        await page.wait_for_load_state("networkidle")
                        await asyncio.sleep(3)
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
                await page.wait_for_load_state("networkidle")
                
                await asyncio.sleep(6)
                
                await page.screenshot(path="debug_exito.png")
                send_debug_photo("debug_exito.png", "🤑 ¡Infiltración Exitosa en HomeBanking!")
                print("[RPA Banesco] 🤑 ¡Infiltración Exitosa! Estamos dentro del HomeBanking.")
            else:
                print("[RPA Banesco] Sesión Activa Detectada. Saltando flujo de Login.")

            print("[RPA Banesco] Escaneando Balance Disponible...")
            await asyncio.sleep(4) 
            
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
                 
            print("[RPA Banesco] Motor Dual Iniciado: Disparando URL Injection JS...")
            
            try:
                await page.evaluate("window.location.href = 'https://www.banesconline.com/Mantis/WebSite/transferencias/tercerosbanesco.aspx'")
            except Exception as e:
                print(f"[RPA Banesco] JS Fallo: {e}")
            
            await asyncio.sleep(6)
            
            action_frame = page 
            print("[RPA Banesco] Evaluando Visión Renderizada de 'A DEBITAR'...")
            pagina_alcanzada = False
            
            for _ in range(4):
                try:
                    body_text_main = await page.locator("body").inner_text()
                    if "A DEBITAR" in body_text_main.upper() or "ESTA OPCIÓN LE PERMITE" in body_text_main.upper():
                        action_frame = page
                        pagina_alcanzada = True
                        break
                    else:
                        frame_count = await page.locator("iframe, frame").count()
                        for i in range(frame_count):
                            f_can = page.frame_locator("iframe, frame").nth(i)
                            try:
                                body_text_iframe = await f_can.locator("body").inner_text()
                                if "A DEBITAR" in body_text_iframe.upper() or "ESTA OPCIÓN LE PERMITE" in body_text_iframe.upper():
                                    action_frame = f_can
                                    pagina_alcanzada = True
                                    break
                            except:
                                pass
                except:
                    pass
                
                if pagina_alcanzada:
                    break
                await asyncio.sleep(2)
                
            if not pagina_alcanzada:
                print("[RPA Banesco] URL Injection neutralizada por ASP.NET. Activando Native DOM JS Override...")
                try:
                    js_transf = """
                        let cls = Array.from(document.querySelectorAll('a, span, td'));
                        let cbtn = cls.find(e => e.innerText && e.innerText.trim() === 'Transferencias');
                        if (cbtn) { cbtn.focus(); cbtn.click(); }
                    """
                    await page.evaluate(f"() => {{ {js_transf} }}")
                    await asyncio.sleep(4)
                    
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
                    await asyncio.sleep(6)
                    
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
                        await asyncio.sleep(2)
                except Exception as ex_kb:
                    print(f"[RPA Banesco] Falla en DOM Override: {ex_kb}")
                
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
                    await page.wait_for_load_state("load", timeout=12000)
                except:
                    pass
                await asyncio.sleep(6)
            except Exception as se:
                print(f"[RPA Banesco] Select-Debit AJAX warning: {se}")
                 
            print("[RPA Banesco] Geometría del Formulario Detectada. Llenando campos...")
            
            selects = action_frame.locator("select:visible")
            text_inputs = action_frame.locator('input[type="text"]:visible')
            
            inputs_listos = False
            for _ in range(8):
                 if await text_inputs.count() >= 3:
                     inputs_listos = True
                     break
                 await asyncio.sleep(2)
                 text_inputs = action_frame.locator('input[type="text"]:visible')
                 
            if not inputs_listos:
                 print("[RPA BANESCO FATAL] El formulario de destino (Monto, Cédula) no se reveló tras el Postback.")
                 await page.screenshot(path="debug_ajax_error.png")
                 send_debug_photo("debug_ajax_error.png", "❌ [RPA ERROR] AJAX Fallido u Oculto.")
                 return False
            
            letra_cedula = "V"
            ced_limpia = cedula_destino.replace("-", "").replace(" ", "")
            numero_cedula = ced_limpia
            
            if len(ced_limpia) > 0 and ced_limpia[0].upper() in ["V", "E", "J", "P", "G"]:
                 letra_cedula = ced_limpia[0].upper()
                 numero_cedula = ced_limpia[1:]
                 
            text_inputs = action_frame.locator('input[type="text"]:visible')
            await text_inputs.nth(0).fill(cuenta_destino, force=True)
            
            if await selects.count() > 1:
                try:
                    await selects.nth(1).select_option(label=letra_cedula, force=True)
                except Exception as se2:
                    await selects.nth(1).select_option(value=letra_cedula, force=True)
            
            await text_inputs.nth(1).fill(numero_cedula, force=True)
            
            monto_str = str(monto_ves).replace(".", ",")
            await text_inputs.nth(2).fill(monto_str, force=True)
            
            await text_inputs.nth(3).fill("Pago", force=True)
            
            await page.screenshot(path="debug_form_lleno.png")
            send_debug_photo("debug_form_lleno.png", "📝 Formulario completado matemáticamente. Listo para Aceptar.")
            
            print("[RPA Banesco] Ejecutando transferencia en Bóveda...")
            btn_aceptar_trans = action_frame.locator('button:has-text("Aceptar"), input[type="submit"][value*="Aceptar" i], input[type="button"][value*="Aceptar" i], a:has-text("Aceptar")').first
            await btn_aceptar_trans.click(force=True)
            
            print("[RPA Banesco] Detectando Modal de Confirmación...")
            try:
                await page.locator('text="seguro de realizar esta"').or_(action_frame.locator('text="seguro de realizar esta"')).wait_for(timeout=8000)
                print("[RPA Banesco] Modal superpuesto interceptado. Dando foco...")
                await asyncio.sleep(1)
            except Exception as modal_e:
                print("[RPA Banesco] (Warning) No detecté texto literal del modal, esperamos 2 seg ciegos por si acaso...")
                await asyncio.sleep(2)
                
            print("[RPA Banesco] Inyectando Enter para el Modal...")
            await page.keyboard.press("Enter")
            await asyncio.sleep(2)
            
            try:
                js_click = """() => {
                    const btns = Array.from(document.querySelectorAll('input, button, a'));
                    const aceptarBtn = btns.find(el => (el.value || el.innerText || "").toLowerCase().includes("aceptar") && el.offsetParent !== null);
                    if(aceptarBtn) aceptarBtn.click();
                }"""
                await action_frame.evaluate(js_click)
                await page.evaluate(js_click)
            except:
                pass
            
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(5)
            
            print("[RPA Banesco] Detectando Pantalla de Confirmación (Full Page)...")
            try:
                await action_frame.locator('text="confirmar que los datos ingresados"').wait_for(timeout=8000)
                print("[RPA Banesco] Pantalla de Confirmación detectada. Inyectando Enter...")
                
                await asyncio.sleep(1)
                await page.keyboard.press("Enter")
                await asyncio.sleep(2)
                
                try:
                    await action_frame.evaluate(js_click)
                    await page.evaluate(js_click)
                except:
                    pass
                
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(5)
            except Exception as conf_page_e:
                print("[RPA Banesco] (Ignorable) No apareció pantalla de confirmación completa, quizas fuimos directo al OTP o Recibo.")
                
            clave_input = action_frame.locator('input[type="password"], input[type="text"]').filter(has_text="")
            texto_clave = action_frame.locator('text="Clave de Operaciones Especiales", text="Ingrese la clave enviada"')
            if await texto_clave.count() > 0 or await action_frame.locator('text="enviada a su correo"').count() > 0:
                print("[RPA Banesco] 🔐 ¡Banesco pide Clave de Operaciones Especiales! Leyendo Gmail...")
                send_debug_photo("debug_esperando_clave.png", "⏳ Banesco está pidiendo la Clave de Operaciones Especiales enviada al correo/SMS. Intentando extraerla automáticamente...")
                
                clave_otp = await obtener_clave_gmail(timeout=60)
                if clave_otp:
                    input_otp = action_frame.locator('input[type="password"], input[type="text"]:not([readonly])').first
                    await input_otp.fill(clave_otp, force=True)
                    
                    btn_aceptar_otp = action_frame.locator('button:has-text("Aceptar"):visible, input[type="submit"][value*="Aceptar" i]:visible, input[type="button"][value*="Aceptar" i]:visible, a:has-text("Aceptar"):visible').first
                    await btn_aceptar_otp.click(force=True)
                    print("[RPA Banesco] Clave de Operaciones enviada a Banesco.")
                    await page.wait_for_load_state("networkidle")
                    await asyncio.sleep(5)
                else:
                    print("[RPA Banesco] ❌ No se pudo extraer la clave OTP a tiempo. Operación Abortada.")
                    send_debug_photo("debug_otp_fail.png", "❌ No se pudo extraer la Clave Especial del correo.")
                    return False

            try:
                await action_frame.locator("body").screenshot(path="debug_recibo.png")
            except:
                await page.screenshot(path="debug_recibo.png")
                
            send_debug_photo("debug_recibo.png", "✅ Operación Sometida Definitiva (Recibo Final/Comprobante de Banesco)")
            print("[RPA Banesco] Transferencia completada. Recibo final enviado a Telegram para escrutinio.")
            
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
            try:
                if manager.page:
                    await manager.page.goto("https://www.banesconline.com/Mantis/WebSite/Resumen.aspx", timeout=10000)
            except:
                pass
            
    return True

def cargar_cuentas_banesco():
    cuentas = []
    for i in range(1, 4):
        user = os.getenv(f"BANESCO_USER_{i}", "").strip()
        passw = os.getenv(f"BANESCO_PASS_{i}", "").strip()
        if user and passw:
            preguntas = {}
            for j in range(1, 9):
                q = os.getenv(f"BANESCO_SEC_Q{j}_{i}", "").strip().lower()
                a = os.getenv(f"BANESCO_SEC_A{j}_{i}", "").strip()
                if q and a:
                    preguntas[q] = a
            cuentas.append({"user": user, "pass": passw, "preguntas": preguntas})
    
    if not cuentas:
        user = os.getenv("BANESCO_USER", "").strip()
        passw = os.getenv("BANESCO_PASS", "") or os.getenv("BANESCO_PASSWORD", "")
        passw = passw.strip()
        if user and passw:
            preguntas = {}
            for j in range(1, 9):
                q = os.getenv(f"BANESCO_SEC_Q{j}", "").strip().lower()
                a = os.getenv(f"BANESCO_SEC_A{j}", "").strip()
                if q and a:
                    preguntas[q] = a
            cuentas.append({"user": user, "pass": passw, "preguntas": preguntas})
    
    return cuentas

async def ejecutar_pago_banesco(cedula_destino, telefono_destino, cuenta_destino, monto_ves, banco_destino="0134"):
    cuentas = cargar_cuentas_banesco()
    
    if not cuentas:
        print("[RPA BANESCO] No hay cuentas Banesco configuradas en el entorno.")
        return False
    
    print(f"[RPA BANESCO] {len(cuentas)} cuenta(s) Banesco configurada(s).")
    
    for idx, cuenta in enumerate(cuentas):
        print(f"\\n[RPA BANESCO] === Intentando con cuenta {idx+1}/{len(cuentas)}: {cuenta['user']} ===")
        
        resultado = await iniciar_sesion_banesco(
            cedula_destino, telefono_destino, cuenta_destino, monto_ves,
            banco_destino, cuenta["user"], cuenta["pass"], cuenta["preguntas"] or None
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

if __name__ == "__main__":
    print("=== BANESCO RPA UNIT TEST ===")
    asyncio.run(ejecutar_pago_banesco("V12345678", "04140000000", "01340000000000000000", "50.00"))
'''

with open("services/auto-pay-bot/banesco_rpa.py", "w", encoding="utf-8") as f:
    f.write(code)
