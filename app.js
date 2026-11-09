import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getDatabase,ref,onValue,set,update,push,runTransaction,get} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {firebaseConfig} from "./config.js";
import {calcOdds,TYPES,key} from "./odds.js";

const db=getDatabase(initializeApp(firebaseConfig)), $=s=>document.querySelector(s);
const uid=localStorage.uid||(localStorage.uid=crypto.randomUUID());
const S={code:localStorage.code||"",name:localStorage.name||"",room:null,hcode:"",lock:0,anim:false,seen:{},
  ui:{sel:[],type:null,stake:"",draft:null,res:["","",""],wins:[],modal:false,top:null}};
let unsub=null,oc={k:"",v:null},closing=false;
const R=p=>ref(db,`rooms/${S.code}${p?"/"+p:""}`);
const yen=n=>(n||0).toLocaleString()+"円", esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ents=()=>S.room.entrants||[], isRl=()=>S.room.type==="roulette";
const num=i=>isRl()?"":`<span class="num n${i%8}">${i+1}</span>`;
const odds=()=>{const r=S.room,k=JSON.stringify([ents(),r.rate]);if(oc.k!==k)oc={k,v:calcOdds(ents(),r.rate)};return oc.v};
const getOdds=(t,sel)=>isRl()?ents()[sel[0]].odds:odds()[t][key(t,sel)];

function watch(){unsub&&unsub();unsub=onValue(R(),s=>{const v=s.val();S.room=v;let f=false;
  if(v&&v.status==="settled"&&v.settledAt&&!S.seen[v.settledAt]){S.seen[v.settledAt]=1;
    if(Math.abs(Date.now()-v.settledAt)<15000){S.anim=true;S.lock=Date.now()+6800;f=true;setTimeout(()=>{S.anim=false;S.lock=0;render(true)},6900);}}
  render(f);});}
async function join(code){
  const snap=await get(ref(db,`rooms/${code}`));if(!snap.exists())return alert("ルームが見つかりません");
  S.code=code;localStorage.code=code;localStorage.name=S.name;
  const pr=ref(db,`rooms/${code}/players/${uid}`);
  if(!(await get(pr)).exists())await set(pr,{name:S.name,balance:snap.val().initBalance??0});
  watch();}
async function create(){const code=Math.random().toString(36).slice(2,7).toUpperCase();
  await set(ref(db,`rooms/${code}`),{master:uid,status:"setup"});await join(code);}

function render(f){
  if(!f&&Date.now()<S.lock)return;
  const a=document.activeElement,id=a&&a.id,pos=a&&a.selectionStart;
  $("#app").innerHTML=!S.code?home():!S.room?`<p class="c">読み込み中（ルームが無い場合は<button data-act="leave">戻る</button>）</p>`:room();
  if(id){const e=document.getElementById(id);if(e){e.focus();try{e.setSelectionRange(pos,pos)}catch{}}}}

const home=()=>`<div class="hero"><h1>HIPPODROME</h1><p>身近なものを、賭けの対象に。架空通貨のみ使用。</p></div>
<div class="card" style="max-width:420px;margin:auto"><label>名前<input id="in-name" data-m="name" value="${esc(S.name)}" maxlength="12"></label>
<button class="primary" data-act="create">ルームを作る</button><hr style="border:0;border-top:1px solid #e6ece7;margin:16px 0">
<label>ルームコード<input id="in-code" data-m="hcode" value="${esc(S.hcode)}" maxlength="8"></label><button class="primary" style="background:#fff;color:#14532d" data-act="join">参加する</button></div>`;

