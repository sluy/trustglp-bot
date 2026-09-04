import imaplib
import email
import re
import asyncio
import os
from email.header import decode_header
import datetime

async def obtener_clave_gmail(timeout=60, gmail_user=None, gmail_pass=None):
    user = (gmail_user or os.getenv("GMAIL_USER") or "").strip()
    password = (gmail_pass or os.getenv("GMAIL_APP_PASSWORD") or "").strip()
    
    if not user or not password:
        print("[RPA Banesco] No hay credenciales IMAP configuradas para leer la clave especial.")
        return None
        
    print(f"[RPA Banesco] Esperando Clave de Operaciones Especiales en {user}...")
    
    # Try multiple times until timeout
    for _ in range(timeout // 5):
        try:
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(user, password)
            status, response = mail.select("inbox")
            if status != "OK":
                continue
                
            total_msgs = int(response[0])
            if total_msgs == 0:
                mail.logout()
                continue
                
            # Extraer los últimos 50 correos por índice directo (Sigue siendo instantáneo y evita que se quede corto si llegan 15 correos de golpe)
            start_msg = max(1, total_msgs - 49)
            status, msg_data = mail.fetch(f"{start_msg}:{total_msgs}", "(RFC822)")
            
            if status == "OK" and msg_data:
                clave_encontrada = None
                correos_a_borrar = []
                
                # Iterar en reversa (del más nuevo al más viejo)
                for response_part in reversed(msg_data):
                    if isinstance(response_part, tuple):
                        # Extract message number for deletion (format: b'123 (RFC822 {size})')
                        msg_info = response_part[0].decode('utf-8').split()
                        num = msg_info[0]
                        
                        msg = email.message_from_bytes(response_part[1])
                        
                        subject_raw = msg.get("Subject", "")
                        subject = ""
                        if subject_raw:
                            decoded = decode_header(subject_raw)
                            for part, encoding in decoded:
                                if isinstance(part, bytes):
                                    try:
                                        subject += part.decode(encoding if encoding else "utf-8")
                                    except LookupError:
                                        subject += part.decode("utf-8", errors='ignore')
                                else:
                                    subject += str(part)
                        
                        subject_lower = subject.lower()
                        sender = msg.get("From", "").lower()
                        
                        if "banesco" not in sender and "banesco" not in subject_lower:
                            continue
                            
                        if "clave" in subject_lower or "operaciones especiales" in subject_lower:
                            correos_a_borrar.append(num) # Anotamos para borrar después y limpiar bandeja
                            
                            if clave_encontrada:
                                continue # Ya tenemos la clave, solo seguimos para recolectar IDs viejos a borrar
                                
                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    if part.get_content_type() == "text/plain":
                                        body = part.get_payload(decode=True).decode(errors='ignore')
                                        break
                                    elif part.get_content_type() == "text/html":
                                        body = part.get_payload(decode=True).decode(errors='ignore')
                            else:
                                body = msg.get_payload(decode=True).decode(errors='ignore')
                            
                            # Limpiar etiquetas HTML
                            clean_body = re.sub(r'<[^>]+>', '', body)
                            
                            # Extraer codigo
                            match_especifico = re.search(r'es:\s*([A-Za-z0-9]{6,10})', clean_body, re.IGNORECASE)
                            if match_especifico:
                                clave_encontrada = match_especifico.group(1)
                            else:
                                match_numerico = re.search(r'\b\d{6,8}\b', clean_body)
                                if match_numerico:
                                    clave_encontrada = match_numerico.group(0)
                                else:
                                    matches = re.findall(r'\b[A-Za-z0-9]{6,10}\b', clean_body)
                                    for match in matches:
                                        if match.isupper() or match.isdigit():
                                            clave_encontrada = match
                                            break
                
                # Una vez encontrada la clave y recolectados los IDs, borramos todos los OTPs leídos en este batch
                if clave_encontrada:
                    for n in correos_a_borrar:
                        mail.store(n, '+FLAGS', '\\Deleted')
                    mail.expunge() # Ejecuta el borrado final de la bandeja
                    mail.logout()
                    print(f"[RPA Banesco] Clave obtenida en TIEMPO RECORD de GMAIL: {clave_encontrada}")
                    return clave_encontrada
                                        
            mail.logout()
        except Exception as e:
            print(f"[RPA Banesco] Error IMAP: {e}")
            
        await asyncio.sleep(5)
        
    return None
