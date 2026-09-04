import re

with open("services/auto-pay-bot/banesco_rpa.py", "r", encoding="utf-8") as f:
    code = f.read()

# Fix the 'try:' that was left dangling in my previous replace_file_content
code = code.replace("""            print("[RPA Banesco] Accediendo a la boveda web...")
        try:
            # Ir al login de BanescOnline
            await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", timeout=60000)""", """            print("[RPA Banesco] Accediendo a la boveda web...")
        
        page = manager.page
        try:
            if manager.page.url == "about:blank" or "Login.aspx" in manager.page.url:
                # Ir al login de BanescOnline
                await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", timeout=60000)""")

# Add the 'if needs_login' condition around the login block
login_start = """                # Ir al login de BanescOnline
                await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", timeout=60000)"""

login_end = """            print("[RPA Banesco] 🤑 ¡Infiltración Exitosa! Estamos dentro del HomeBanking.")"""

parts = code.split(login_start)
part_2_and_rest = parts[1].split(login_end)

login_block = login_start + part_2_and_rest[0] + login_end
new_login_block = ""
for line in login_block.split("\\n"):
    new_login_block += "    " + line + "\\n" # Indent by 4 spaces

replacement = """            needs_login = manager.page.url == "about:blank" or "Login.aspx" in manager.page.url or "CierreSesion.aspx" in manager.page.url
            if needs_login:
""" + new_login_block + """
            else:
                print("[RPA Banesco] Sesión Activa Reutilizada. Saltando Login.")
"""

code = code.replace(login_block, replacement)

# Replace the finally block that closes the browser
finally_block = """        finally:
            print("[RPA Banesco] Procediendo con Cierre de Sesión Seguro (Logout)...")
            try:
                # El boton salir en Mantis es un icono Arriba a la Derecha (Puerta con flecha)
                btn_salir = page.locator('*[title*="Salir" i], *[alt*="Salir" i]').first
                if await btn_salir.count() == 0 and await page.locator("iframe, frame").count() > 0:
                    btn_salir = page.frame_locator("iframe, frame").last.locator('*[title*="Salir" i], *[alt*="Salir" i]').first
                    
                if await btn_salir.count() > 0:
                    await btn_salir.click(force=True, timeout=5000)
                    print("[RPA Banesco] Logout exitoso. Sesión purgada.")
                    await asyncio.sleep(2)
            except Exception as logout_e:
                print(f"[RPA Banesco] (Ignorable) Falla durante el Cierre de Sesion: {logout_e}")
                
            await browser.close()"""

new_finally_block = """        finally:
            # En modo persistente NO cerramos sesión
            manager.last_activity = time.time()
            print(f"[RPA Banesco] Sesión mantenida viva. Ultima actividad: {manager.last_activity}")
            
            # Refrescar a la pagina principal para estar listos para la siguiente
            try:
                if manager.page:
                    await manager.page.goto("https://www.banesconline.com/Mantis/Website/Resumen.aspx", timeout=10000)
            except:
                pass"""

code = code.replace(finally_block, new_finally_block)

# Replace the general exception catcher to close session if it's a fatal UI error
exception_block = """        except Exception as e:
            print(f"[RPA EXCEPTION] Falla en la inyeccion de UI: {e}")
            try:
                await page.screenshot(path="debug_error.png")
                send_debug_photo("debug_error.png", f"❌ ERROR FATAL RPA:\\n{str(e)[:500]}")
            except:
                pass"""

new_exception_block = """        except Exception as e:
            print(f"[RPA EXCEPTION] Falla en la inyeccion de UI: {e}")
            try:
                await page.screenshot(path="debug_error.png")
                send_debug_photo("debug_error.png", f"❌ ERROR FATAL RPA:\\n{str(e)[:500]}")
            except:
                pass
            print("[RPA Banesco] Hubo un error fatal, marcamos la sesión como corrupta para que se reinicie en la prox")
            await manager.close_session()"""

code = code.replace(exception_block, new_exception_block)

# Fix a missing import in my previous edit
if "from gmail_otp import obtener_clave_gmail" in code:
    # it is already there, but inside the function.
    pass

with open("services/auto-pay-bot/banesco_rpa.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Refactorizado correctamente")