function room(){
  const r=S.room,u=S.ui,me=(r.players||{})[uid],isM=r.master===uid,st=r.status;
  const lab={setup:"準備中",open:"発売中",closed:"発売締切",settled:"結果確定"}[st];
  const reqs=Object.entries(r.requests||{}),pend=reqs.filter(([,q])=>q.status==="pending"),mine=reqs.filter(([,q])=>q.uid===uid).sort((a,b)=>b[1].at-a.at.at).slice(0,3);
  const ts=Object.values(r.tickets||{}).filter(t=>t.uid===uid).sort((a,b)=>b.at-a.at);
  const main=st==="setup"?(isM?setup():`<div class="card c">マスターが準備中です</div>`)
    :board()+(st==="open"&&me?betForm():"")+(isM&&(st==="open"||st==="closed")?control():"")+(st==="settled"?resultView():"");
  return `<div class="bar"><div><b>${esc(r.title||"ルーム")}</b> <span class="small" style="color:#cfe">${r.type==="roulette"?"当たり外れ型":r.type?"順位型":""}</span></div>
  <div><span class="cd" id="cd"></span><span class="pill ${st}">${lab}</span></div></div>
  <div class="grid"><main>${main}</main><aside>
  <div class="card"><div class="small">ルームコード <b>${S.code}</b> ${isM?"(マスター)":""} <button style="float:right;padding:2px 8px" data-act="leave">退出</button></div>
  <div class="small" style="margin-top:8px">残高</div><div class="amt">${yen(me&&me.balance)}</div>
  ${me&&me.debt?`<div class="small">カード請求額 ${yen(me.debt)}</div>`:""}<button data-act="topen">入出金（カード / ATM）</button></div>
  ${topup()}${mine.length?`<div class="card"><h3>入金申請</h3>${mine.map(([,q])=>`<div class="small">${q.method==="card"?"カード":"ATM"} ${yen(q.amount)}　${{pending:"承認待ち",approved:"承認",rejected:"却下"}[q.status]}</div>`).join("")}</div>`:""}
  ${isM&&pend.length?`<div class="card"><h3>入金申請（${pend.length}件）</h3>${pend.map(([id,q])=>`<div class="rq"><span>${esc(q.name)} / ${q.method==="card"?"カード **** "+esc(q.last4):"ATM"} / <b>${yen(q.amount)}</b></span><button class="ok" data-act="apv" data-v="${id}">承認</button><button class="red" data-act="rej" data-v="${id}">却下</button></div>`).join("")}</div>`:""}
  ${ts.length?`<div class="card"><h3>自分の馬券</h3>${ts.map(t=>tk(t,S.anim)).join("")}</div>`:""}
  <div class="card"><h3>参加者</h3>${Object.values(r.players||{}).sort((a,b)=>b.balance-a.balance).map(p=>`<div class="small" style="font-size:13px">${esc(p.name)}　${yen(p.balance)}</div>`).join("")}</div>
  </aside></div>${u.modal?modal():""}`;
}

function tk(t,hide){const sep=TYPES[t.type]?.o?" → ":" ・ ";
  return `<div class="tk"><div class="tkh"><b>${t.type==="r"?"投票券":TYPES[t.type].n}</b><span>${yen(t.stake)}</span></div>
  <div class="tkb">${t.sel.map(i=>num(i)+esc(ents()[i]?.name)).join(sep)}</div>
  <div class="tkf"><span>オッズ ${t.odds.toFixed(1)}</span><span class="${t.payout?"hit":""}">${t.payout==null||hide?"":t.payout?"的中 "+yen(t.payout):"ハズレ"}</span></div></div>`;}

function setup(){const r=S.room;
  if(!r.type)return `<div class="card"><h2>ギャンブルのタイプを選択</h2><div class="two">
  <button class="big" data-act="settype" data-v="ranking"><b>順位型</b><span>競馬のように着順で的中が決まる。全券種のオッズを自動生成</span></button>
  <button class="big" data-act="settype" data-v="roulette"><b>当たり外れ型</b><span>ルーレットのように選択肢ごとに当たり外れが出る</span></button></div></div>`;
  const rl=isRl(),d=S.ui.draft||(S.ui.draft={title:r.title||"",ent:ents().map(e=>({...e})),rate:r.rate??"",init:"",dl:""});
  return `<div class="card"><h2>${rl?"選択肢と払戻倍率":"出走馬と単勝オッズ"}</h2>
  <label>タイトル<input id="in-title" data-m="title" value="${esc(d.title)}"></label>
  <table>${d.ent.map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td><input id="en${i}" data-m="en:${i}" placeholder="名前" value="${esc(e.name)}"></td>
  <td><input id="eo${i}" data-m="eo:${i}" type="number" step="0.1" placeholder="${rl?"倍率":"単勝オッズ"}" value="${e.odds??""}" style="width:110px"></td>
  <td><button class="red" data-act="delent" data-v="${i}">削除</button></td></tr>`).join("")}</table>
  <button data-act="addent">追加</button>
  ${rl?"":`<label>払戻率（0.5〜1。JRAは約0.8）<input id="in-rate" data-m="rate" type="number" step="0.01" value="${d.rate}"></label>`}
  ${r.initBalance==null?`<label>初期残高（参加者全員に付与）<input id="in-init" data-m="init" type="number" step="100" value="${d.init}"></label>`:""}
  <label>発売時間（分・空欄なら手動で締切）<input id="in-dl" data-m="dl" type="number" min="1" value="${d.dl}"></label>
  <button class="primary" data-act="start">発売開始</button> <button data-act="settype" data-v="">タイプを選び直す</button></div>`;}

function board(){const r=S.room,rl=isRl(),O=rl?null:odds(),pool=Object.values(r.tickets||{}).reduce((a,t)=>a+t.stake,0);
  return `<div class="card"><h2>${rl?"オッズ（的中時の払戻倍率）":"出馬表"}</h2><table><tr><th>${rl?"No":"馬番"}</th><th>名前</th><th>${rl?"倍率":"単勝"}</th>${rl?"":"<th>複勝</th>"}</tr>
  ${ents().map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td>${esc(e.name)}</td><td><b>${e.odds.toFixed(1)}</b></td>${rl?"":`<td>${O.place[i].toFixed(1)}</td>`}</tr>`).join("")}</table>
  <div class="small" style="margin-top:8px">発売額合計 <b>${yen(pool)}</b></div></div>`;}

