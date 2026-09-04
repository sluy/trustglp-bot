import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

async def main():
    async with async_playwright() as p:
        print("Lanzando navegador...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        await stealth_async(page)

        print("Navegando a Bancamiga Online con parametro p=1...")
        try:
            await page.goto("https://online.bancamiga.com/?p=1", timeout=25000)
            await asyncio.sleep(5) # Wait for page to render
        except Exception as e:
            print(f"Error goto: {e}")
            
        await page.screenshot(path="bancamiga_home.png")
        html_content = await page.content()
        with open("bancamiga_home.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        print("Captura HTML y PNG guardada.")
        
        await browser.close()

asyncio.run(main())
