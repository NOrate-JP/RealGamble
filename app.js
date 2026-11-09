import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getDatabase,ref,onValue,set,update,push,runTransaction,get} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {firebaseConfig} from "./config.js";
import {calcOdds,TYPES,key} from "./odds.js";

const db = getDatabase(initializeApp(firebaseConfig));
const $ = s => document.querySelector(s);
const uid = localStorage.uid || (localStorage.uid = crypto.randomUUID());
const S = {code:localStorage.code||"", name:localStorage.name||"", room:null, hcode:"",
  ui:{sel:[],type:"win",stake:100,draft:null,res:["","",""],wins:[]}};
let unsub = null, oc = {k:"",v:null};
const R = p => ref(db, `rooms/${S.code}${p?"/"+p:""}`);
const yen = n => (n||0).toLocaleString()+"円";
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num = i => `<span class="num n${i%8}">${i+1}</span>`;
const ents = () => S.room.entrants || [];

function odds(){ const r=S.room, k=JSON.stringify([ents(),r.rate]);
  if(oc.k!==k) oc={k,v:calcOdds(ents(),r.rate)}; return oc.v; }
const getOdds = (t,sel) => S.room.type==="roulette" ? ents()[sel[0]].odds : odds()[t][key(t,sel)];

function watch(){ unsub&&unsub(); unsub=onValue(R(),s=>{S.room=s.val();render();}); }
async function join(code){
  const snap = await get(ref(db,`rooms/${code}`));
  if(!snap.exists()) return alert("ルームが見つかりません");
  S.code=code; localStorage.code=code; localStorage.name=S.name;
  const pr = ref(db,`rooms/${code}/players/${uid}`);
  if(!(await get(pr)).exists()) await set(pr,{name:S.name,balance:snap.val().initBalance??10000});
  watch();
}
async function create(type){
  const code=Math.random().toString(36).slice(2,7).toUpperCase();
  await set(ref(db,`rooms/${code}`),{type,master:uid,status:"setup",rate:0.8,initBalance:10000,
    title:type==="roulette"?"ルーレット":"第1R"});
  await join(code);
}

// ---------- 画面 ----------
function render(){
  const a=document.activeElement, id=a&&a.id, pos=a&&a.selectionStart;
  $("#app").innerHTML = !S.code ? home() : !S.room ? `<p class="c">読み込み中…（ルームが無い場合は<button data-act="leave">戻る</button>）</p>` : room();
  if(id){const e=document.getElementById(id); if(e){e.focus(); try{e.setSelectionRange(pos,pos)}catch{}}}
}
const home = () => `<h1>🏇 身近なものをギャンブルに</h1><div class="card">
  <p>名前 <input id="in-name" data-m="name" value="${esc(S.name)}" maxlength="12"></p>
  <h3>ルームを作る（マスター）</h3>
  <button data-act="create" data-v="ranking">順位型（競馬）</button>
  <button data-act="create" data-v="roulette">当たり外れ型（ルーレット）</button>
  <h3>ルームに参加</h3>
  <input id="in-code" data-m="hcode" placeholder="ルームコード" value="${esc(S.hcode)}" size="8">
  <button data-act="join">参加</button></div>
  <p class="small">※架空の通貨のみ使用。実在のお金は一切扱いません。</p>`;

function room(){
  const r=S.room, me=(r.players||{})[uid], isM=r.master===uid, st=r.status;
  const label={setup:"準備中",open:"発売中",closed:"発売締切",settled:"確定"}[st];
  return `<h1>🏇 ${esc(r.title)} <span class="badge">${label}</span></h1>
  <div class="card"><span class="small">ルームコード</span> <b>${S.code}</b>　${isM?"👑マスター":""}　
  <span class="small">${r.type==="roulette"?"当たり外れ型":"順位型"}</span>
  <button class="gray" data-act="leave" style="float:right">退出</button><br>
  <span class="small">あなたの残高</span> <span class="bal">${yen(me&&me.balance)}</span></div>
  ${isM&&st==="setup"?setup():""}${st!=="setup"?board():""}${st==="open"?(me?betForm():""):""}
  ${isM&&(st==="open"||st==="closed")?control():""}${st==="settled"?resultView():""}
  ${st==="setup"&&!isM?`<p class="c">マスターが準備中です…</p>`:""}
  ${myTickets()}${players()}`;
}