function betForm(){const r=S.room,u=S.ui,rl=isRl(),t=rl?"r":u.type,k=t?(rl?1:TYPES[t].k):0,st=Number(u.stake)||0;
  const ok=t&&u.sel.length===k,od=ok?getOdds(t,u.sel):null;
  return `<div class="card"><h2>投票</h2>${rl?"":`<div class="tabs">${Object.entries(TYPES).map(([id,v])=>`<button class="tab ${u.type===id?"on":""}" data-act="type" data-v="${id}">${v.n}</button>`).join("")}</div>`}
  ${t?`<p class="hint">${rl?"賭ける対象を選択":`${k}頭を選択${TYPES[t].o?"（選択順が着順）":""}`}</p><div>${ents().map((e,i)=>`<button class="ent ${u.sel.includes(i)?"on":""}" data-act="pick" data-v="${i}">${num(i)}${esc(e.name)}${TYPES[t]?.o&&u.sel.includes(i)?`<i>${u.sel.indexOf(i)+1}</i>`:""}</button>`).join("")}</div>`:`<p class="hint">券種を選択してください</p>`}
  <div class="row"><span>金額 <input id="in-stake" data-m="stake" type="number" step="100" min="100" placeholder="100円単位" value="${u.stake}"></span><span>オッズ <b>${od?od.toFixed(1):"-"}</b></span><span>的中時 <b>${od&&st?yen(Math.floor(st*od/10)*10):"-"}</b></span></div>
  <button class="primary" data-act="review" ${ok&&st?"":"disabled"}>購入内容を確認</button></div>`;}

function modal(){const u=S.ui,rl=isRl(),t=rl?"r":u.type,st=Number(u.stake),od=getOdds(t,u.sel);
  return `<div class="ov"><div class="md"><h2>購入内容のご確認</h2>${tk({type:t,sel:u.sel,stake:st,odds:od})}
  <p>的中時の払戻 <b>${yen(Math.floor(st*od/10)*10)}</b></p><p class="warn">確定後の取消はできません。残高から ${yen(st)} が引き落とされます。</p>
  <button data-act="cancel">戻る</button> <button class="red" data-act="buy" style="float:right;padding:10px 18px">購入を確定する</button></div></div>`;}

function topup(){const T=S.ui.top;if(!T)return "";const c=T.m==="card";
  return `<div class="card"><h2>入出金</h2><div class="tabs"><button class="tab ${c?"on":""}" data-act="tm" data-v="card">クレジットカード</button><button class="tab ${c?"":"on"}" data-act="tm" data-v="atm">ATM</button></div>
  <p class="small">架空の画面です。実在のカード番号・暗証番号は入力しないでください。承認はマスターが行います。</p>
  ${c?`<div class="cc"><div class="ccn">${esc(T.no?T.no.replace(/\D/g,"").replace(/(.{4})/g,"$1 ").trim():"**** **** **** ****")}</div><div>${esc(T.nm||"CARD HOLDER")}　${esc(T.ex||"MM/YY")}</div></div>
  <label>カード番号（16桁）<input id="t-no" data-m="t:no" inputmode="numeric" maxlength="19" value="${esc(T.no||"")}"></label>
  <label>名義<input id="t-nm" data-m="t:nm" value="${esc(T.nm||"")}"></label><label>有効期限<input id="t-ex" data-m="t:ex" placeholder="MM/YY" value="${esc(T.ex||"")}"></label>`
  :`<label>暗証番号（4桁）<input id="t-pin" data-m="t:pin" type="password" maxlength="4" inputmode="numeric" value="${esc(T.pin||"")}"></label>`}
  <label>${c?"利用金額（請求額に加算）":"お引き出し金額"}<input id="t-amt" data-m="t:amt" type="number" step="100" value="${T.amt??""}"></label>
  <button class="primary" data-act="topsub">申請する</button></div>`;}

