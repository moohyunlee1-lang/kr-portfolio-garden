import { Practice } from './practice.mjs';
import { deployment } from './deployment.mjs';
import { catalogRequest } from './static-api.mjs';
const staticMode = deployment.staticBase !== null;
const asset = path => (deployment.staticBase || '') + path;
let catalog;

const $=id=>document.getElementById(id);
const modes={secular:['호흡 한 번 기록','호흡을 억지로 조절하지 않아도 됩니다. 편안한 속도로 들이쉬고 내쉬세요.'],buddhist:['염주 한 알 굴리기','염주를 굴리거나 합장하며 잠시 마음을 가라앉혀 보세요. 절 동작은 단순화한 시제품입니다.'],protestant:['기도 한 번 기록','조용히 손을 모으고 자신의 말로 기도하거나 묵상하세요. 정해진 기도문을 강요하지 않습니다.'],catholic:['묵주 한 알 넘기기','묵주를 넘기며 조용히 기도하세요. 정식 묵주기도의 신비·기도문 안내는 포함하지 않습니다.']};
let unity=null, room=null, base='', alive=true, place='courtyard', sessionReady=false;
const practice=new Practice();
const state={version:1,mode:'secular',volume:0.35,sound:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,day:0.5,running:false};
async function api(path,method='GET',data) {
 if(staticMode) {
  catalog ??= fetch(asset('/rooms.json')).then(r=>{if(!r.ok)throw new Error('종목 목록을 불러오지 못했습니다.');return r.json();}).then(r=>r.rooms);
  return catalogRequest(await catalog,path,method);
 }

 const response=await fetch(path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
 const result=await response.json();if(!response.ok) throw new Error(result.error??'연결 오류');return result;
}
function send(method,value) {if(unity) unity.SendMessage('SanctuaryBridge',method,typeof value==='string'?value:JSON.stringify(value));}
function sync() {state.running=practice.running;send('Configure',state);}
function history() {
 $('history').replaceChildren();
 try {const rows=JSON.parse(localStorage.getItem('sanctuary.history.v1')??'[]');if(!Array.isArray(rows))return;
 for(const r of rows.slice(-20).reverse()) {if(typeof r.at!=='number'||typeof r.seconds!=='number'||typeof r.count!=='number')continue;const li=document.createElement('li');li.textContent=`${new Date(r.at).toLocaleString('ko-KR')} · ${r.seconds}초 · ${r.count}회`; $('history').append(li);}}
 catch {$('session-status').textContent='이 브라우저에서는 로컬 기록을 읽을 수 없습니다.';}
}
function renderPractice() {
 const n=performance.now();
 if(practice.finish(n)) {
  sync();$('session-status').textContent='머무름을 마쳤습니다. 오늘도 평안하세요.';
  if($('save-local').checked) try {
   let rows=JSON.parse(localStorage.getItem('sanctuary.history.v1')??'[]');if(!Array.isArray(rows))rows=[];
   rows.push({at:Date.now(),seconds:practice.duration,count:practice.count});localStorage.setItem('sanctuary.history.v1',JSON.stringify(rows.slice(-20)));history();
  } catch {$('session-status').textContent+=' 로컬 저장이 차단되어 기록은 저장하지 못했습니다.';}
 }
 const remaining=Math.ceil(practice.remaining(n));$('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
 $('start').textContent=practice.completed?'완료':practice.running?'일시정지':practice.elapsed?'계속':'시작';$('start').disabled=practice.completed;
 $('duration').disabled=practice.running;$('breath').classList.toggle('running',practice.running);
 const phase=(practice.duration-practice.remaining(n))%8;
 $('breath-text').textContent=!practice.running?'편안히 쉬세요':state.mode==='secular'?(phase<4?'들이쉬기':'내쉬기'):'조용히 머무르기';
 $('count').textContent=String(practice.count);
}
function act(kind='practice') {if(practice.completed)return;practice.act();send('Act',kind);renderPractice();}
$('mode').addEventListener('change',()=>{state.mode=$('mode').value;$('ritual').textContent=modes[state.mode][0];$('guidance').textContent=modes[state.mode][1];$('bow').hidden=state.mode!=='buddhist';sync();});
$('guidance').textContent=modes.secular[1];
$('start').onclick=()=>{practice.running?practice.pause(performance.now()):practice.start(performance.now());sync();renderPractice();};
$('reset').onclick=()=>{practice.reset(Number($('duration').value));$('session-status').textContent='';sync();renderPractice();};
$('duration').onchange=()=>{$('reset').click();};
$('bow').onclick=()=>act('bow');
let beadX=null, dragged=false;
$('ritual').onpointerdown=e=>{beadX=e.clientX;dragged=false;};
$('ritual').onpointermove=e=>{if(beadX===null || !['buddhist','catholic'].includes(state.mode))return;if(Math.abs(e.clientX-beadX)>=36){dragged=true;beadX=e.clientX;act();}};
$('ritual').onpointerup=()=>{beadX=null;};$('ritual').onpointercancel=()=>{beadX=null;dragged=false;};$('ritual').onpointerleave=()=>{beadX=null;};
$('ritual').onclick=e=>{if(!dragged||e.detail===0)act();dragged=false;};
$('clear-history').onclick=()=>{try{localStorage.removeItem('sanctuary.history.v1');history();}catch{$('session-status').textContent='기록 삭제 실패';}};
$('reduced').checked=state.reduced;document.body.classList.toggle('reduced',state.reduced);
for(const id of ['sound','volume','day','reduced']) $(id).addEventListener('change',()=>{
 state.sound=$('sound').checked;state.volume=Number($('volume').value);state.day=Number($('day').value);state.reduced=$('reduced').checked;
 document.body.classList.toggle('reduced',state.reduced);sync();
});
for(const b of document.querySelectorAll('[data-place]')) b.onclick=()=>{place=b.dataset.place;send('Go',place);for(const other of document.querySelectorAll('[data-place]'))other.setAttribute('aria-pressed',String(other===b));};
let canvasX=null;
$('unity-canvas').onpointerdown=e=>{canvasX=e.clientX;$('unity-canvas').setPointerCapture(e.pointerId);};
$('unity-canvas').onpointermove=e=>{if(canvasX!==null){send('Orbit',String((e.clientX-canvasX)*0.2));canvasX=e.clientX;}};
$('unity-canvas').onpointerup=$('unity-canvas').onpointercancel=()=>{canvasX=null;};
$('unity-canvas').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();send('Orbit',e.key==='ArrowLeft'?'-5':'5');}};
window.addEventListener('sanctuary-ready',()=>{sync();send('Go',place);});
$('enter').onclick=async()=>{
 $('enter').disabled=true;$('load-status').textContent='Unity Web 플레이어 준비 중…';
 try {
  const script=document.createElement('script');script.src=asset('/unity/Build/unity.loader.js');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('로더 응답 시간이 초과되었습니다.')),20000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(new Error('Unity Web 빌드가 없거나 서버에서 읽을 수 없습니다.'));};document.head.append(script);});
  unity=await window.createUnityInstance($('unity-canvas'),{dataUrl:asset('/unity/Build/unity.data.gz'),frameworkUrl:asset('/unity/Build/unity.framework.js.gz'),codeUrl:asset('/unity/Build/unity.wasm.gz'),streamingAssetsUrl:asset('/unity/StreamingAssets'),companyName:'StockSanctuary',productName:'머무는 숲',productVersion:'0.1.0',devicePixelRatio:Math.min(devicePixelRatio,1.5)},p=>{$('load-status').textContent=`Unity 공간 불러오는 중 ${Math.round(p*100)}%`;});
  $('load-panel').hidden=true;document.querySelector('.scene-wrap').classList.add('ready');sync();send('Go',place);
 } catch(e) {$('load-status').textContent=`3D 공간을 열지 못했습니다: ${String(e.message??e)} 개인 타이머는 계속 사용할 수 있습니다.`;$('retry').hidden=false;}
};
$('retry').onclick=()=>location.reload();
async function messages(){
 if(staticMode)return;
 try {const {messages:rows}=await api(`${base}/messages`);$('messages').replaceChildren();
  for(const r of rows){const li=document.createElement('li'),p=document.createElement('p'),time=document.createElement('time');p.textContent=r.body;time.textContent=`익명 · ${new Date(r.created).toLocaleString('ko-KR')}${r.mine?' · 내 글':''}`;li.append(time,p);
   const b=document.createElement('button');b.className='secondary';b.textContent=r.mine?'내 글 삭제':'신고';b.onclick=async()=>{b.disabled=true;try{await api(`${base}/messages/${r.id}${r.mine?'':'/report'}`,r.mine?'DELETE':'POST',r.mine?undefined:{});$('book-status').textContent=r.mine?'삭제했습니다.':'신고를 접수했습니다. 운영자가 검토합니다.';await messages();}catch(e){$('book-status').textContent=e.message;b.disabled=false;}};li.append(b);$('messages').append(li);
  }if(!rows.length){const li=document.createElement('li');li.textContent='아직 남겨진 글이 없습니다.';$('messages').append(li);}
 } catch(e){$('book-status').textContent=`방명록 연결 실패: ${e.message}`;}
}
$('message-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
 try{await api(`${base}/messages`,'POST',{body:$('message').value,publicConsent:$('consent').checked});$('message').value='';$('consent').checked=false;$('book-status').textContent='공개 방명록에 저장했습니다.';await messages();}catch(e){$('book-status').textContent=e.message;}finally{button.disabled=false;}};
