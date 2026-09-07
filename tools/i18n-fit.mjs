/* 十四言語ぶんの字が、枠からはみ出していないかを見る。

   訳文は日本語より長いことが多く、脇の柱（幅 192px）や
   札の中で溢れやすい。言語を切り替えて読み直し、
   親からはみ出した所と、横に流れた所を数える。

       npm i playwright-core        # 初回だけ
       node tools/i18n-fit.mjs

   chromium の場所が違うときは CHROME= で渡す。
*/
import { chromium } from 'playwright-core';
const GAME = new URL('../index.html', import.meta.url).pathname;
const b=await chromium.launch({executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const langs=['ja','en','de','pl','tr','ru','vi','id','pt','fr','es','it','ko','zh'];
const bad=[];
for(const [w,h,tag] of [[1280,820,'pc'],[390,844,'sp']]){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await c.newPage();
  await p.goto('file://' + GAME); await p.waitForTimeout(1400);
  for(const L of langs){
    await p.evaluate((L)=>localStorage.setItem('sushitsumu.lang', L), L);
    await p.reload(); await p.waitForTimeout(900);
    const r=await p.evaluate(()=>{
      const de=document.documentElement;
      const over=de.scrollWidth>de.clientWidth+1;
      const outs=[];
      const check=(sel)=>{
        for(const el of document.querySelectorAll(sel)){
          if(!el.offsetParent && getComputedStyle(el).position!=='fixed') continue;
          const r=el.getBoundingClientRect(); if(r.width<1) continue;
          const par=el.parentElement; if(!par) continue;
          const pr=par.getBoundingClientRect();
          if(r.right>pr.right+2||r.left<pr.left-2)
            outs.push((el.className||el.tagName)+' '+Math.round(r.width)+'>'+Math.round(pr.width));
          if(el.scrollWidth>el.clientWidth+2 && getComputedStyle(el).overflowX==='visible')
            outs.push('あふれ '+(el.className||el.tagName)+' '+el.scrollWidth+'>'+el.clientWidth);
        }
      };
      check('.hud *, #sidePanel *, .card .btn, .miniRow *, .kbd');
      return {over, outs:[...new Set(outs)].slice(0,4), w:de.scrollWidth, cw:de.clientWidth};
    });
    if(r.over) bad.push(`${tag}/${L}: 横にはみ出し ${r.w}>${r.cw}`);
    for(const o of r.outs) bad.push(`${tag}/${L}: ${o}`);
  }
  await c.close();
}
await b.close();
if(bad.length){ console.error('気になる所:'); bad.forEach(x=>console.error('  '+x)); process.exit(1); }
console.log('十四言語 × 二画面、はみ出しなし。');
