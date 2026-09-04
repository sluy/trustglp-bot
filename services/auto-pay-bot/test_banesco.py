import asyncio
from playwright.async_api import async_playwright
import json

async def run():
    print("[TEST] Levantando Chromium...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("[TEST] Navegando a BanescOnline Mantis...")
        await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", timeout=60000)
        await asyncio.sleep(5)  # Esperar renderizado React/Angular
        
        print("[TEST] Extrayendo mapa del DOM...")
        # Get all inputs
        inputs = await page.evaluate('''() => {
            return Array.from(document.querySelectorAll('input')).map(i => {
                return {
                    id: i.id,
                    name: i.name,
                    placeholder: i.placeholder,
                    type: i.type,
                    class: i.className,
                    visible: i.offsetWidth > 0 && i.offsetHeight > 0
                }
            });
        }''')
        
        # Get all frames
        frames = await page.evaluate('''() => {
            return Array.from(document.querySelectorAll('iframe, frame')).map(i => {
                return { id: i.id, src: i.src, name: i.name }
            });
        }''')
        
        print("\n--- INPUTS ENCONTRADOS ---")
        print(json.dumps(inputs, indent=2))
        
        print("\n--- IFRAMES ENCONTRADOS ---")
        print(json.dumps(frames, indent=2))
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
