import asyncio, json, os
from playwright.async_api import async_playwright

async def main():
 async with async_playwright() as playwright:
  browser = await playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  for w,h in [(390,740),(375,667),(430,800),(320,568)]:
   page = await browser.new_page(viewport={'width':w,'height':h}, device_scale_factor=1, is_mobile=True, has_touch=True)
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   import re
   from pathlib import Path
   root=Path(__file__).resolve().parents[1]
   html=re.sub(r'<script src=\"(?:audio|icons|app)\.js\" defer></script>','', (root/'index.html').read_text())
   await page.set_content(html,wait_until='domcontentloaded')
   await page.add_style_tag(path=str(root/'style.css'))
   await page.add_script_tag(path=str(root/'audio.js'))
   await page.add_script_tag(path=str(root/'icons.js'))
   await page.add_script_tag(path=str(root/'app.js'))
   await page.wait_for_timeout(600)
   assert await page.locator('.pad').count()==16
   first=await page.locator('.pad').first.get_attribute('aria-label')
   assert first.startswith('1 PRESS'),first
   fits=await page.evaluate('''() => ({docWidth:document.documentElement.scrollWidth, width:innerWidth, shellHeight:document.querySelector('.shell').getBoundingClientRect().bottom, viewportH:innerHeight, screen:document.getElementById('display-view').getBoundingClientRect().height, iconCount:document.querySelectorAll('.pad-icon svg').length, bunnyMode:document.getElementById('lcd-mode').innerText})''')
   print('SIZE',w,h,fits)
   await page.screenshot(path=f'/mnt/data/WRONG_NUMBER_v0.1.5_{w}x{h}.png',full_page=True)
   if w==390:
    await page.locator('.pad').nth(0).tap();await page.wait_for_timeout(200)
    assert await page.evaluate('WrongNumberDebug.audioState().kit')==0
    await page.locator('#kit-next').tap()
    assert await page.evaluate('WrongNumberDebug.audioState().kit')==1
    await page.locator('#btn-new').tap();await page.locator('#btn-loop').tap()
    assert await page.evaluate('WrongNumberDebug.isPlaying()')
    await page.locator('#btn-mutate').tap();await page.locator('#btn-keep').tap()
    await page.locator('#kit-next').tap()
    assert await page.evaluate('WrongNumberDebug.audioState().kit')==2
    await page.locator('#btn-loop').tap()
    assert not await page.evaluate('WrongNumberDebug.isPlaying()')
    await page.locator('#btn-export').tap()
    await page.locator('#download-link').wait_for(state='visible',timeout=30000)
    detail=await page.locator('#export-status').inner_text();print('EXPORT',detail)
    await page.locator('#btn-close-export').tap()
    print('SAVED KIT IN SCENE',await page.evaluate('WrongNumberDebug.getScene().kit'))
   if errors: print('ERRORS',errors)
   assert not errors,errors
   await page.close()
  await browser.close()

asyncio.run(main())