$('refresh').onclick=messages;
async function heartbeat(){if(staticMode)return;if(!alive||document.hidden)return;try{if(!sessionReady){await api('/api/session','POST',{});sessionReady=true;}const p=await api(`${base}/presence`,'POST',{});$('presence').textContent=`지금 함께 머무는 브라우저 ${p.count}개 · 나 포함`;send('Presence',String(p.count));}catch{$('presence').textContent='방문자 서버 연결 끊김 · 현재 수 알 수 없음';send('Presence','0');}}
let searchVersion=0;
async function search(){const version=++searchVersion;try{const result=await api(`/api/rooms?q=${encodeURIComponent($('search').value)}`);if(version!==searchVersion)return;$('rooms').replaceChildren();for(const r of result.rooms){const a=document.createElement('a');a.href=asset(`/rooms/${r.market}/${r.ticker}`);a.textContent=r.name;const s=document.createElement('small');s.textContent=`${r.ticker} · 기도원 들어가기 →`;a.append(s);$('rooms').append(a);}if(!result.rooms.length)$('rooms').textContent='등록된 종목을 찾지 못했습니다.';}catch(e){$('error').textContent=e.message;}}
let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,200);};
const match=/^\/rooms\/(KRX)\/(\d{6})\/?$/.exec(staticMode ? location.pathname.slice(deployment.staticBase.length) : location.pathname);
if(match){base=`/api/rooms/${match[1]}/${match[2]}`;
 try{room=await api(base);$('lobby').hidden=true;$('room').hidden=false;$('room-title').textContent=`${room.name} 기도원`;$('room-code').textContent=`${room.market} · ${room.ticker}`;document.title=`${room.name} 기도원 · 머무는 숲`;
 history();renderPractice();setInterval(renderPractice,200);
 if(staticMode) {
  $('presence').textContent='공유 서버 미연결 · 방문자 수를 집계하지 않습니다.';
  $('book-status').textContent='Vercel 체험판에서는 공유 방명록을 사용할 수 없습니다. 글을 저장하거나 전송하지 않습니다.';
  for(const control of $('message-form').elements)control.disabled=true;
  $('refresh').disabled=true;
 }

 try { await heartbeat();await messages(); }
 catch(e){$('presence').textContent='방문자 서버 연결 실패';$('book-status').textContent=e.message;}
 if(!staticMode)setInterval(heartbeat,15000);
 }catch(e){$('error').textContent=e.message;}
}else await search();
document.addEventListener('visibilitychange',()=>{if(document.hidden){practice.pause(performance.now());sync();renderPractice();}else if(room)heartbeat();});
window.addEventListener('pagehide',()=>{alive=false;});
window.addEventListener('pageshow',()=>{alive=true;});