function setup(){
  const r=S.room, d=S.ui.draft ||= {ent: ents().length?ents().map(e=>({...e})):
    (r.type==="roulette"?[{name:"赤",odds:1.9},{name:"黒",odds:1.9},{name:"緑",odds:14}]
      :[{name:"サクラ",odds:2.0},{name:"ミドリ",odds:3.5},{name:"アオイ",odds:5.0},{name:"クロス",odds:8.0},{name:"ホワイト",odds:12.0}]), rate:r.rate};
  const rl=r.type==="roulette";
  return `<div class="card"><h2>${rl?"選択肢と倍率":"出走馬と単勝オッズ"}</h2>
  <p>タイトル <input id="in-title" data-m="title" value="${esc(r.title)}"></p>
  <table>${d.ent.map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td>
   <td><input id="en${i}" data-m="en:${i}" value="${esc(e.name)}"></td>
   <td><input id="eo${i}" data-m="eo:${i}" type="number" step="0.1" min="1.1" value="${e.odds}" style="width:80px">${rl?"倍":""}</td>
   <td><button class="red" data-act="delent" data-v="${i}">削除</button></td></tr>`).join("")}</table>
  <button class="gray" data-act="addent">＋追加</button>
  ${rl?"":`<p>払戻率 <input id="in-rate" data-m="rate" type="number" step="0.01" min="0.5" max="1" value="${d.rate}" style="width:70px">（JRAは約0.75〜0.8）</p>`}
  <button data-act="start">投票開始</button></div>`;
}

function board(){
  const r=S.room, rl=r.type==="roulette", O=rl?null:odds();
  return `<div class="card"><h2>${rl?"オッズ（的中時の払戻倍率）":"出馬表・オッズ"}</h2><table>
  <tr><th>${rl?"No":"馬番"}</th><th>名前</th><th>${rl?"倍率":"単勝"}</th>${rl?"":"<th>複勝</th>"}</tr>
  ${ents().map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td>${esc(e.name)}</td><td>${e.odds.toFixed(1)}</td>
  ${rl?"":`<td>${O.place[i].toFixed(1)}</td>`}</tr>`).join("")}</table></div>`;
}

function betForm(){
  const r=S.room, u=S.ui, rl=r.type==="roulette", t=rl?"r":u.type, k=rl?1:TYPES[t].k;
  const ok=u.sel.length===k, od=ok?getOdds(t,u.sel):null;
  return `<div class="card"><h2>馬券（投票）購入</h2>
  ${rl?"":Object.entries(TYPES).map(([id,v])=>`<button class="${u.type===id?"on":""}" data-act="type" data-v="${id}">${v.n}</button>`).join("")}
  <p>${rl?"賭ける選択肢を選ぶ":`${TYPES[t].n}：${k}頭選択${TYPES[t].o?"（選んだ順＝着順）":""}`}</p>
  <div>${ents().map((e,i)=>`<button class="ent ${u.sel.includes(i)?"on":""}" data-act="pick" data-v="${i}">${rl?"":num(i)}${esc(e.name)}${u.sel.includes(i)&&TYPES[t]?.o?`(${u.sel.indexOf(i)+1})`:""}</button>`).join("")}</div>
  <p>金額 <input id="in-stake" data-m="stake" type="number" step="100" min="100" value="${u.stake}" style="width:100px">円　
  オッズ <b>${od?od.toFixed(1):"-"}</b>　的中時 <b>${od?yen(Math.floor(u.stake*od/10)*10):"-"}</b></p>
  <button data-act="buy">購入する</button></div>`;
}

