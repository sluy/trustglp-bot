import imaplib
import email
from email.header import decode_header
import os
from dotenv import load_dotenv
import re

import time

user = "pagoscreatuimperiodigital@gmail.com"
password = "ybfcaftkouxzkifu"

print(f"Connecting to IMAP as {user}...")

start_time = time.time()

print(f"Connecting to IMAP as {user}...")

try:
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(user, password)
    status, response = mail.select("inbox")
    
    total_msgs = int(response[0])
    print(f"Total messages in inbox: {total_msgs}")
    
    start_msg = max(1, total_msgs - 50)
    print(f"Fetching messages from {start_msg} to {total_msgs}...")
    
    status, msg_data = mail.fetch(f"{start_msg}:{total_msgs}", "(RFC822)")
    
    count = 0
    if status == "OK" and msg_data:
        for response_part in reversed(msg_data):
            if isinstance(response_part, tuple):
                count += 1
                msg = email.message_from_bytes(response_part[1])
                sender = msg.get("From", "")
                
                subject, encoding = decode_header(msg["Subject"])[0]
                if isinstance(subject, bytes):
                    try:
                        subject = subject.decode(encoding if encoding else "utf-8")
                    except LookupError:
                        subject = subject.decode("utf-8", errors='ignore')
                
                if count <= 20: # Only print first 20 to avoid spamming the console
                    print(f"[{count}] From: {sender} | Subject: {subject}")
                
                if "Notificacion@banesco.com" in sender and ("Clave" in subject or "Operaciones Especiales" in subject):
                    print(">>> FOUND TARGET EMAIL!")
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
                    
                    clean_body = re.sub(r'<[^>]+>', '', body)
                    match = re.search(r'es:\s*([A-Za-z0-9]{6,10})', clean_body, re.IGNORECASE)
                    if match:
                        print(f">>> OTP EXTRACTED: {match.group(1)}")
                    else:
                        print(">>> OTP NOT EXTRACTED. Body preview:")
                        print(clean_body[:500])
                    break
                    
    mail.logout()
except Exception as e:
    print(f"Error: {e}")

end_time = time.time()
elapsed = end_time - start_time
print(f"\n==========================================")
print(f"TOTAL EXTRACTION TIME: {elapsed:.2f} seconds")
print(f"==========================================")
