import os
import time
import hmac
import hashlib
import requests
import re
from urllib.parse import urlencode
from dotenv import load_dotenv

# Cargar variables de entorno (puedes crear un .env local para pruebas)
load_dotenv()

API_KEY = os.getenv('BINANCE_API_KEY', '')
API_SECRET = os.getenv('BINANCE_API_SECRET', '')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8204244360:AAEhBziF0jBMBcI91eVhreQd7uQ_IRi60-8')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '-1004472055488')

BASE_URL = 'https://api.binance.com'

# Cache en memoria para evitar multienvios de mensajes y multi-ejecuciones RPA
notified_orders = set()
processed_orders = set()

# Tiempo sincronizado con Binance
time_offset = 0

def sync_time():
    global time_offset
    try:
        res = requests.get(f"{BASE_URL}/api/v3/time")
        if res.status_code == 200:
            server_time = res.json().get('serverTime', 0)
            local_time = int(time.time() * 1000)
            time_offset = server_time - local_time
            print(f"[TIME SYNC] Sincronizado con Binance. Offset: {time_offset}ms")
    except Exception as e:
        print(f"[TIME SYNC ERROR] No se pudo sincronizar el tiempo: {e}")

def get_synced_timestamp():
    return int(time.time() * 1000) + time_offset

