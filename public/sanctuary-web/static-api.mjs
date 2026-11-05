/** Read-only snapshot adapter; never simulates shared server state. */
export function catalogRequest(rooms,path,method='GET') {
 const url=new URL(path,'https://sanctuary.invalid');
 if(method!=='GET') throw new Error('공유 서버 미연결 · 이 배포에서는 공개 기록을 저장하지 않습니다.');
 if(url.pathname==='/api/rooms') {
  const q=(url.searchParams.get('q')??'').toLocaleLowerCase();
  return {rooms:rooms.filter(r=>`${r.name} ${r.ticker}`.toLocaleLowerCase().includes(q))};
 }
 const match=/^\/api\/rooms\/KRX\/(\d{6})$/.exec(url.pathname);
 const room=match&&rooms.find(r=>r.market==='KRX'&&r.ticker===match[1]);
 if(!room) throw new Error('등록된 종목이 아니거나 공유 서버가 필요한 요청입니다.');
 return room;
}
