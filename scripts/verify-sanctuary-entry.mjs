import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.argv[2]||'http://127.0.0.1:3002';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const routeResponses=[];
page.on('response',r=>{if(r.url().includes('sanctuary'))routeResponses.push({url:r.url(),status:r.status(),type:r.headers()['content-type']});});
try {
 await page.goto(origin);
 await page.getByRole('button',{name:'샘플 정원 보기',exact:true}).click();
 await page.getByRole('button',{name:'삼성전자 나무 정보',exact:true}).click();
 await page.getByRole('link',{name:'기도원 들어가기 →',exact:true}).click();
 await page.locator('#room-title').waitFor({state:'visible',timeout:15000});
 assert.equal(await page.locator('#room-title').textContent(),'삼성전자 기도원');
 console.log(JSON.stringify({origin,entryFromStockDetail:true,url:page.url()}));
} catch(e) {console.error(JSON.stringify({url:page.url(),routeResponses}));throw e;}
finally {await browser.close();}