def get_signature(query_string):
    return hmac.new(
        API_SECRET.encode('utf-8'),
        query_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def dispatch_request(http_method, path, params):
    headers = {
        'X-MBX-APIKEY': API_KEY,
        'clientType': 'web'
    }
    query_string = urlencode(params)
    signature = get_signature(query_string)
    url = f"{BASE_URL}{path}?{query_string}&signature={signature}"
    
    if http_method == 'GET':
        response = requests.get(url, headers=headers)
    else:
        response = requests.post(url, headers=headers)
        
    return response

def scan_pending_buy_orders():
    if not API_KEY or not API_SECRET:
        print("[ERROR] Faltan Binance API Keys en el entorno.")
        return []

    params = {
        'tradeType': 'BUY',
        'orderStatus': 'PENDING',
        'page': 1,
        'rows': 50,
        'timestamp': get_synced_timestamp()
    }

    try:
        res = dispatch_request('GET', '/sapi/v1/c2c/orderMatch/listUserOrderHistory', params)
        data = res.json()
        if res.status_code == 200 and 'data' in data:
            all_orders = data['data']
            
            # Print de depuracion 
            if all_orders:
                print(f"[DEBUG_SAPI] Extraidas {len(all_orders)} ordenes historicas. Evaluando estado vivo...")
                debug_states = {o.get('orderNumber'): o.get('orderStatus') for o in all_orders[:3]}
                print(f"[DEBUG_SAPI] Ultimos 3 estados detectados: {debug_states}")

            # FILTRO CRITICO DE SEGURIDAD (Python local)
            # Aceptamos variantes crudas de PENDING para mapear la version exacta de la V7.4 + BUYER_PAYED (Sandboxing Banesco)
            # EXCEPCIÓN QUIRÚRGICA: Orden de Pruebas 22871568381450833920 (COMPLETED) se escanea como override estricto.
            pending_orders = [
                o for o in all_orders 
                if str(o.get('orderStatus')).upper() in ['PENDING', 'PROCESSING', '1', '2', 'TRADING', 'BUYER_PAYED']
                   or str(o.get('orderNumber')) == '22871568381450833920'
            ]
            
            return pending_orders
        else:
            print(f"[API ERROR] listUserOrderHistory: {data}")
            return []
    except Exception as e:
        print(f"[EXCEPTION] Fallo la extraccion de ordenes: {e}")
        return []

def extract_chat_messages(order):
    order_no = order.get('orderNumber')
    
    params = {
        'orderNo': order_no,
        'page': 1,
        'rows': 20,
        'timestamp': get_synced_timestamp()
    }

    path = '/sapi/v1/c2c/chat/retrieveChatMessagesWithPagination'

    try:
        res = dispatch_request('GET', path, params)
        data = res.json()
        
        if res.status_code == 200 and 'data' in data:
            messages = data['data']
            print(f"[CHAT LECTURA] Orden {order_no}: {len(messages)} mensajes obtenidos desde el Endpoint Real.")
            
            # Combine all message bodies to parse with regex
            combined_text = " ".join([m.get('content', '') for m in messages])
            parse_payment_data(combined_text, order)
        else:
            print(f"[CHAT DENEGADO] Code: {data.get('code')} - Msg: {data.get('msg')}")
    except Exception as e:
        print(f"[API ERROR] Falla local solicitando el chat de {order_no}. HTTP Error: {e}")

def parse_payment_data(chat_text, order):
    order_no = order.get('orderNumber')
    monto_ves = order.get('totalPrice')
    
    if not chat_text:
        return

    # REGEX Avanzado para Cédula, Telefono y Cuenta
    # Sub-rutina inteligente para evadir falsos positivos con letras comunes (v, e)
    cedula_cruda = ""
    match_kw = re.search(r'(?:c[eé]dula|c\.?i\.?|identidad)\s*(?:es|:|-)?\s*[A-Za-z-]*\s*([\d\.]+)', chat_text, re.IGNORECASE)
    if match_kw:
        cedula_cruda = match_kw.group(1).replace('.', '').replace(' ', '')
    else:
        match_vp = re.search(r'\b[vVjJeEpP][-:\s]+([\d\.]+)\b', chat_text)
        if match_vp:
            cedula_cruda = match_vp.group(1).replace('.', '').replace(' ', '')
            
    cedula = cedula_cruda if 6 <= len(cedula_cruda) <= 9 else "No detectada"

    phone_match = re.search(r'(?:tlf|tel[ée]fono|pago|m[oó]vil|celular)[^\d]*((?:0414|0424|0412|0416|0426)\d{7})', chat_text, re.IGNORECASE)
    if not phone_match:
        # Fallback para telefonos aislados sin texto previo
        phone_match = re.search(r'\b(?:0414|0424|0412|0416|0426)[-.\s]*\d{7}\b', chat_text)
        
    telefono = phone_match.group(0).replace('-', '').replace('.', '').replace(' ', '') if phone_match else "No detectado"
    
    acc_match = re.search(r'(?:0134)[\s-]*\d{4}[\s-]*\d{4}[\s-]*\d{4}[\s-]*\d{4}', chat_text)
    cuenta = acc_match.group(0).replace('-', '').replace(' ', '') if acc_match else "No detectada"

    if cedula != "No detectada" or telefono != "No detectado" or cuenta != "No detectada":
        if order_no in processed_orders:
             return
        processed_orders.add(order_no)
             
        print(f"\n[💡 PATRÓN DETECTADO] Orden: {order_no}")
        print(f" > Cédula : {cedula}")
        print(f" > Tlf    : {telefono}")
        print(f" > CTA    : {cuenta}")
        send_telegram_alert(order_no, cedula, telefono, cuenta)

        # INYECCIÓN RPA BANESCO
        # Solo operaremos Banesco automaticamente (CTA empieza con 0134)
        if cuenta != "No detectada" and cuenta.startswith("0134"):
            import asyncio
            from banesco_rpa import ejecutar_pago_banesco
            try:
                # Disparamos la hebra asincrona de Playwright para ejecutar el pago real
                asyncio.run(ejecutar_pago_banesco(cedula, telefono, cuenta, monto_ves))
            except Exception as rpa_e:
                print(f"[RPA CORE EXCEPTION] {rpa_e}")
                
def send_telegram_alert(order_no, cedula, telefono, cuenta):
    # Validacion Anti-Spam: Solo enviar a Telegram la 1ra vez que se arma esta orden
    if order_no in notified_orders:
        return
        
    global TELEGRAM_CHAT_ID
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
        
    # Auto-format chat ID to include -100 prefix if missing
    chat_id = str(TELEGRAM_CHAT_ID).strip()
    if chat_id.startswith("-") and not chat_id.startswith("-100"):
        chat_id = f"-100{chat_id[1:]}"
        
    notified_orders.add(order_no)
        
    msg = (
         f"🚨 *DATOS DE PAGO DETECTADOS*\n\n"
         f"*Orden P2P:* `{order_no}`\n"
         f"*Cédula:* `{cedula}`\n"
         f"*Teléfono:* `{telefono}`\n"
         f"*Cuenta Banesco:* `{cuenta}`\n\n"
         f"🤖 _Fase de Extracción Completada. Esperando RPA Banesco..._"
     )
     
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
         'chat_id': chat_id,
         'text': msg,
         'parse_mode': 'Markdown'
     }
     
    try:
         res = requests.post(url, json=payload)
         if res.status_code == 200:
             print(f"[TELEGRAM] Alerta despachada para orden {order_no}")
         else:
             print(f"[TELEGRAM ERROR] status={res.status_code}, response={res.text}")
    except Exception as e:
         print(f"[TELEGRAM ERROR] No se pudo enviar el mensaje: {e}")

def main():
    print("=== BINANCE P2P AUTO-PAY BOT (FASE 1: LECTURA) INICIADO ===")
    sync_time() # Sincronizar tiempo al inicio
    while True:
        try:
            print("[Auto-Pay] Escaneando ordenes PENDING en BUY...")
            active_orders = scan_pending_buy_orders()
            if active_orders:
                for order in active_orders:
                    order_no = order.get('orderNumber')
                    if order_no:
                        # Leemos el chat inyectando la orden completa (Capa 2 Option B)
                        extract_chat_messages(order)
            else:
                print("[Auto-Pay] Sin ordenes activas nuevas.")
        except Exception as e:
            print(f"[CRITICAL] Bucle principal fallo: {e}")
            
        # Dormir 15 segundos para no saturar los Weight Limits de la API
        time.sleep(15)

if __name__ == "__main__":
    main()