function control(){const r=S.room,u=S.ui,rl=isRl();
  if(r.status==="open")return `<div class="card"><h2>マスター操作</h2><button class="red" data-act="close">発売を締め切る</button></div>`;
  const inp=rl?ents().map((e,i)=>`<label style="display:inline-block;margin-right:12px"><input type="checkbox" style="display:inline;width:auto" data-m="win:${i}" ${u.wins.includes(i)?"checked":""}> ${esc(e.name)}</label>`).join("")
    :[0,1,2].map(j=>`<label>${j+1}着<select data-m="res:${j}"><option value="">選択</option>${ents().map((e,i)=>`<option value="${i}" ${u.res[j]!==""&&+u.res[j]===i?"selected":""}>${i+1} ${esc(e.name)}</option>`).join("")}</select></label>`).join("");
  return `<div class="card"><h2>結果入力</h2>${rl?"<p class='hint'>当たりを選択（複数可、なしも可）</p>":""}${inp}<button class="primary" data-act="settle">結果を確定して払戻</button></div>`;}

function resultView(){const r=S.room,res=r.result||{},A=S.anim,isM=r.master===uid;let body;
  if(isRl()){const w=res.wins||[];body=w.length?w.map((i,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${2+j*.6}s">${esc(ents()[i].name)}</div>`).join(""):`<div class="rank ${A?"rv":""}" style="animation-delay:2s">全てハズレ</div>`;}
  else{const d=[4,2.6,.9];body=(res.order||[]).map((i,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${d[j]}s">${j+1}着　${num(i)}${esc(ents()[i].name)}</div>`).join("");}
  return `<div class="card"><h2>${A?"<span class='pulse'>判定中</span>":"結果"}</h2>${body}${isM&&!A?`<button data-act="next">次のラウンドへ</button>`:""}</div>`;}

function hit(r,t,res){if(r.type==="roulette")return(res.wins||[]).includes(t.sel[0]);
  const o=res.order,s=t.sel,top=o.slice(0,3);
  switch(t.type){case"win":return s[0]===o[0];case"place":return top.includes(s[0]);case"quinella":return s.every(x=>o.slice(0,2).includes(x));
    case"exacta":return s[0]===o[0]&&s[1]===o[1];case"wide":case"trio":return s.every(x=>top.includes(x));case"trifecta":return s.every((x,i)=>x===o[i]);}}

async function buy(){const r=S.room,u=S.ui,rl=isRl(),t=rl?"r":u.type,st=Number(u.stake);u.modal=false;
  if(r.status!=="open"||(r.deadline&&Date.now()>r.deadline)){render();return alert("発売は締め切られました");}
  const od=getOdds(t,u.sel);
  const res=await runTransaction(ref(db,`rooms/${S.code}/players/${uid}/balance`),b=>(b>=st?b-st:undefined));
  if(!res.committed){render();return alert("残高が足りません");}
  await push(R("tickets"),{uid,name:S.name,type:t,sel:u.sel,stake:st,odds:od,at:Date.now()});u.sel=[];u.stake="";render();}
async function start(){const r=S.room,d=S.ui.draft,rl=isRl();
  if(!d.ent.length||d.ent.some(e=>!String(e.name).trim()||!(Number(e.odds)>=1.1)))return alert("全ての名前と、1.1以上のオッズを入力してください");
  if(!rl&&(d.ent.length<3||d.ent.length>18))return alert("出走数は3〜18です");
  if(!rl&&!(Number(d.rate)>=0.5&&Number(d.rate)<=1))return alert("払戻率は0.5〜1で入力してください");
  const up={title:d.title.trim(),entrants:d.ent.map(e=>({name:String(e.name).trim(),odds:Number(e.odds)})),status:"open",deadline:Number(d.dl)>0?Date.now()+Number(d.dl)*60000:null};
  if(!rl)up.rate=Number(d.rate);
  if(r.initBalance==null){const n=Number(d.init);if(!(n>=100))return alert("初期残高を入力してください");up.initBalance=n;
    Object.entries(r.players||{}).forEach(([id,p])=>up[`players/${id}/balance`]=(p.balance||0)+n);}
  await update(R(),up);S.ui.draft=null;S.ui.sel=[];S.ui.type=null;}
async function settle(){const r=S.room,u=S.ui;if(r.status!=="closed")return;let result;
  if(isRl())result={wins:u.wins};else{if(u.res.some(v=>v==="")||new Set(u.res).size<3)return alert("1〜3着を重複なく選んでください");result={order:u.res.map(Number)};}
  const pay={},up={result,status:"settled",settledAt:Date.now()};
  Object.entries(r.tickets||{}).forEach(([id,t])=>{const p=hit(r,t,result)?Math.floor(t.stake*t.odds/10)*10:0;up[`tickets/${id}/payout`]=p;if(p)pay[t.uid]=(pay[t.uid]||0)+p;});
  await update(R(),up);
  for(const[id,p]of Object.entries(pay))await runTransaction(ref(db,`rooms/${S.code}/players/${id}/balance`),b=>(b||0)+p);}

const acts={
  create:()=>{if(!S.name.trim())return alert("名前を入力してください");create();},
  join:()=>{if(!S.name.trim()||!S.hcode.trim())return alert("名前とコードを入力してください");join(S.hcode.trim().toUpperCase());},
  leave:()=>{unsub&&unsub();localStorage.removeItem("code");S.code="";S.room=null;render(true);},
  settype:v=>{S.ui.draft=null;update(R(),{type:v||null});},
  addent:()=>{S.ui.draft.ent.push({name:"",odds:""});render();},
  delent:v=>{S.ui.draft.ent.splice(v,1);render();},
  start,buy,settle,
  close:async()=>{if(closing)return;closing=true;await update(R(),{status:"closed"});closing=false;},
  next:()=>{S.ui.draft=null;S.ui.res=["","",""];S.ui.wins=[];update(R(),{status:"setup",tickets:null,result:null,settledAt:null,deadline:null});},
  type:v=>{S.ui.type=v;S.ui.sel=[];render();},
  pick:v=>{const u=S.ui,i=+v,t=isRl()?"r":u.type;if(!t)return;const k=isRl()?1:TYPES[t].k;
    if(u.sel.includes(i))u.sel=u.sel.filter(x=>x!==i);else if(k===1)u.sel=[i];else if(u.sel.length<k)u.sel.push(i);render();},
  review:()=>{S.ui.modal=true;render();},cancel:()=>{S.ui.modal=false;render();},
  topen:()=>{S.ui.top=S.ui.top?null:{m:"card"};render();},tm:v=>{S.ui.top={m:v};render();},
  topsub:async()=>{const T=S.ui.top,amt=Number(T.amt),c=T.m==="card";
    if(!(amt>=100&&amt%100===0))return alert("金額は100円単位で入力してください");
    let last4="";if(c){const n=(T.no||"").replace(/\D/g,"");if(n.length!==16||!T.nm||!/^\d\d\/\d\d$/.test(T.ex||""))return alert("カード情報を正しく入力してください");last4=n.slice(-4);}
    else if(!/^\d{4}$/.test(T.pin||""))return alert("暗証番号は4桁で入力してください");
    await push(R("requests"),{uid,name:S.name,method:T.m,amount:amt,last4,status:"pending",at:Date.now()});S.ui.top=null;render();},
  apv:async id=>{const q=S.room.requests[id];if(q.status!=="pending")return;await update(R(`requests/${id}`),{status:"approved"});
    const b=`rooms/${S.code}/players/${q.uid}`;await runTransaction(ref(db,b+"/balance"),x=>(x||0)+q.amount);
    if(q.method==="card")await runTransaction(ref(db,b+"/debt"),x=>(x||0)+q.amount);},
  rej:id=>update(R(`requests/${id}`),{status:"rejected"})
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(b&&!b.disabled)acts[b.dataset.act](b.dataset.v);});
document.addEventListener("input",e=>{const m=e.target.dataset.m;if(!m)return;const v=e.target.value,[k,i]=m.split(":"),u=S.ui;
  if(k==="name")S.name=v;else if(k==="hcode")S.hcode=v;else if(k==="stake"){u.stake=v;render();}
  else if(k==="t"){u.top[i]=v;render();}
  else if(k==="title")u.draft.title=v;else if(k==="en")u.draft.ent[i].name=v;else if(k==="eo")u.draft.ent[i].odds=v;
  else if(k==="rate")u.draft.rate=v;else if(k==="init")u.draft.init=v;else if(k==="dl")u.draft.dl=v;
  else if(k==="res")u.res[i]=v;else if(k==="win")u.wins=e.target.checked?[...u.wins,+i]:u.wins.filter(x=>x!==+i);});
setInterval(()=>{const r=S.room;if(!r||r.status!=="open"||!r.deadline)return;const l=r.deadline-Date.now(),e=document.getElementById("cd");
  if(e){e.textContent=l>0?`${Math.floor(l/60000)}:${String(Math.floor(l%60000/1000)).padStart(2,"0")}`:"締切";e.className=l<=30000?"cd warn":"cd";}
  if(l<=0&&r.master===uid)acts.close();},1000);
if(S.code)join(S.code).catch(()=>{});else render(true);