function control(){
  const r=S.room,u=S.ui,rl=r.type==="roulette";
  if(r.status==="open") return `<div class="card"><h2>マスター操作</h2><button class="red" data-act="close">発売を締め切る</button></div>`;
  const inp = rl ? ents().map((e,i)=>`<label><input type="checkbox" data-m="win:${i}" ${u.wins.includes(i)?"checked":""}>${esc(e.name)}</label> `).join("")
    : [0,1,2].map(j=>`${j+1}着 <select data-m="res:${j}"><option value="">--</option>${ents().map((e,i)=>`<option value="${i}" ${u.res[j]==i&&u.res[j]!==""?"selected":""}>${i+1} ${esc(e.name)}</option>`).join("")}</select> `).join("");
  return `<div class="card"><h2>結果入力</h2><p>${rl?"当たり（複数可）":""} ${inp}</p><button data-act="settle">結果確定・払戻</button></div>`;
}

function hit(r,t,res){
  if(r.type==="roulette") return (res.wins||[]).includes(t.sel[0]);
  const o=res.order, s=t.sel, top=o.slice(0,3);
  switch(t.type){
    case "win": return s[0]===o[0];
    case "place": return top.includes(s[0]);
    case "quinella": return s.every(x=>top.slice(0,2).includes(x));
    case "exacta": return s[0]===o[0]&&s[1]===o[1];
    case "wide": return s.every(x=>top.includes(x));
    case "trio": return s.every(x=>top.includes(x));
    case "trifecta": return s.every((x,i)=>x===o[i]);
  }
}
async function settle(){
  const r=S.room,u=S.ui; if(r.status!=="closed") return; let result;
  if(r.type==="roulette") result={wins:u.wins};
  else { if(u.res.some(v=>v==="")||new Set(u.res).size<3) return alert("1〜3着を重複なく選んでください"); result={order:u.res.map(Number)}; }
  const pay={}, up={result,status:"settled"};
  Object.entries(r.tickets||{}).forEach(([id,t])=>{
    const p=hit(r,t,result)?Math.floor(t.stake*t.odds/10)*10:0; up[`tickets/${id}/payout`]=p;
    if(p) pay[t.uid]=(pay[t.uid]||0)+p; });
  await update(R(),up);
  for(const [id,p] of Object.entries(pay)) await runTransaction(ref(db,`rooms/${S.code}/players/${id}/balance`),b=>(b||0)+p);
}

function resultView(){
  const r=S.room,res=r.result||{},rl=r.type==="roulette",isM=r.master===uid;
  const txt = rl ? ((res.wins||[]).map(i=>esc(ents()[i].name)).join("、")||"全員ハズレ")
    : (res.order||[]).map((i,j)=>`${j+1}着 ${num(i)}${esc(ents()[i].name)}`).join("　");
  return `<div class="card"><h2>結果</h2><p>${txt}</p>${isM?`<button data-act="next">次のラウンドへ</button>`:""}</div>`;
}
function myTickets(){
  const r=S.room, ts=Object.values(r.tickets||{}).filter(t=>t.uid===uid).sort((a,b)=>b.at-a.at); if(!ts.length) return "";
  return `<div class="card"><h2>自分の馬券</h2><table>${ts.map(t=>`<tr><td>${t.type==="r"?"":TYPES[t.type].n}</td>
  <td>${t.sel.map(i=>esc(ents()[i]?.name)).join(" → ")}</td><td>${yen(t.stake)}</td><td>×${t.odds.toFixed(1)}</td>
  <td class="${t.payout?"hit":""}">${t.payout==null?"":t.payout?"的中 "+yen(t.payout):"ハズレ"}</td></tr>`).join("")}</table></div>`;
}
function players(){
  const ps=Object.values(S.room.players||{}).sort((a,b)=>b.balance-a.balance);
  return `<div class="card"><h2>参加者（残高順）</h2>${ps.map(p=>`<div>${esc(p.name)}　${yen(p.balance)}</div>`).join("")}</div>`;
}

