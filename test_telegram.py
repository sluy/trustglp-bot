import requests

bot_token = '8204244360:AAEhBziF0jBMBcI91eVhreQd7uQ_IRi60-8'
chat_id_general = '-1004472055488'
chat_id_reports = '-1004302088476'

def send_message(chat_id, text):
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'
    }
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        print(f"Success! Message sent to {chat_id}")
    else:
        print(f"Failed to send to {chat_id}: {response.text}")

print("Testing General Chat...")
send_message(chat_id_general, "🟢 <b>Prueba General</b>: Este es un mensaje de prueba desde el sistema para verificar la conexión del bot al grupo general.")

print("\nTesting Reports Chat...")
send_message(chat_id_reports, "🔴 <b>Prueba de Reportes</b>: Este es un mensaje de prueba desde el sistema para verificar la conexión del bot al grupo de reportes.")
