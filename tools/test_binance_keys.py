"""
🔑 Validador de API Keys de Binance
Uso:
  python test_binance_keys.py API_KEY API_SECRET
  
Ejemplo:
  python test_binance_keys.py abc123 xyz789

Solo hace una consulta de lectura (permisos de cuenta), no toca nada.
"""
import sys
import time
import hmac
import hashlib
import requests
from urllib.parse import urlencode

def test_keys(api_key, api_secret):
    base_url = "https://api.binance.com"
    
    # 1. Test básico de conectividad
    print("\n🔍 Paso 1: Probando conectividad con Binance...")
    try:
        r = requests.get(f"{base_url}/api/v3/ping", timeout=10)
        if r.status_code == 200:
            print("   ✅ Binance accesible")
        else:
            print(f"   ❌ Binance respondió con código {r.status_code}")
            return
    except Exception as e:
        print(f"   ❌ No se pudo conectar a Binance: {e}")
        return

    # 2. Test de autenticación (consulta de permisos de la API key)
    print("🔐 Paso 2: Validando API Key y Secret...")
    
    params = {
        "timestamp": int(time.time() * 1000)
    }
    query_string = urlencode(params)
    signature = hmac.new(
        api_secret.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    headers = {"X-MBX-APIKEY": api_key}
    url = f"{base_url}/sapi/v1/account/apiRestrictions?{query_string}&signature={signature}"
    
    try:
        r = requests.get(url, headers=headers, timeout=10)
        data = r.json()
        
        if r.status_code == 200:
            print("   ✅ API Key VÁLIDA\n")
            print("   📋 Permisos detectados:")
            permisos = {
                "enableReading": "📖 Lectura",
                "enableSpotAndMarginTrading": "💱 Spot Trading",
                "enableWithdrawals": "💸 Retiros",
                "enableFutures": "📊 Futuros",
                "enableP2P": "🤝 P2P (C2C)",
                "enableInternalTransfer": "🔄 Transferencias internas",
            }
            for key, label in permisos.items():
                val = data.get(key)
                if val is True:
                    print(f"      {label}: ✅ Habilitado")
                elif val is False:
                    print(f"      {label}: ❌ Deshabilitado")
            
            # IP whitelist
            ip_restrict = data.get("ipRestrict", False)
            if ip_restrict:
                print(f"\n   🌐 Restricción por IP: ⚠️  ACTIVADA (solo funciona desde IPs autorizadas)")
            else:
                print(f"\n   🌐 Restricción por IP: Sin restricción")
                
            print(f"\n   ✅ RESULTADO: Las keys son correctas y funcionales.")
            
            # Advertencias para P2P
            if not data.get("enableP2P"):
                print("   ⚠️  ADVERTENCIA: El permiso P2P NO está habilitado. El auto-pay-bot lo necesita.")
                
        elif r.status_code == 401 or data.get("code") == -2015:
            print("   ❌ API Key INVÁLIDA o Secret INCORRECTO")
            print(f"   Mensaje: {data.get('msg', 'Invalid API-key, IP, or permissions')}")
            
        elif data.get("code") == -1022:
            print("   ❌ Signature INVÁLIDA (el API Secret está mal)")
            print(f"   Mensaje: {data.get('msg')}")
            
        elif data.get("code") == -2008:
            print("   ❌ API Key no reconocida por Binance")
            print(f"   Mensaje: {data.get('msg')}")
            
        else:
            print(f"   ❌ Error inesperado (HTTP {r.status_code})")
            print(f"   Respuesta: {data}")
            
    except Exception as e:
        print(f"   ❌ Error en la solicitud: {e}")

    print("")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        print("❌ Debes pasar exactamente 2 argumentos: API_KEY y API_SECRET")
        print("   Ejemplo: python test_binance_keys.py TuApiKey TuApiSecret\n")
        sys.exit(1)
    
    api_key = sys.argv[1].strip()
    api_secret = sys.argv[2].strip()
    
    print("=" * 55)
    print("  🔑 VALIDADOR DE API KEYS - BINANCE")
    print("=" * 55)
    print(f"  Key:    {api_key[:8]}...{api_key[-4:]}")
    print(f"  Secret: {api_secret[:4]}...{api_secret[-4:]}")
    
    test_keys(api_key, api_secret)