// ---------- 操作 ----------
async function buy(){
  const r=S.room,u=S.ui,rl=r.type==="roulette",t=rl?"r":u.type,k=rl?1:TYPES[t].k,st=Number(u.stake);
  if(r.status!=="open") return alert("発売中ではありません");
  if(u.sel.length!==k) return alert("選択が足りません");
  if(!(st>=100&&st%100===0)) return alert("金額は100円単位で入力してください");
  const od=getOdds(t,u.sel);
  const res=await runTransaction(ref(db,`rooms/${S.code}/players/${uid}/balance`),b=>(b>=st?b-st:undefined));
  if(!res.committed) return alert("残高が足りません");
  await push(R("tickets"),{uid,name:S.name,type:t,sel:u.sel,stake:st,odds:od,at:Date.now()}); u.sel=[];
}
async function start(){
  const d=S.ui.draft, rl=S.room.type==="roulette";
  if(d.ent.some(e=>!e.name.trim()||!(e.odds>=1.1))) return alert("名前とオッズ(1.1以上)を入力してください");
  if(!rl&&(d.ent.length<3||d.ent.length>18)) return alert("出走数は3〜18です");
  if(rl&&d.ent.length<1) return alert("選択肢が必要です");
  await update(R(),{entrants:d.ent.map(e=>({name:e.name.trim(),odds:Number(e.odds)})),rate:Number(d.rate)||0.8,status:"open"});
  S.ui.draft=null; S.ui.sel=[];
}
const acts = {
  create:v=>{ if(!S.name.trim()) return alert("名前を入力してください"); create(v); },
  join:()=>{ if(!S.name.trim()||!S.hcode.trim()) return alert("名前とコードを入力してください"); join(S.hcode.trim().toUpperCase()); },
  leave:()=>{ unsub&&unsub(); localStorage.removeItem("code"); S.code=""; S.room=null; render(); },
  addent:()=>{ S.ui.draft.ent.push({name:"",odds:5}); render(); },
  delent:v=>{ S.ui.draft.ent.splice(v,1); render(); },
  start, buy, settle,
  close:()=>update(R(),{status:"closed"}),
  next:()=>{ S.ui.draft=null; S.ui.res=["","",""]; S.ui.wins=[]; update(R(),{status:"setup",tickets:null,result:null}); },
  type:v=>{ S.ui.type=v; S.ui.sel=[]; render(); },
  pick:v=>{ const u=S.ui,i=+v,rl=S.room.type==="roulette",k=rl?1:TYPES[u.type].k;
    if(u.sel.includes(i)) u.sel=u.sel.filter(x=>x!==i); else if(k===1) u.sel=[i]; else if(u.sel.length<k) u.sel.push(i);
    render(); }
};
document.addEventListener("click",e=>{ const b=e.target.closest("[data-act]"); if(b) acts[b.dataset.act](b.dataset.v); });
document.addEventListener("input",e=>{ const m=e.target.dataset.m; if(!m) return; const v=e.target.value, [k,i]=m.split(":"), u=S.ui;
  if(k==="name") S.name=v; else if(k==="hcode") S.hcode=v; else if(k==="stake"){ u.stake=v; render(); }
  else if(k==="title") update(R(),{title:v});
  else if(k==="en") u.draft.ent[i].name=v; else if(k==="eo") u.draft.ent[i].odds=Number(v); else if(k==="rate") u.draft.rate=v;
  else if(k==="res") u.res[i]=v;
  else if(k==="win") u.wins=e.target.checked?[...u.wins,+i]:u.wins.filter(x=>x!==+i);
});
if(S.code) join(S.code).catch(()=>{}); else render();
