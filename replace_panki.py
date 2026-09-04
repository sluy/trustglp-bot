import os
import re

extensions = ['.ts', '.tsx', '.md', '.env.example', '.css', '.html', '.json', '.js', '.py']

for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or '.next' in root or '__pycache__' in root:
        continue
    for file in files:
        if any(file.endswith(ext) for ext in extensions) or file == 'Dockerfile':
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # replacements
                new_content = content.replace('Telecambios VE', 'Telecambios VE')
                new_content = new_content.replace('telecambios-ve', 'telecambios-ve')
                new_content = new_content.replace('TelecambiosVe', 'TelecambiosVe')
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated {filepath}")
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
