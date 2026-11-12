import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getDatabase,ref,onValue,set,update,push,runTransaction,get} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {firebaseConfig} from "./config.js";
import {calcOdds,TYPES,key} from "./odds.js";

const db=getDatabase(initializeApp(firebaseConfig)), $=s=>document.querySelector(s);
let off=0;const now=()=>Date.now()+off;onValue(ref(db,".info/serverTimeOffset"),x=>{off=x.val()||0;});
const uid=localStorage.uid||(localStorage.uid=crypto.randomUUID());
const S={code:localStorage.code||"",name:localStorage.name||"",room:null,hcode:"",lock:0,anim:false,seen:{},
  ui:{sel:[],type:null,stake:"",draft:null,res:["","",""],wins:[],modal:false,cfg:"10000",gt:null,ga:"",method:"normal",axis:[],part:[],pos:0,tgt:"axis",fm:[[],[],[]],ft:0,vw:null,gsel:null,balm:false,bsel:[],balmsg:"",mul:"",setm:false,atm:null,ot:"quinella",ax:0}};
let unsub=null,oc={k:"",v:null},closing=false;
const R=p=>ref(db,`rooms/${S.code}${p?"/"+p:""}`);
const yen=n=>(n||0).toLocaleString()+"円", esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ents=()=>S.room.entrants||[], isRl=()=>S.room.type==="roulette";
const num=i=>isRl()?"":`<span class="num n${i%8}">${i+1}</span>`;
const odds=()=>{const r=S.room,k=JSON.stringify([ents(),r.rate]);if(oc.k!==k)oc={k,v:calcOdds(ents(),r.rate)};return oc.v};
const getOdds=(t,sel)=>isRl()?(sel[0]<0?S.room.groups[-sel[0]-1].odds:ents()[sel[0]].odds):odds()[t][key(t,sel)];

function watch(){unsub&&unsub();unsub=onValue(R(),s=>{const v=s.val();if(v&&v.kicked&&v.kicked[uid]){S.room=null;alert("ルームから退出させられました");acts.leave();return;}S.room=v;atmSync(v);let f=false;
  if(v&&v.status==="settled"&&v.settledAt&&!S.seen[v.settledAt]){S.seen[v.settledAt]=1;
    if(!v.skip&&Math.abs(now()-v.settledAt)<15000){S.anim=true;S.lock=now()+6800;f=true;setTimeout(()=>{S.anim=false;S.lock=0;render(true)},6900);}}
  render(f,true);});}
async function join(code){
  const snap=await get(ref(db,`rooms/${code}`)),bad=m=>{if(m)alert(m);S.code="";localStorage.removeItem("code");render(true);};
  if(!snap.exists())return bad("ルームが見つかりません");
  const rv=snap.val(),ps=rv.players||{};
  if((rv.kicked||{})[uid])return bad("このルームには参加できません");
  if(!ps[uid]){const nm=S.name.trim().toLowerCase(),dup=Object.entries(ps).find(([,p])=>String(p.name||"").trim().toLowerCase()===nm);
    if(dup){if(confirm(`「${dup[1].name}」さんは既に参加しています。同じ人として入室し、状態を復元しますか？\n（別の人の場合は「キャンセル」して、別の名前で参加してください）`)){localStorage.uid=dup[0];localStorage.code=code;localStorage.name=S.name;location.href=location.pathname+"?room="+code;return;}return bad("別の名前を入力して参加してください");}}
  S.code=code;localStorage.code=code;localStorage.name=S.name;
  if(!ps[uid])await set(ref(db,`rooms/${code}/players/${uid}`),{name:S.name,balance:rv.initBalance??0,debt:0});
  history.replaceState(null,"",location.pathname+"?room="+code);
  watch();}
async function create(){const code=Math.random().toString(36).slice(2,7).toUpperCase();
  await set(ref(db,`rooms/${code}`),{master:uid,status:"config"});await join(code);}

function morph(a,b){
  if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){a.replaceWith(b.cloneNode(true));return;}
  if(a.nodeType===3){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return;}
  if(a.nodeType!==1||a.id==="odo")return;
  const inp=/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName),foc=a===document.activeElement;
  for(const t of[...a.attributes])if(!b.hasAttribute(t.name)&&!(inp&&t.name==="value"))a.removeAttribute(t.name);
  for(const t of[...b.attributes]){if(inp&&foc&&t.name==="value")continue;if(a.getAttribute(t.name)!==t.value)a.setAttribute(t.name,t.value);}
  if(inp){if(!foc){if(a.type==="checkbox")a.checked=b.hasAttribute("checked");else a.value=b.getAttribute("value")??"";}return;}
  const ac=[...a.childNodes],bc=[...b.childNodes];
  bc.forEach((n,i)=>ac[i]?morph(ac[i],n):a.appendChild(n.cloneNode(true)));
  for(let i=ac.length-1;i>=bc.length;i--)ac[i].remove();
}
function render(f){
  if(!f&&now()<S.lock)return;
  const nx=document.createElement("div");
  nx.innerHTML=!S.code?home():!S.room?`<p class="c">読み込み中（ルームが無い場合は<button data-act="leave">戻る</button>）</p>`:room();
  const app=$("#app"),ac=[...app.childNodes],bc=[...nx.childNodes];
  bc.forEach((n,i)=>ac[i]?morph(ac[i],n):app.appendChild(n));
  for(let i=ac.length-1;i>=bc.length;i--)ac[i].remove();
  hookOdo(nx.querySelector("#odo"));
  refreshBet();
}
function odoHTML(v,N){const s=String(Math.max(0,v)).padStart(N," ");let h="";
  for(let i=0;i<N;i++){const b=s[i]===" ";if(i>0&&(N-i)%3===0)h+=`<span class="odc ${s[i-1]===" "?"off":""}" data-p="${i}">,</span>`;
    h+=`<span class="od ${b?"off":""}"><span class="odi" style="transform:translateY(-${b?10:s[i]}em)">${"0123456789 ".split("").map(c=>`<i>${c===" "?"&nbsp;":c}</i>`).join("")}</span></span>`;}
  return h;}
function updateOdo(el,v){const N=+el.dataset.n,s=String(Math.max(0,v)).padStart(N," "),was=+el.dataset.v;
  el.querySelectorAll(".od").forEach((c,i)=>{c.classList.toggle("off",s[i]===" ");c.firstChild.style.transform=`translateY(-${s[i]===" "?10:s[i]}em)`;});
  el.querySelectorAll(".odc").forEach(c=>c.classList.toggle("off",s[+c.dataset.p-1]===" "));
  el.dataset.v=v;if(v!==was){el.classList.remove("up","down");void el.offsetWidth;el.classList.add(v>was?"up":"down");clearTimeout(S.odoT);S.odoT=setTimeout(()=>el.classList.remove("up","down"),1600);}}
function hookOdo(nb){let el=document.getElementById("odo");if(!el)return;const t=+(nb||el).dataset.t;
  if(nb&&+el.dataset.n<String(t).length){const c=nb.cloneNode(true);el.replaceWith(c);el=c;}
  void el.offsetWidth;updateOdo(el,t);S.odoPrev=t;}
function balModal(){const u=S.ui,P=S.room.players||{},ps=Object.entries(P),sel=u.bsel.filter(id=>P[id]),all=ps.length>0&&sel.length===ps.length;
  return `<div class="ov"><div class="balm"><div class="sign"><span>残高の操作</span><button class="ab" data-act="balclose">閉じる</button></div>
  <p class="small">全員の残高・借入がリアルタイムで表示されます。数字を直接書き換えて確定（Enterか枠外タップ）すると、その場で反映されます。</p>
  <table class="bt"><tr><th></th><th>名前</th><th>残高</th><th>借入</th></tr>${ps.map(([id,p])=>`<tr><td><input type="checkbox" id="bs-${id}" data-m="bsel:${id}" ${sel.includes(id)?"checked":""}></td><td><label for="bs-${id}">${esc(p.name)}</label></td>
  <td><input class="ed" type="number" data-ed="balance:${id}" value="${p.balance||0}"></td><td><input class="ed" type="number" data-ed="debt:${id}" value="${p.debt||0}"></td></tr>`).join("")}</table>
  <div style="margin:6px 0"><button class="gray" data-act="bsall">${all?"全員のチェックを外す":"全員にチェック"}</button></div>
  <div class="row"><input id="in-ga" data-m="ga" type="number" step="100" placeholder="金額（100円単位）" value="${u.ga}"></div>
  <div><button class="ok" data-act="adj" data-v="b+">残高を追加</button><button class="red" data-act="adj" data-v="b-">残高を削除</button><button class="ok" data-act="adj" data-v="d+">借入を追加</button><button class="red" data-act="adj" data-v="d-">借入を削除</button></div>
  <div class="row"><input id="in-mul" data-m="mul" type="text" inputmode="decimal" placeholder="倍率（例 1.5）" value="${esc(u.mul)}" style="width:130px"><button class="red" data-act="muldebt">チェックした人の借入を◯倍にする</button></div>
  <p class="small">${esc(u.balmsg||"チェックを入れた人に、まとめて操作できます。借入の追加・削除では手持ち残高は変わりません。")}</p></div></div>`;}
function setModal(){const r=S.room,on=(k,d)=>d?r[k]!==false:!!r[k],sw=(k,d)=>`<label class="sw"><input type="checkbox" data-m="set:${k}" ${on(k,d)?"checked":""}><span></span></label>`;
  return `<div class="ov"><div class="balm"><div class="sign"><span>設定</span><button class="ab" data-act="setclose">閉じる</button></div>
  <div class="srow"><span>購入時間に他の人の馬券を公開</span>${sw("pubOpen",false)}</div>
  <div class="srow"><span>結果発表後に他の人の馬券を公開</span>${sw("pubEnd",true)}</div>
  <div class="srow"><span>参加者全員の残高を公開</span>${sw("pubBal",true)}</div>
  <div class="srow"><span>馬券の購入枚数を制限</span>${sw("limOn",false)}</div>
  ${r.limOn?`<div class="srow"><span>1ラウンドに買える上限（枚）</span><input id="in-limn" data-m="limN" type="number" min="1" value="${r.limN??""}" style="width:90px"></div>${r.limN>=1?"":`<p class="small" style="color:#b3261e">上限の枚数を入力してください（未入力の間は制限されません）</p>`}`:""}
  <p class="small">マスターは設定にかかわらず、常に全員の馬券と残高を見られます。「枚」は馬券の購入回数（1回の購入＝1枚）で数えます。</p></div></div>`;}
const GC=["#2a6fd6","#d62828","#2e9e4f","#f28a1c","#8e44ad","#0a8f8f","#c2185b","#8d6e00"];
const grpRows=r=>(r.groups||[]).map((g,gi)=>`<tr class="grow"><td><span class="gdot" style="background:${GC[gi%GC.length]}"></span></td><td>${esc(g.name)}<span class="gtag">大枠</span>${g.note?`<div class="en-note">${esc(g.note)}</div>`:""}</td><td><b>${g.odds.toFixed(1)}</b></td></tr>`).join("");
function groupSetup(d){
  const body=d.gOn?`${d.groups.map((g,gi)=>`<div class="gbox" style="border-left:5px solid ${GC[gi%GC.length]}"><input id="gn${gi}" data-m="gn:${gi}" type="text" placeholder="大枠の名前（例：偶数）" value="${esc(g.name)}">
    ${d.noteOn?`<input id="gt${gi}" class="note" data-m="gt:${gi}" type="text" maxlength="200" placeholder="補足（任意）" value="${esc(g.note||"")}">`:""}
    <p class="small">含まれる項目を選択</p><div class="hgrid">${d.ent.map((e,i)=>`<button class="ent ${g.items.includes(i)?"on":""}" data-act="gtog" data-v="${gi}|${i}"><span class="nm">${esc(e.name||"（未入力）")}</span></button>`).join("")}</div>
    <div class="row"><span>倍率 <input id="go${gi}" data-m="go:${gi}" type="number" step="0.1" value="${g.odds??""}" style="width:90px"></span><button data-act="gauto" data-v="${gi}">オッズを自動算出</button><button class="red" data-act="gdel" data-v="${gi}">削除</button></div></div>`).join("")}<button data-act="gadd">大枠を追加</button><p class="small">自動算出：含まれる項目のオッズから、いずれかが当たる場合の倍率を計算して、倍率の欄に入れます（あとから手で直せます）。</p>`:"";
  return `<div class="chk"><input type="checkbox" id="in-gon" data-m="gon" ${d.gOn?"checked":""}><label for="in-gon">大枠を使う（偶数・奇数・赤・黒など、複数の項目にまたがる賭け方）</label></div>${body}`;}
function groupTable(){const r=S.room;if(r.type!=="roulette"||r.status==="setup"||r.status==="config")return "";const G=r.groups||[];if(!G.length)return "";
  const E=ents(),W=(r.status==="settled"&&!S.anim&&r.result)?(r.result.wins||[]):[],hitG=g=>g.items.some(i=>W.includes(i));
  return `<div class="card"><h2>大枠一覧</h2><p class="hint">● がその大枠に含まれる項目です。複数の大枠に含まれる項目は、横に●が並びます。</p>
  <div class="ow"><table class="gt"><tr><th></th>${G.map((g,gi)=>`<th class="gh${hitG(g)?" hitg":""}" style="border-bottom:3px solid ${GC[gi%GC.length]}"><span>${esc(g.name)}</span><small>×${g.odds.toFixed(1)}</small>${hitG(g)?"<small>当たり</small>":""}</th>`).join("")}</tr>
  ${E.map((e,i)=>`<tr><th class="gi${W.includes(i)?" hitrow":""}">${i+1} ${esc(e.name)}</th>${G.map((g,gi)=>g.items.includes(i)?`<td class="gy" style="color:${GC[gi%GC.length]}">●</td>`:`<td></td>`).join("")}</tr>`).join("")}</table></div>
  ${G.map((g,gi)=>`<div class="gl"><span class="dot" style="background:${GC[gi%GC.length]}"></span><b>${esc(g.name)}</b>（×${g.odds.toFixed(1)}）${g.note?`<div class="en-note">${esc(g.note)}</div>`:""}<div class="small">${g.items.map(i=>esc((E[i]||{}).name)).join("・")}</div></div>`).join("")}
  <p class="small">大枠は、含まれる項目のどれか1つでも当たれば1回の当たりとして払戻します（複数の項目が当たっても1回分です）。</p></div>`;}
const pubT=r=>`<div class="chk"><input type="checkbox" id="in-pub" data-m="pub" ${r.pubOpen?"checked":""}><label for="in-pub">購入中も他の人の馬券を見られるようにする</label></div>`;
function allTickets(){const r=S.room,st=r.status,isM=r.master===uid;
  if(!(isM||(st==="settled"&&r.pubEnd!==false)||((st==="open"||st==="closed")&&r.pubOpen)))return "";
  const ts=Object.entries(r.tickets||{}),ps=r.players||{};if(!ts.length)return "";
  const by={};ts.forEach(([id,t])=>(by[t.uid]=by[t.uid]||[]).push([id,t]));
  const rows=Object.entries(by).map(([id,a])=>({id,name:(ps[id]||{}).name||a[0][1].name||"?",n:a.length,stk:a.reduce((x,[,t])=>x+t.stake,0),py:a.reduce((x,[,t])=>x+(t.payout||0),0),a})),sel=S.ui.vw&&by[S.ui.vw]?S.ui.vw:null,fin=st==="settled"&&!S.anim;
  return `<div class="card"><h2>みんなの馬券${st==="settled"?"":"（公開中）"}</h2><table><tr><th>名前</th><th>購入額</th>${fin?"<th>払戻</th><th>収支</th>":""}</tr>
  ${rows.map(x=>`<tr class="vr" data-act="vw" data-v="${x.id}"><td>${esc(x.name)}（${x.n}枚）</td><td>${yen(x.stk)}</td>${fin?`<td>${yen(x.py)}</td><td>${x.py-x.stk>=0?"+":""}${yen(x.py-x.stk)}</td>`:""}</tr>`).join("")}</table>
  <p class="small">名前を押すと、その人の馬券を表示します</p>${sel?by[sel].sort((a,b)=>b[1].at-a[1].at).map(([id,t])=>tk(t,S.anim,id)).join(""):""}</div>`;}
const home=()=>`<div class="hero"><img class="logo" src="logo.svg" alt=""><h1>NQKEIBA</h1><div class="sub">NQ競馬</div><p>身近なものを、賭けの対象に。架空通貨のみ使用。</p></div>
<div class="card" style="max-width:420px;margin:auto"><label>名前<input id="in-name" data-m="name" value="${esc(S.name)}" maxlength="12"></label>
<button class="primary" data-act="create">ルームを作る</button><hr style="border:0;border-top:1px solid #e6ece7;margin:16px 0">
${S.hcode?`<p class="small">ルーム ${esc(S.hcode)} に参加します。名前を入れて「参加する」を押してください。</p>`:""}<label>ルームコード<input id="in-code" data-m="hcode" value="${esc(S.hcode)}" maxlength="8"></label><button class="primary" style="background:#fff;color:#14532d" data-act="join">参加する</button></div>`;

const cdt=()=>{const l=S.room.deadline-now();return l>0?`${Math.floor(l/60000)}:${String(Math.floor(l%60000/1000)).padStart(2,"0")}`:"締切";};
function config(){return `<div class="card"><h2>部屋全体の設定</h2><label>全員の初期金額（円）<input id="in-cfg" data-m="cfg" type="number" step="1000" value="${S.ui.cfg}"></label>
  <button class="primary" data-act="cfgok">この設定で部屋を開く</button></div>`;}
function room(){
  const r=S.room,u=S.ui,me=(r.players||{})[uid],isM=r.master===uid,st=r.status,dl=st==="open"&&r.deadline;
  const lab={config:"部屋設定中",setup:"準備中",open:"発売中",closed:"発売締切",settled:"結果確定"}[st];
  const reqs=Object.entries(r.requests||{}),pend=reqs.filter(([,q])=>q.status==="pending"),mine=reqs.filter(([,q])=>q.uid===uid).sort((a,b)=>b[1].at-a[1].at).slice(0,3);
  const ts=Object.entries(r.tickets||{}).filter(([,t])=>t.uid===uid).sort((a,b)=>b[1].at-a[1].at),net=p=>(p.balance||0)-(p.debt||0);
  const showBal=isM||r.pubBal!==false;
  const bal=(me&&me.balance)||0,pv=S.odoPrev??bal,ON=Math.max(String(pv).length,String(bal).length);
  const main=st==="config"?(isM?config():`<div class="card c">マスターが部屋の設定中です</div>`):st==="setup"?(isM?setup():`<div class="card c">マスターがラウンドの準備中です</div>`)
    :(dl?`<div class="banner">まもなく発売終了　締切まで <span class="cd2" data-cd>${cdt()}</span></div>`:"")+board()+(st==="open"&&me?betForm():"")+oddsTable()+groupTable()+(isM&&(st==="open"||st==="closed")?control():"")+(st==="settled"?resultView():"")+allTickets();
  return `<div class="bar"><div><img class="logo-s" src="logo.svg" alt=""><b>${esc(r.title||"ルーム")}</b> <span class="small" style="color:#cfe">${r.type==="roulette"?"当たり外れ型":r.type?"順位型":""}</span></div>
  <div>${dl?`<span class="cd" data-cd>${cdt()}</span>`:""}<span class="pill ${st}">${lab}</span></div></div>
  <div class="grid"><main>${main}</main><aside>
  <div class="card"><div class="small">ルームコード <b>${S.code}</b> ${isM?"(マスター)":""} <button style="float:right;padding:2px 8px" data-act="leave">退出</button></div>
  <div class="small" style="margin-top:8px">手持ち残高</div><div class="amt"><span id="odo" class="odo" data-n="${ON}" data-v="${pv}" data-t="${bal}">${odoHTML(pv,ON)}</span><span class="odu">円</span></div>
  <div class="small">借入残高 ${yen(me&&me.debt)}</div><button data-act="atmopen" style="margin-top:8px">ATMを利用する</button> <button data-act="copylink" style="margin-top:8px">招待リンクをコピー</button></div>
  ${mine.length?`<div class="card"><h3>ご融資の申請</h3>${mine.map(([,q])=>`<div class="small">${yen(q.amount)}　${{pending:"承認待ち",approved:"承認",rejected:"却下"}[q.status]}</div>`).join("")}</div>`:""}
  ${isM?`<div class="card"><button data-act="balopen">残高を操作する</button> <button data-act="setopen">設定</button></div>`:""}${isM&&pend.length?`<div class="card"><h3>ご融資の申請（${pend.length}件）</h3>${pend.map(([id,q])=>`<div class="rq"><span>${esc(q.name)} / <b>${yen(q.amount)}</b></span><button class="ok" data-act="apv" data-v="${id}">承認</button><button class="red" data-act="rej" data-v="${id}">却下</button></div>`).join("")}</div>`:""}
  ${ts.length?`<div class="card"><h3>自分の馬券</h3>${ts.map(([id,t])=>tk(t,S.anim,id)).join("")}</div>`:""}
  <div class="card"><h3>参加者${showBal?"（資産順）":""}</h3>${Object.entries(r.players||{}).sort((a,b)=>showBal?net(b[1])-net(a[1]):String(a[1].name).localeCompare(String(b[1].name))).map(([pid,p])=>`<div class="prow"><span class="pn">${esc(p.name)}</span>${showBal||pid===uid?`<span class="pb">資産 <b>${yen(net(p))}</b>${p.debt?`<small>借入 ${yen(p.debt)}</small>`:""}</span>`:""}${isM&&pid!==uid?`<button class="red kb" data-act="kick" data-v="${pid}">キック</button>`:""}</div>`).join("")}${isM&&Object.keys(r.kicked||{}).length?`<div class="small" style="margin-top:6px">キック済み：${Object.entries(r.kicked).map(([kid,kn])=>`${esc(kn)} <button class="kb" data-act="unkick" data-v="${kid}">解除</button>`).join("　")}</div>`:""}</div>
  </aside></div>${u.modal?modal():""}${u.balm&&isM?balModal():""}${u.setm&&isM?setModal():""}`;
}

const VT={win:["WIN","単勝"],place:["PLACE","複勝"],quinella:["QUINELLA","馬連"],exacta:["EXACTA","馬単"],wide:["WIDE","ワイド"],trio:["TRIO","3連複"],trifecta:["TRIFECTA","3連単"],r:["BET","投票"]};
function qr(seed){let h=7;for(const c of String(seed))h=(h*31+c.charCodeAt(0))>>>0;const N=21,fz=(x,y)=>(x<8&&y<8)||(x>12&&y<8)||(x<8&&y>12),rn=()=>((h=(h*1664525+1013904223)>>>0)>>>16)%2;let d="";
  for(let y=0;y<N;y++){let x=0;while(x<N){if(!fz(x,y)&&rn()){let e=x;while(e+1<N&&!fz(e+1,y)&&rn())e++;d+=`M${x} ${y}h${e-x+1}v1h-${e-x+1}z`;x=e+1;}else x++;}}
  const f=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#f6f8f6"/><rect x="${x+2}" y="${y+2}" width="3" height="3"/>`;
  return `<svg viewBox="0 0 21 21" shape-rendering="crispEdges"><path d="${d}"/>${f(0,0)}${f(14,0)}${f(0,14)}</svg>`;}
const sn=id=>{let h=0;for(const c of String(id))h=(h*131+c.charCodeAt(0))>>>0;const g=n=>{let x="";for(let i=0;i<n;i++){h=(h*1103515245+12345)>>>0;x+=(h>>>16)%10;}return x;};return [g(13),g(13),g(8),g(6)].join(" ");};
const WM=(()=>{let h="";[[39.5,[1.0,34.7,68.4]],[70.9,[-15.2,18.5,52.2,85.9]]].forEach(([x,ys])=>ys.forEach(y=>{h+=`<i style="left:${x}cqw;top:${y}cqw"></i>`;}));return `<div class="jt-wm">${h}</div><div class="jt-band"></div>`;})();
const cwid=(c,mono)=>mono?.6:/[0-9]/.test(c)?.6:c===" "?.35:/[\x00-\x7f]/.test(c)?.68:1;
function fit(txt,fs,cls=""){const mono=/mono/.test(cls),est=[...String(txt)].reduce((a,c)=>a+cwid(c,mono),0)*10;
  return `<svg class="fit ${cls}" viewBox="0 0 ${est.toFixed(1)} 11" style="width:min(100%,${(est/10*fs).toFixed(1)}cqw)"><text x="0" y="8.6" font-size="10" textLength="${est.toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(txt)}</text></svg>`;}
const edLabel=()=>{const r=S.room,e=r.ed;return typeof e==="number"?`第${e}回${r.grade?`（${r.grade}）`:""}`:(e||`第${r.round||1}回`);};
function tk(t,hide,id){const T=TYPES[t.type],v=(t.type==="r"&&t.meth==="大枠")?["GROUP","大枠"]:VT[t.type],rl=t.type==="r",cs=t.cs||[{s:t.sel||[]}],n=cs.length,per=t.per||t.stake,tot=t.stake||0,k=T?T.k:1,ord=T&&T.o,
  m=t.m||{k:n===1?"normal":"text",sel:cs[0].s||[]},sel=m.sel||[],ax=m.ax||[],pt=m.pt||[],d=new Date(t.at||now()),pay=t.payout,w=pay>0&&!hide,sheets=Math.round(tot/10),N1=i=>i+1,
  grid=a=>`<div class="jt-g">${ents().map((e,i)=>`<span class="${a.includes(i)?"s":""}">${i+1}</span>`).join("")}</div>`,
  amt=`<span class="jt-a">☆☆☆${per.toLocaleString()}円</span>`,star=(x,c)=>"★".repeat(Math.max(1,c-String(x).length));let r;
  if(rl)r=`<b class="jt-hn rl">${esc(t.disp)}</b>${cs[0].o?`<div class="jt-i">倍率 ×${cs[0].o.toFixed(1)}</div>`:""}${t.gm?`<div class="jt-i">対象：${esc(t.gm)}</div>`:""}${amt}`;
  else if(m.k==="text")r=`<b class="jt-c" style="font-size:5cqw">${esc(t.disp)}</b><div class="jt-i">組合せ数 <b>${n}</b></div>${amt}`;
  else if(m.k==="normal"&&k===1)r=`<div class="jt-row"><span class="jt-bx">${sel[0]+1}</span><b class="jt-hn">${esc((ents()[sel[0]]||{}).name||"")}</b></div>${amt}`;
  else if(m.k==="normal")r=`<div class="jt-row jt-ob">${sel.map(i=>`<span class="jt-bx2">${i+1}</span>`).join(ord?"<i>▶</i>":"<b class='jt-h'>-</b>")}</div>`+amt;
  else if(m.k==="box")r=`<div class="jt-lb">ボックス</div>${grid(sel)}<div class="jt-i">組合せ数 <b>${n}</b>　各組 ${amt}</div>`;
  else if(m.k==="formation"){const cols=Array.from({length:k},(_,j)=>((m.fm||[])[j])||[]);r=`<div class="jt-lb">フォーメーション</div><div class="jt-row jt-nag jt-fm">${cols.map(a=>a.length===1?`<span class="jt-bx2">${a[0]+1}</span>`:grid(a)).join("<i>▶</i>")}</div><div class="jt-i">組合せ数 <b>${n}</b>　各組 ${amt}</div>`;}
  else r=`<div class="jt-lb">${ord?(m.pos+1)+"着":""}流し</div><div class="jt-row jt-nag"><b class="jt-c">${ax.map(N1).join("-")}</b><i>▶</i>${grid(pt)}</div><div class="jt-i">組合せ数 <b>${n}</b>　各組 ${amt}</div>`;
  return `<div class="jtw"><div class="jt">${WM}
  <div class="jt-l"><div class="jt-d">${d.getFullYear()}年</div><div class="jt-v">${esc(S.code)}</div><div class="jt-rc"><b>${S.room.round||1}</b>レース</div>
  <div class="jt-q">${qr((id||"preview")+"a")}${qr((id||"preview")+"b")}</div><div class="jt-ed">${esc(edLabel())}</div><div class="jt-tt">${esc(S.room.title||"")}</div>
  <div class="jt-bt"><div class="jt-f">NQK 架空</div><div class="jt-f">${d.getMonth()+1}月${d.getDate()}日</div></div></div>
  <div class="jt-mid"><small>${v[0]}</small>${k>=2&&m.k==="normal"?"<em>普通</em>":""}<span>${v[1]}</span><small>${v[0]}</small></div>
  <div class="jt-rt"><div class="jt-r${!rl&&k===1?" ctr":""}">${r}</div><div class="jt-tot">${fit(`合計 ${star(sheets,6)}${sheets}枚 ${star(tot.toLocaleString(),7)}${tot.toLocaleString()}円`,3.4,"r")}</div><div class="jt-no">${fit(sn(id||"preview"),2.6,"r mono")}</div></div>${w?`<span class="stamp">的中</span>`:""}</div>
  ${hide||pay==null?"":w?`<div class="jt-res">払戻金 ￥${pay.toLocaleString()}</div>`:`<div class="jt-res x">ハズレ</div>`}</div>`;}

const jit=()=>1+(Math.random()-.5)*.16,fmtO=o=>o<100?Math.floor(o*10)/10:Math.floor(o);
function draftOdds(d){const rate=Number(d.rate)||1;if(d.mode!=="prob")return d.ent.map(e=>Number(e.odds));
  const ws=d.ent.map(e=>Number(e.w)||0),js=d.ent.map(e=>e.j||1);
  if(isRl())return ws.map((w,i)=>w>0&&w<100?Math.max(1.1,fmtO(rate/(w/100)*js[i])):NaN);
  const t=ws.reduce((a,b)=>a+b,0);return ws.map((w,i)=>w>0?Math.max(1.1,fmtO(rate*t/w*js[i])):NaN);}
function setup(){const r=S.room;
  if(!r.type)return `<div class="card"><h2>このラウンドのタイプを選択</h2><div class="two">
  <button class="big" data-act="settype" data-v="ranking"><b>順位型</b><span>競馬のように着順で的中が決まる。全券種のオッズを自動生成</span></button>
  <button class="big" data-act="settype" data-v="roulette"><b>当たり外れ型</b><span>ルーレットのように選択肢ごとに当たり外れが出る</span></button></div></div>`;
  const rl=isRl(),d=S.ui.draft||(S.ui.draft={title:r.title||"",ent:ents().map(e=>({name:e.name,odds:e.odds,w:e.w??"",j:e.j??jit(),note:e.note||""})),rate:r.rate??1,mode:r.pmode?"prob":"odds",ed:r.ed==null?"":String(r.ed),noteOn:ents().some(e=>e.note),gOn:!!(r.groups&&r.groups.length),groups:(r.groups||[]).map(g=>({name:g.name,note:g.note||"",odds:g.odds,items:[...(g.items||[])]}))}),pm=d.mode==="prob",od=pm?draftOdds(d):[];
  return `<div class="card"><h2>${rl?"選択肢と払戻倍率":"出走馬とオッズ"}</h2>
  <label>タイトル<input id="in-title" data-m="title" value="${esc(d.title)}"></label>
  <label>レース名の上の行（第◯回 など自由入力。空欄なら「第N回」）<input id="in-ed" data-m="ed" type="text" placeholder="例：第57回（GII）" value="${esc(d.ed)}"></label>
  <div class="tabs"><button class="tab ${pm?"":"on"}" data-act="smode" data-v="odds">オッズで入力</button><button class="tab ${pm?"on":""}" data-act="smode" data-v="prob">勝率で入力（オッズを自動計算）</button></div>
  ${pm?`<p class="hint">${rl?"それぞれが当たる確率(%)を入力":"なんとなくの勝ちやすさを数字で入力（合計100でなくてOK。大きいほど有力）"}<br>オッズには±8%ほどの揺らぎが自動で入ります <button class="gray" data-act="reroll">揺らぎを再抽選</button> <button class="gray" data-act="unjit">揺らぎを解除</button></p>`:""}
  <div class="chk"><input type="checkbox" id="in-noteon" data-m="noteon" ${d.noteOn?"checked":""}><label for="in-noteon">${rl?"各選択肢":"各馬"}の補足欄を使う（出馬表に小さく表示。馬券やボタンには出ません）</label></div>
  <table><tr><th></th><th>名前</th><th>${pm?"勝率":rl?"倍率":"単勝オッズ"}</th>${pm?"<th>オッズ</th>":""}<th></th></tr>
  ${d.ent.map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td><input id="en${i}" data-m="en:${i}" placeholder="名前" value="${esc(e.name)}"></td>
  ${pm?`<td><input id="ew${i}" data-m="ew:${i}" type="number" step="any" min="0" value="${e.w??""}" style="width:90px"></td><td><b id="od${i}">${od[i]>=1.1?od[i].toFixed(1):"-"}</b></td>`
  :`<td><input id="eo${i}" data-m="eo:${i}" type="number" step="0.1" value="${e.odds??""}" style="width:100px"></td>`}
  <td><button class="red" data-act="delent" data-v="${i}">削除</button></td></tr>${d.noteOn?`<tr class="nrow"><td></td><td colspan="${pm?3:2}"><input id="et${i}" class="note" data-m="et:${i}" type="text" maxlength="200" placeholder="補足（任意）例：前走1着・逃げ馬" value="${esc(e.note||"")}"></td><td></td></tr>`:""}`).join("")}</table>
  <button data-act="addent">追加</button><button class="gray" data-act="clr">出走馬・オッズをクリア</button>
  ${rl?groupSetup(d):""}
  <label>払戻率（0.5〜1）<input id="in-rate" data-m="rate" type="number" step="0.01" value="${d.rate}"></label>
  <button class="primary" data-act="start">発売開始</button> <button data-act="settype" data-v="">タイプを選び直す</button></div>`;}

function board(){const r=S.room,rl=isRl(),O=rl?null:odds(),pool=Object.values(r.tickets||{}).reduce((a,t)=>a+t.stake,0);
  return `<div class="card"><h2>${rl?"オッズ（的中時の払戻倍率）":"出馬表"}</h2><table><tr><th>${rl?"No":"馬番"}</th><th>名前</th><th>${rl?"倍率":"単勝"}</th>${rl?"":"<th>複勝</th>"}</tr>
  ${ents().map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td>${esc(e.name)}${e.note?`<div class="en-note">${esc(e.note)}</div>`:""}</td><td><b>${e.odds.toFixed(1)}</b></td>${rl?"":`<td>${O.place[i].toFixed(1)}</td>`}</tr>`).join("")}${rl?grpRows(r):""}</table>
  <div class="small" style="margin-top:8px">発売額合計 <b>${yen(pool)}</b></div></div>`;}

const perms=(a,m)=>m===0?[[]]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)],m-1).map(p=>[x,...p]));
const combs=(a,m)=>m===0?[[]]:a.flatMap((x,i)=>combs(a.slice(i+1),m-1).map(c=>[x,...c]));
const effM=()=>{const u=S.ui,T=TYPES[u.type];if(isRl()||!T||T.k===1)return "normal";return u.method==="formation"&&!["quinella","exacta","trio","trifecta"].includes(u.type)?"normal":u.method;};
function genCombos(){const u=S.ui;if(isRl())return u.gsel!=null&&(S.room.groups||[])[u.gsel]?[[-(u.gsel+1)]]:(u.sel.length===1?[u.sel]:[]);const t=u.type;if(!t)return [];const T=TYPES[t],k=T.k,m=effM();
  if(m==="normal")return u.sel.length===k?[u.sel]:[];
  if(m==="formation"){const F=u.fm.slice(0,k),out=[],seen=new Set(),rec=(i,cur)=>{if(i===k){const x=T.o?[...cur]:[...cur].sort((p,q)=>p-q),kk=x.join("-");if(!seen.has(kk)){seen.add(kk);out.push(x);}return;}for(const h of F[i])if(!cur.includes(h))rec(i+1,[...cur,h]);};rec(0,[]);return out;}
  if(m==="box")return u.sel.length>=k?(T.o?perms(u.sel,k):combs(u.sel,k)):[];
  const ax=u.axis,pt=u.part;
  if(T.o){if(ax.length!==1||pt.length<k-1)return [];return perms(pt,k-1).map(p=>{const o=[...p];o.splice(u.pos,0,ax[0]);return o;});}
  if(ax.length<1||ax.length>k-1||pt.length<k-ax.length)return [];
  return combs(pt,k-ax.length).map(c=>[...ax,...c]);}
const methOf=()=>{if(isRl())return S.ui.gsel!=null?"大枠":"";const T=TYPES[S.ui.type];return !T?"通常":{normal:"通常",box:"ボックス",nagashi:"流し",formation:"フォーメーション"}[effM()];};
const mOf=()=>{const u=S.ui;return {k:effM(),sel:[...u.sel],ax:[...u.axis],pt:[...u.part],pos:u.pos,fm:u.fm.map(a=>[...a])};};
function dispOf(){const u=S.ui,n=i=>i+1;if(isRl())return u.gsel!=null?(S.room.groups||[])[u.gsel].name:(u.sel.length?ents()[u.sel[0]].name:"");const T=TYPES[u.type],m=effM();
  if(m==="normal")return u.sel.map(n).join(T.o?"→":"-");if(m==="box")return u.sel.map(n).join("-");if(m==="formation")return u.fm.slice(0,T.k).map(a=>a.map(n).join("・")).join("▶");
  return `${T.o?(u.pos+1)+"着軸 ":"軸 "}${u.axis.map(n).join("-")} / 相手 ${u.part.map(n).join("-")}`;}
function betInfo(){const u=S.ui,t=isRl()?"r":u.type,cs=genCombos(),per=Number(u.stake)||0,n=cs.length;let lo=null,hi=null;
  if(t&&n&&n<=300){const os=cs.map(x=>getOdds(t,x));lo=Math.min(...os);hi=Math.max(...os);}
  return {t,cs,per,n,lo,hi,tot:per*n};}
function betStr(b){const g=(a,c)=>a===c?a:`${a}〜${c}`,p=o=>yen(Math.floor(b.per*o/10)*10);
  return {n:b.n,tot:yen(b.tot),od:b.lo==null?"-":g(b.lo.toFixed(1),b.hi.toFixed(1)),pay:b.lo==null||!b.per?"-":g(p(b.lo),p(b.hi))};}
function refreshBet(){if(!document.getElementById("b-n"))return;const b=betInfo(),s=betStr(b),f=(id,v)=>{const e=document.getElementById(id);if(e&&e.textContent!==String(v))e.textContent=v;};
  f("b-n",s.n);f("b-tot",s.tot);f("b-od",s.od);f("b-pay",s.pay);const e=document.getElementById("b-go");if(e)e.disabled=!(b.n&&b.per>=100);}
function refreshDraft(){const d=S.ui.draft;if(!d||d.mode!=="prob")return;draftOdds(d).forEach((o,i)=>{const e=document.getElementById("od"+i);if(e)e.textContent=o>=1.1?o.toFixed(1):"-";});}

function betForm(){const u=S.ui,rl=isRl(),t=rl?"r":u.type,T=TYPES[t],k=T?T.k:1,m=effM(),b=betInfo(),bs=betStr(b);
  const btn=(e,i)=>{const A=u.axis.includes(i),P=u.part.includes(i),on=m==="nagashi"?A||P:m==="formation"?u.fm[u.ft].includes(i):u.sel.includes(i);
    return `<button class="ent ${on?(P?"on2":"on"):""}" data-act="pick" data-v="${i}" title="${esc(e.name)}">${num(i)}<span class="nm">${esc(e.name)}</span>${m==="normal"&&T?.o&&u.sel.includes(i)?`<i>${u.sel.indexOf(i)+1}</i>`:""}${m==="formation"&&u.fm.some(a=>a.includes(i))?`<i>${u.fm.map((a,j)=>a.includes(i)?j+1:"").join("")}</i>`:""}</button>`;};
  const hint=!t?"券種を選択してください":rl?"賭ける対象を選択":m==="normal"?`${k}頭を選択${T.o?"（選択順が着順）":""}`:m==="formation"?"列（1着・2着・3着など）ごとに馬を選択。各列から1頭ずつ選んだ組み合わせを全通り購入します":m==="box"?`${k}頭以上を選択。組み合わせを全通り購入します`:`軸${T.o?"1頭":`1〜${k-1}頭`}と相手を選択（緑＝軸、青＝相手）`;
  return `<div class="card"><h2>投票</h2>${rl?"":`<div class="tabs">${Object.entries(TYPES).map(([id,v])=>`<button class="tab ${u.type===id?"on":""}" data-act="type" data-v="${id}">${v.n}</button>`).join("")}</div>`}
  ${T&&k>=2?`<div class="tabs">${[["normal","通常"],["box","ボックス"],["nagashi","流し"],...(["quinella","exacta","trio","trifecta"].includes(u.type)?[["formation","フォーメーション"]]:[])].map(([id,l])=>`<button class="tab ${m===id?"on":""}" data-act="meth" data-v="${id}">${l}</button>`).join("")}</div>`:""}
  <p class="hint">${hint}</p>
  ${t&&m==="nagashi"?`<div class="tabs"><button class="tab ${u.tgt==="axis"?"on":""}" data-act="tgt" data-v="axis">軸馬を選ぶ</button><button class="tab ${u.tgt==="part"?"on":""}" data-act="tgt" data-v="part">相手馬を選ぶ</button></div>
  ${T.o?`<div class="tabs">軸の着順 ${Array.from({length:k},(_,j)=>`<button class="tab ${u.pos===j?"on":""}" data-act="pos" data-v="${j}">${j+1}着</button>`).join("")}</div>`:""}`:""}
  ${t&&m==="formation"?`<div class="tabs">${(T.o?["1着","2着","3着"]:["1頭目","2頭目","3頭目"]).slice(0,k).map((l,j)=>`<button class="tab ${u.ft===j?"on":""}" data-act="fcol" data-v="${j}">${l}${u.fm[j].length?`（${u.fm[j].map(x=>x+1).join(",")}）`:""}</button>`).join("")}</div>`:""}
  ${t?`<div class="hgrid">${ents().map(btn).join("")}</div>`:""}
  ${rl&&(S.room.groups||[]).length?`<p class="hint">大枠（含まれる項目のどれかが当たれば的中）</p><div class="hgrid">${S.room.groups.map((g,gi)=>`<button class="ent ${u.gsel===gi?"on":""}" data-act="gpickb" data-v="${gi}" title="${esc(g.name)}"><span class="nm">${esc(g.name)}</span><i>×${g.odds.toFixed(1)}</i></button>`).join("")}</div>`:""}
  ${S.room.limOn&&S.room.limN>=1?`<p class="small">購入は${S.room.limN}枚まで（残り ${Math.max(0,S.room.limN-Object.values(S.room.tickets||{}).filter(t=>t.uid===uid).length)}枚）</p>`:""}
  <div class="row"><span>1点あたり <input id="in-stake" data-m="stake" type="number" step="100" min="100" placeholder="100円単位" value="${u.stake}"></span></div>
  <div class="row" style="gap:10px 18px"><span>点数 <b id="b-n">${bs.n}</b></span><span>合計 <b id="b-tot">${bs.tot}</b></span><span>オッズ <b id="b-od">${bs.od}</b></span><span>的中時(1点) <b id="b-pay">${bs.pay}</b></span></div>
  <button class="primary" id="b-go" data-act="review" ${b.n&&b.per>=100?"":"disabled"}>購入内容を確認</button></div>`;}

function modal(){const u=S.ui,b=betInfo(),tkt={type:b.t,meth:methOf(),disp:dispOf(),per:b.per,m:mOf(),stake:b.tot,cs:b.cs,at:now()};
  return `<div class="ov"><div class="md"><h2>購入内容のご確認</h2>${tk(tkt,true,"")}<p>1点 ${yen(b.per)} × ${b.n}点 = <b>${yen(b.tot)}</b></p>
  <p class="warn">確定後の取消はできません。残高から ${yen(b.tot)} が引き落とされます。</p>
  <button data-act="cancel">戻る</button> <button class="red" data-act="buy" style="float:right;padding:10px 18px">購入を確定する</button></div></div>`;}

function oddsTable(){if(isRl()||S.room.status==="setup")return "";const u=S.ui,O=odds(),n=ents().length,t=u.ot,T=TYPES[t],open=S.room.status==="open";
  const col=o=>o<5?"#ffd0c4":o<20?"#ffe8b8":o<100?"#fff6d6":"#fff";
  const hd=i=>`<th>${num(i)}</th>`,idx=[...Array(n).keys()];
  const cell=(ty,sel)=>{const o=O[ty][key(ty,sel)];return `<td class="oc" style="background:${col(o)}" ${open?`data-act="cell" data-v="${ty}|${sel.join("-")}"`:""}>${o.toFixed(1)}</td>`};
  const blank=`<td class="oe"></td>`;let body,hint="";
  if(t==="win"||t==="place")body=`<table class="ot"><tr>${idx.map(hd).join("")}</tr><tr>${idx.map(i=>cell(t,[i])).join("")}</tr></table>`;
  else if(T.k===2){hint=T.o?"縦＝1着、横＝2着":"縦横の馬番の組み合わせ";
    body=`<table class="ot"><tr><th></th>${idx.map(hd).join("")}</tr>${idx.map(i=>`<tr>${hd(i)}${idx.map(j=>j===i||(!T.o&&j<i)?blank:cell(t,[i,j])).join("")}</tr>`).join("")}</table>`;}
  else{const a=u.ax<n?u.ax:0,rest=idx.filter(i=>i!==a);hint=t==="trifecta"?"1着の馬を選び、縦＝2着、横＝3着":"軸馬を選び、軸馬を含む組み合わせを表示";
    body=`<div>${idx.map(i=>`<button class="ent ${i===a?"on":""}" data-act="axis" data-v="${i}">${num(i)}</button>`).join("")}</div>
    <table class="ot"><tr><th></th>${rest.map(hd).join("")}</tr>${rest.map(b=>`<tr>${hd(b)}${rest.map(c=>c===b||(!T.o&&c<b)?blank:cell(t,[a,b,c])).join("")}</tr>`).join("")}</table>`;}
  return `<div class="card"><h2>オッズ一覧（全通り）</h2><div class="tabs">${Object.entries(TYPES).map(([id,v])=>`<button class="tab ${t===id?"on":""}" data-act="ot" data-v="${id}">${v.n}</button>`).join("")}</div>
  <p class="hint">${hint}</p><div class="ow">${body}</div><p class="small">色が濃いほど低オッズ（人気）。${open?"数字を押すとその買い目を投票欄に選択します。":""}</p></div>`;}

function payTable(res,A){const rows=[],p=o=>yen(Math.floor(o*10)*10);
  if(isRl()){(res.wins||[]).forEach(i=>rows.push(["当たり",esc(ents()[i].name),ents()[i].odds]));(S.room.groups||[]).filter(g=>g.items.some(i=>(res.wins||[]).includes(i))).forEach(g=>rows.push(["大枠",esc(g.name),g.odds]));}
  else{const O=odds(),[a,b,c]=res.order,add=(t,s)=>rows.push([TYPES[t].n,s.map(num).join(TYPES[t].o?" → ":" ・ "),O[t][key(t,s)]]);
    add("win",[a]);[a,b,c].forEach(x=>add("place",[x]));add("quinella",[a,b]);add("exacta",[a,b]);add("wide",[a,b]);add("wide",[a,c]);add("wide",[b,c]);add("trio",[a,b,c]);add("trifecta",[a,b,c]);}
  if(!rows.length)return "";
  return `<div class="${A?"rv":""}" style="animation-delay:5.4s"><h3 style="margin-top:14px">払戻金（100円あたり）</h3><table><tr><th>券種</th><th>組番</th><th>払戻金</th></tr>
  ${rows.map(([t,s,o])=>`<tr><td>${t}</td><td>${s}</td><td><b>${p(o)}</b></td></tr>`).join("")}</table></div>`;}

let AC=null;
const beep=(f,ms,at=0,ty="square",g=.05)=>{try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),v=AC.createGain(),t=AC.currentTime+at;o.type=ty;o.frequency.value=f;v.gain.value=g;o.connect(v);v.connect(AC.destination);o.start(t);o.stop(t+ms/1000);}catch{}};
const sfx={key:()=>beep(1100,50),card:()=>beep(520,130),ok:()=>{beep(880,90);beep(1320,150,.1)},ng:()=>beep(300,250,0,"sawtooth"),cash:()=>{for(let i=0;i<16;i++)beep(170+Math.random()*70,40,i*.08,"sawtooth",.04)}};
function atmScreen(A){const me=(S.room.players||{})[uid]||{},N={loan:"ご融資（借入）",rep:"ご返済"}[A.mode],txt=(A.amt+Number(A.tmp||0)).toLocaleString(),kb=k=>`<button class="k" data-act="ak" data-v="${k}">${k}</button>`;
  const pad=`<div class="pad">${[1,2,3,4,5,6,7,8,9,0].map(kb).join("")}<button class="k fix" data-act="ak" data-v="fix">訂正</button></div>`,dots=`<div class="dots"><i></i><i></i><i></i></div>`;let h="",hw="",led="";
  switch(A.step){
    case"card":h=`<div class="scr-msg">カードを挿入してください<small>Please insert your card</small></div>`;hw="in";led="card";break;
    case"menu":h=`<h3 class="at">ご希望の取引を押してください</h3><div class="am"><button class="mb" data-act="amode" data-v="loan">ご融資（借入）<small>Withdrawal (Cash Advance)</small></button><button class="mb" data-act="amode" data-v="rep">ご返済<small>Deposit (Repayment)</small></button>
      <button class="sb" data-act="ainq" data-v="in1">出金可能額照会<small>Available Balance</small></button><button class="sb" data-act="ainq" data-v="in2">入金可能額照会<small>Deposit Limit</small></button></div>`;break;
    case"inq":h=`<h3 class="at">${A.mode==="in1"?"出金可能額照会":"入金可能額照会"}</h3><div class="cf">${A.mode==="in1"?`ご融資のお取扱い上限　<b>なし</b><br>（マスターの承認制）<br>現在の借入残高　<b>${yen(me.debt)}</b>`
      :`手持ち残高　<b>${yen(me.balance)}</b><br>借入残高　<b>${yen(me.debt)}</b><br>ご返済可能額　<b>${yen(Math.min(me.debt||0,me.balance||0))}</b>`}</div><button class="mb" data-act="amenu">メニューへ戻る</button>`;break;
    case"amt":h=`<div class="at2">金額の入力<small>${N}</small></div><div class="sm2">借入残高 ${yen(me.debt)}${A.mode==="rep"?"　手持ち "+yen(me.balance):""}　1,000円単位</div><div class="disp">金額：${txt}円</div><div class="err">${esc(A.err||"")}</div><div class="pad2">${pad}<div class="side"><button class="k u" data-act="ak" data-v="万">万</button><button class="k u" data-act="ak" data-v="千">千</button><button class="k en" data-act="ak" data-v="円">円</button></div></div>`;break;
    case"conf":h=`<h3 class="at">下記の内容でよろしいですか？</h3><div class="cf">お取引　<b>${N}</b><br>金額　<b>${A.amt.toLocaleString()}円</b><br>${A.mode==="rep"?`返済後の借入残高　${yen((me.debt||0)-A.amt)}`:`現在の借入残高　${yen(me.debt)}`}</div><div class="bt2"><button class="mb" data-act="aback">訂正</button><button class="mb ok" data-act="aok">確認</button></div>`;break;
    case"proc":h=`<div class="scr-msg">お取引中です<small>しばらくお待ちください</small>${dots}</div>`;break;
    case"insert":h=`<div class="scr-msg">紙幣を投入口にお入れください<small>ご返済額 ${yen(A.amt)}</small></div><button class="mb ok" data-act="ains" style="width:100%">紙幣を投入する</button>`;hw="open";led="cash";break;
    case"feed":h=`<div class="scr-msg">紙幣を計数しています<small>Counting</small>${dots}</div>`;hw="in";break;
    case"wait":h=`<div class="scr-msg">審査中です<small>ルームマスターの承認をお待ちください</small>${dots}</div>`;break;
    case"cash":h=`<div class="scr-msg">紙幣をお取りください<small>${yen(A.amt)}　Please take your cash</small></div><button class="mb ok" data-act="atake" style="width:100%">紙幣を受け取る</button>`;hw=A.taken?"take":"out";led=A.taken?"":"cash";break;
    case"done":h=`<div class="scr-msg">${esc(A.msg)}<small>ご利用ありがとうございました。カードをお取りください</small></div><button class="mb" data-act="aclose" style="width:100%">カードを受け取る</button>`;hw="out";led="card";break;}
  return {h,hw,led,step:A.step};}
function atmHTML(A,p){const cardCls=["card","feed"].includes(p.step)&&p.step==="card"?"in":p.step==="done"?"out":"",nb=Math.min(5,Math.max(1,Math.ceil(A.amt/10000))),bills=Array.from({length:nb},(_,i)=>`<div class="bill" style="--i:${i}"></div>`).join("");
  const cash=["insert","feed","cash"].includes(p.step)?p.hw:"";
  return `<div class="ov"><div class="atmm"><div class="sign"><span>NQK BANK　ATM</span>${p.step==="done"?"":`<button class="ab" data-act="aclose">取消 Cancel</button>`}</div><div class="scr"><div class="scr-in">${p.h}</div></div>
  <div class="hw"><div class="slot"><span class="led ${p.led==="card"?"on":""}"></span><div class="cardwin"><div class="cardic ${cardCls}"></div></div><div class="slit"></div><small>カード挿入・返却口</small></div>
  <div class="slot"><span class="led ${p.led==="cash"?"on":""}"></span><div class="cashbox ${cash}">${bills}</div><div class="slit"></div><small>紙幣 取出・投入口</small></div></div></div></div>`;}
function drawAtm(){const A=S.ui.atm,el=document.getElementById("atm-root");if(!el)return;if(!A){el.innerHTML="";S.atmSig="";return;}
  const p=atmScreen(A),sig=A.step+(A.taken?"t":""),sc=el.querySelector(".scr-in");
  if(sc&&S.atmSig===sig){sc.innerHTML=p.h;return;}S.atmSig=sig;el.innerHTML=atmHTML(A,p);}
function aT(step,ms,fn){const A=S.ui.atm;if(!A)return;A.step=step;A.err=A.err&&step==="amt"?A.err:"";drawAtm();if(fn)setTimeout(()=>{if(S.ui.atm===A&&A.step===step)fn();},ms);}
function atmSync(v){const A=S.ui.atm;if(!A||A.step!=="wait"||!A.rid)return;const q=((v||{}).requests||{})[A.rid];if(!q)return;
  if(q.status==="approved"){A.taken=false;sfx.cash();aT("cash");}else if(q.status==="rejected"){A.msg="ご融資をお取り扱いできませんでした";sfx.ng();aT("done");}}
async function submitLoan(){const A=S.ui.atm,rf=await push(R("requests"),{uid,name:S.name,amount:A.amt,status:"pending",at:now()});A.rid=rf.key;if(S.ui.atm===A){aT("wait");atmSync(S.room);}}
async function doRepay(){const A=S.ui.atm,a=A.amt,P=k=>ref(db,`rooms/${S.code}/players/${uid}/${k}`);
  if(!(await runTransaction(P("balance"),b=>(b>=a?b-a:undefined))).committed){A.err="手持ち残高が足りません";A.amt=0;A.tmp="";sfx.ng();aT("amt");return;}
  await runTransaction(P("debt"),b=>Math.max(0,(b||0)-a));A.msg=`${yen(a)} のご返済を承りました`;sfx.ok();if(S.ui.atm===A)aT("done");}

function control(){const r=S.room,u=S.ui,rl=isRl();
  if(r.status==="open")return `<div class="card"><h2>マスター操作</h2><p class="hint">締切タイマー（いつでも設定・変更できます）</p>
    ${[[30,"あと30秒"],[60,"あと1分"],[180,"あと3分"],[300,"あと5分"]].map(([s,l])=>`<button data-act="dl" data-v="${s}">${l}で締切</button>`).join("")}${r.deadline?`<button data-act="dl" data-v="0">タイマー取消</button>`:""}
    <div style="margin-top:10px"><button class="red" data-act="close">今すぐ発売を締め切る</button></div></div>`;
  const body=rl?`<p class="hint">当たりを選択（複数可、なしも可）</p><div class="hgrid">${ents().map((e,i)=>`<button class="ent ${u.wins.includes(i)?"on":""}" data-act="winp" data-v="${i}" title="${esc(e.name)}"><span class="nm">${esc(e.name)}</span></button>`).join("")}</div>${(r.groups||[]).length?`<p class="small">当たりになる大枠（自動）：${(r.groups||[]).filter(g=>g.items.some(i=>u.wins.includes(i))).map(g=>esc(g.name)).join("、")||"なし"}</p>`:""}`
    :[0,1,2].map(j=>`<div class="rr"><b>${j+1}着</b><div class="hgrid">${ents().map((e,i)=>`<button class="ent ${u.res[j]===i?"on":""}" ${u.res.some((v,k)=>k!==j&&v===i)?"disabled":""} data-act="resp" data-v="${j}|${i}" title="${esc(e.name)}">${num(i)}<span class="nm">${esc(e.name)}</span></button>`).join("")}</div></div>`).join("");
  return `<div class="card"><h2>結果入力</h2>${body}<div class="chk"><input type="checkbox" id="in-skip" data-m="skip" ${u.skip?"checked":""}><label for="in-skip">演出スキップ（即座に順位と払戻を表示）</label></div><button class="primary" data-act="settle" style="margin-top:10px">結果を確定して払戻</button></div>`;}

function resultView(){const r=S.room,res=r.result||{},A=S.anim,isM=r.master===uid;let body;
  if(isRl()){const w=res.wins||[];body=w.length?w.map((i,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${2+j*.6}s">${esc(ents()[i].name)}</div>`).join(""):`<div class="rank ${A?"rv":""}" style="animation-delay:2s">全てハズレ</div>`;const gh=(r.groups||[]).filter(g=>g.items.some(i=>w.includes(i)));body+=gh.map((g,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${2+(w.length+j)*.6}s">大枠：${esc(g.name)}</div>`).join("");}
  else{const d=[4,2.6,.9];body=(res.order||[]).map((i,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${d[j]}s">${j+1}着　${num(i)}${esc(ents()[i].name)}</div>`).join("");}
  return `<div class="card"><h2>${A?"<span class='pulse'>判定中</span>":"結果"}</h2>${body}${payTable(res,A)}${isM&&!A?`<button data-act="next">次のラウンドへ</button>`:""}</div>`;}

function hit(r,t,res){if(r.type==="roulette"){const x=t.sel[0],w=res.wins||[];if(x<0){const g=(r.groups||[])[-x-1];return !!g&&(g.items||[]).some(i=>w.includes(i));}return w.includes(x);}
  const o=res.order,s=t.sel,top=o.slice(0,3);
  switch(t.type){case"win":return s[0]===o[0];case"place":return top.includes(s[0]);case"quinella":return s.every(x=>o.slice(0,2).includes(x));
    case"exacta":return s[0]===o[0]&&s[1]===o[1];case"wide":case"trio":return s.every(x=>top.includes(x));case"trifecta":return s.every((x,i)=>x===o[i]);}}

async function buy(){const r=S.room,u=S.ui,b=betInfo(),t=b.t;u.modal=false;
  if(r.status!=="open"||(r.deadline&&now()>r.deadline)){render();return alert("発売は締め切られました");}
  if(r.limOn&&r.limN>=1&&Object.values(r.tickets||{}).filter(x=>x.uid===uid).length>=r.limN){render();return alert(`1ラウンドの購入は${r.limN}枚までです`);}
  if(!b.n||!(b.per>=100&&b.per%100===0)){render();return alert("買い目と、100円単位の金額を入力してください");}
  if(b.n>300){render();return alert("点数が多すぎます（300点まで）");}
  const cs=b.cs.map(x=>({s:x,o:getOdds(t,x)}));
  const res=await runTransaction(ref(db,`rooms/${S.code}/players/${uid}/balance`),x=>(x>=b.tot?x-b.tot:undefined));
  if(!res.committed){render();return alert("残高が足りません");}
  await push(R("tickets"),{uid,name:S.name,type:t,meth:methOf(),disp:dispOf(),m:mOf(),...(isRl()&&u.gsel!=null?{gm:S.room.groups[u.gsel].items.map(i=>ents()[i].name).join("・")}:{}),per:b.per,stake:b.tot,cs,at:now()});
  u.sel=[];u.axis=[];u.part=[];u.fm=[[],[],[]];u.gsel=null;u.stake="";render();}
async function start(){const d=S.ui.draft,rl=isRl(),pm=d.mode==="prob";
  if(!d.ent.length||d.ent.some(e=>!String(e.name).trim()))return alert("全ての名前を入力してください");
  if(!rl&&(d.ent.length<3||d.ent.length>18))return alert("出走数は3〜18です");
  if(rl&&d.gOn&&d.groups.some(g=>!String(g.name).trim()||!g.items.length||!(Number(g.odds)>=1.1)))return alert("大枠の「名前」「含まれる項目」「倍率（1.1以上）」をすべて入力してください");
  const rate=Number(d.rate);if((!rl||pm)&&!(rate>=0.5&&rate<=1))return alert("払戻率は0.5〜1で入力してください");
  const od=draftOdds(d);if(od.some(o=>!(o>=1.1)))return alert(pm?"全ての勝率を入力してください":"全てのオッズに1.1以上を入力してください");
  await update(R(),{title:d.title.trim(),ed:String(d.ed||"").trim()||null,grade:null,entrants:d.ent.map((e,i)=>({name:String(e.name).trim(),odds:od[i],...(pm?{w:Number(e.w),j:e.j||1}:{}),...(d.noteOn&&String(e.note||"").trim()?{note:String(e.note).trim()}:{})})),pmode:pm,rate:rate||1,status:"open",deadline:null,groups:rl&&d.gOn&&d.groups.length?d.groups.map(g=>({name:String(g.name).trim(),odds:Number(g.odds),items:[...g.items],...(d.noteOn&&String(g.note||"").trim()?{note:String(g.note).trim()}:{})})):null});
  S.ui.draft=null;S.ui.sel=[];S.ui.gsel=null;S.ui.type=null;}
async function settle(){const r=S.room,u=S.ui;if(r.status!=="closed")return;let result;
  if(isRl())result={wins:u.wins};else{if(u.res.some(v=>v==="")||new Set(u.res).size<3)return alert("1〜3着を重複なく選んでください");result={order:u.res.map(Number)};}
  const pay={},up={result,status:"settled",settledAt:now(),skip:!!u.skip};
  Object.entries(r.tickets||{}).forEach(([id,t])=>{const cs=t.cs||[{s:t.sel,o:t.odds}],per=t.per||t.stake,p=cs.reduce((a,c)=>a+(hit(r,{type:t.type,sel:c.s},result)?Math.floor(per*c.o/10)*10:0),0);up[`tickets/${id}/payout`]=p;if(p&&(r.players||{})[t.uid])pay[t.uid]=(pay[t.uid]||0)+p;});
  await update(R(),up);
  for(const[id,p]of Object.entries(pay))await runTransaction(ref(db,`rooms/${S.code}/players/${id}/balance`),b=>(b||0)+p);}

const acts={
  create:()=>{if(!S.name.trim())return alert("名前を入力してください");create();},
  join:()=>{if(!S.name.trim()||!S.hcode.trim())return alert("名前とコードを入力してください");join(S.hcode.trim().toUpperCase());},
  leave:()=>{unsub&&unsub();localStorage.removeItem("code");S.code="";S.room=null;history.replaceState(null,"",location.pathname);render(true);},
  settype:v=>{S.ui.draft=null;update(R(),{type:v||null});},
  addent:()=>{S.ui.draft.ent.push({name:"",odds:"",w:"",j:jit(),note:""});render();},
  delent:v=>{const d=S.ui.draft,i=+v;d.ent.splice(i,1);d.groups.forEach(g=>{g.items=g.items.filter(x=>x!==i).map(x=>x>i?x-1:x);});render();},
  start,buy,settle,
  close:async()=>{if(closing)return;closing=true;await update(R(),{status:"closed"});closing=false;},
  next:()=>{S.ui.draft=null;S.ui.res=["","",""];S.ui.wins=[];S.ui.sel=[];S.ui.type=null;update(R(),{status:"setup",tickets:null,result:null,settledAt:null,deadline:null,type:null,round:(S.room.round||1)+1});},
  type:v=>{Object.assign(S.ui,{type:v,sel:[],axis:[],part:[],pos:0,fm:[[],[],[]],ft:0});render();},
  meth:v=>{Object.assign(S.ui,{method:v,sel:[],axis:[],part:[],fm:[[],[],[]],ft:0});render();},pos:v=>{S.ui.pos=+v;render();},fcol:v=>{S.ui.ft=+v;render();},tgt:v=>{S.ui.tgt=v;render();},
  pick:v=>{const u=S.ui,i=+v;if(isRl()){u.sel=[i];u.gsel=null;render();return;}const t=u.type;if(!t)return;const T=TYPES[t],m=effM();
    if(m==="normal"){if(u.sel.includes(i))u.sel=u.sel.filter(x=>x!==i);else if(T.k===1)u.sel=[i];else if(u.sel.length<T.k)u.sel.push(i);}
    else if(m==="box")u.sel=u.sel.includes(i)?u.sel.filter(x=>x!==i):[...u.sel,i];
    else if(m==="formation")u.fm[u.ft]=u.fm[u.ft].includes(i)?u.fm[u.ft].filter(x=>x!==i):[...u.fm[u.ft],i];
    else{const a=u.tgt,o=a==="axis"?"part":"axis",lim=T.o?1:T.k-1;
      if(u[a].includes(i))u[a]=u[a].filter(x=>x!==i);else{u[o]=u[o].filter(x=>x!==i);u[a]=a==="axis"?[...u.axis,i].slice(-lim):[...u.part,i];}}
    render();},
  review:()=>{S.ui.modal=true;render();},cancel:()=>{S.ui.modal=false;render();},
  ot:v=>{S.ui.ot=v;S.ui.ax=0;render();},axis:v=>{S.ui.ax=+v;render();},
  cell:v=>{const[t,x]=v.split("|");Object.assign(S.ui,{type:t,method:"normal",axis:[],part:[],fm:[[],[],[]],ft:0,sel:x.split("-").map(Number)});render();const e=document.getElementById("in-stake");if(e){e.scrollIntoView({block:"center"});e.focus();}},
  cfgok:async()=>{const n=Number(S.ui.cfg);if(!(n>=1000))return alert("初期金額を入力してください");const up={initBalance:n,status:"setup"};Object.keys(S.room.players||{}).forEach(id=>up[`players/${id}/balance`]=n);await update(R(),up);},
  clr:()=>{S.ui.draft.ent=[];S.ui.draft.groups=[];update(R(),{entrants:null,groups:null});render();},
  reroll:()=>{S.ui.draft.ent.forEach(e=>e.j=jit());render();},
  gadd:()=>{S.ui.draft.groups.push({name:"",note:"",odds:"",items:[]});render();},
  gdel:v=>{S.ui.draft.groups.splice(+v,1);render();},
  gtog:v=>{const [gi,i]=v.split("|").map(Number),g=S.ui.draft.groups[gi];g.items=g.items.includes(i)?g.items.filter(x=>x!==i):[...g.items,i].sort((a,b)=>a-b);render();},
  gauto:v=>{const d=S.ui.draft,g=d.groups[+v],od=draftOdds(d);if(!g.items.length)return alert("先に、含まれる項目を選んでください");
    if(g.items.some(i=>!(od[i]>=1.1)))return alert("含まれる項目すべてに、有効なオッズ（1.1以上）を入れてから押してください");
    g.odds=Math.max(1.1,fmtO(1/g.items.reduce((a,i)=>a+1/od[i],0)));if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();render();},
  gpickb:v=>{const u=S.ui,gi=+v;u.gsel=u.gsel===gi?null:gi;u.sel=[];render();},
  smode:v=>{S.ui.draft.mode=v;render();},
  dl:v=>update(R(),{deadline:+v>0?now()+(+v)*1000:null}),
  resp:v=>{const[j,i]=v.split("|").map(Number);S.ui.res[j]=S.ui.res[j]===i?"":i;render();},
  winp:v=>{const i=+v,w=S.ui.wins;S.ui.wins=w.includes(i)?w.filter(x=>x!==i):[...w,i];render();},
  atmopen:()=>{const A=S.ui.atm={step:"card",mode:"",amt:0,tmp:"",err:"",rid:"",taken:false};sfx.card();drawAtm();setTimeout(()=>{if(S.ui.atm===A&&A.step==="card"){sfx.ok();aT("menu");}},1800);},
  aclose:()=>{S.ui.atm=null;drawAtm();},
  amode:v=>{const A=S.ui.atm;A.mode=v;A.amt=0;A.tmp="";sfx.key();aT("amt");},ainq:v=>{S.ui.atm.mode=v;sfx.key();aT("inq");},amenu:()=>{sfx.key();aT("menu");},
  ak:v=>{const A=S.ui.atm;if(!A||A.step!=="amt")return;sfx.key();
    if(v==="fix"){A.amt=0;A.tmp="";A.err="";}
    else if(/^\d$/.test(v)){if((A.tmp||"").length<7)A.tmp=(A.tmp||"")+v;}
    else if(v==="万"||v==="千"){A.amt+=Number(A.tmp||1)*(v==="万"?10000:1000);A.tmp="";}
    else if(v==="円"){A.amt+=Number(A.tmp||0);A.tmp="";const me=S.room.players[uid],a=A.amt;
      if(!(a>=1000&&a%1000===0))A.err="金額は1,000円単位で入力してください";
      else if(A.mode==="rep"&&a>(me.debt||0))A.err="借入残高を超えています";
      else if(A.mode==="rep"&&a>(me.balance||0))A.err="手持ち残高が足りません";
      else{aT("conf");return;}
      A.amt=0;sfx.ng();}
    drawAtm();},
  aback:()=>{const A=S.ui.atm;A.amt=0;A.tmp="";aT("amt");},
  aok:()=>{const A=S.ui.atm;sfx.ok();if(A.mode==="loan")aT("proc",1600,submitLoan);else aT("insert");},
  ains:()=>{sfx.cash();aT("feed",2600,doRepay);},
  atake:()=>{const A=S.ui.atm;A.taken=true;drawAtm();setTimeout(()=>{if(S.ui.atm===A){A.msg=`${yen(A.amt)} のご融資が完了しました`;sfx.ok();aT("done");}},900);},
  gpick:v=>{S.ui.gt=v;render();},
  adj:async v=>{const u=S.ui,n=Number(u.ga),ids=u.bsel.filter(id=>(S.room.players||{})[id]);if(!ids.length)return alert("操作する参加者にチェックを入れてください");if(!(n>0&&n%100===0))return alert("100円単位の金額を入力してください");
    const f=v[0]==="b"?"balance":"debt",sg=v[1]==="+"?1:-1;
    for(const id of ids)await runTransaction(ref(db,`rooms/${S.code}/players/${id}/${f}`),b=>Math.max(0,(b||0)+sg*n));
    u.balmsg=`${ids.length}人の${f==="balance"?"残高":"借入"}を ${yen(n)} ${sg>0?"追加":"削除"}しました`;u.ga="";render();},
  muldebt:async()=>{const u=S.ui,t=String(u.mul).trim(),n=Number(t),ids=u.bsel.filter(id=>(S.room.players||{})[id]);if(!ids.length)return alert("操作する参加者にチェックを入れてください");
    if(t===""||!(n>=0)||!isFinite(n))return alert("倍率を数字で入力してください（例：1.5）");
    for(const id of ids)await runTransaction(ref(db,`rooms/${S.code}/players/${id}/debt`),b=>Math.round((b||0)*n));
    u.balmsg=`${ids.length}人の借入を ×${n} にしました`;u.mul="";render();},
  balopen:()=>{S.ui.balm=true;S.ui.balmsg="";render();},balclose:()=>{S.ui.balm=false;render();},
  bsall:()=>{const ids=Object.keys(S.room.players||{}),u=S.ui;u.bsel=u.bsel.filter(x=>ids.includes(x)).length===ids.length?[]:ids;render();},
  setopen:()=>{S.ui.setm=true;render();},setclose:()=>{S.ui.setm=false;render();},
  unjit:()=>{S.ui.draft.ent.forEach(e=>e.j=1);render();},
  vw:v=>{S.ui.vw=S.ui.vw===v?null:v;render();},
  copylink:async()=>{const u=location.origin+location.pathname+"?room="+S.code;try{await navigator.clipboard.writeText(u);alert("招待リンクをコピーしました\n"+u);}catch{prompt("招待リンク（コピーして共有してください）",u);}},
  kick:v=>{const p=(S.room.players||{})[v];if(!p||v===uid)return;if(!confirm(`「${p.name}」さんをキックしますか？（今回の馬券は無効になります）`))return;
    const up={[`players/${v}`]:null,[`kicked/${v}`]:p.name};
    Object.entries(S.room.tickets||{}).forEach(([id,t])=>{if(t.uid===v)up[`tickets/${id}`]=null;});
    Object.entries(S.room.requests||{}).forEach(([id,q])=>{if(q.uid===v)up[`requests/${id}`]=null;});update(R(),up);},
  unkick:v=>update(R(),{[`kicked/${v}`]:null}),
  apv:async id=>{const q=S.room.requests[id];if(q.status!=="pending")return;await update(R(`requests/${id}`),{status:"approved"});const b=`rooms/${S.code}/players/${q.uid}`;
    await runTransaction(ref(db,b+"/balance"),x=>(x||0)+q.amount);await runTransaction(ref(db,b+"/debt"),x=>(x||0)+q.amount);},
  rej:id=>update(R(`requests/${id}`),{status:"rejected"})
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(b&&!b.disabled)acts[b.dataset.act](b.dataset.v);});
document.addEventListener("input",e=>{const m=e.target.dataset.m;if(!m)return;const v=e.target.value,[k,i]=m.split(":"),u=S.ui;
  if(k==="name")S.name=v;else if(k==="hcode")S.hcode=v;else if(k==="stake"){u.stake=v;refreshBet();}
  else if(k==="bank")u.draft.bank=v;
  else if(k==="title")u.draft.title=v;else if(k==="ed")u.draft.ed=v;else if(k==="et")u.draft.ent[i].note=v;else if(k==="noteon"){u.draft.noteOn=e.target.checked;render();}else if(k==="gon"){u.draft.gOn=e.target.checked;render();}else if(k==="gn")u.draft.groups[i].name=v;else if(k==="gt")u.draft.groups[i].note=v;else if(k==="go")u.draft.groups[i].odds=v;else if(k==="en")u.draft.ent[i].name=v;else if(k==="eo")u.draft.ent[i].odds=v;else if(k==="ew"){u.draft.ent[i].w=v;refreshDraft();}else if(k==="cfg")u.cfg=v;else if(k==="skip")u.skip=e.target.checked;else if(k==="set")update(R(),{[i]:e.target.checked});else if(k==="limN"){const n=Math.floor(Number(v));if(n>=1)update(R(),{limN:n});}else if(k==="mul")u.mul=v;else if(k==="bsel"){u.bsel=e.target.checked?[...new Set([...u.bsel,i])]:u.bsel.filter(x=>x!==i);render();}else if(k==="ga")u.ga=v;
  else if(k==="rate"){u.draft.rate=v;refreshDraft();}else if(k==="init")u.draft.init=v;else if(k==="dl")u.draft.dl=v;
  else if(k==="res")u.res[i]=v;else if(k==="win")u.wins=e.target.checked?[...u.wins,+i]:u.wins.filter(x=>x!==+i);});
document.addEventListener("change",e=>{const d=e.target.dataset&&e.target.dataset.ed;if(!d||!S.room||S.room.master!==uid)return;
  const [f,id]=d.split(":"),raw=e.target.value,n=Math.round(Number(raw));
  if(raw===""||!(n>=0)){render();return;}
  update(R(`players/${id}`),{[f]:n});S.ui.balmsg=`${((S.room.players||{})[id]||{}).name||""} の${f==="balance"?"残高":"借入"}を ${yen(n)} に変更しました`;});
document.addEventListener("keydown",e=>{const A=S.ui.atm;if(!A||A.step!=="amt"||/INPUT|SELECT/.test(e.target.tagName))return;
  if(/^\d$/.test(e.key))acts.ak(e.key);else if(e.key==="Backspace")acts.ak("fix");else if(e.key==="Enter"&&A.step==="amt")acts.ak("円");});
const NT=[[180,"あと3分","a"],[120,"あと2分","a"],[60,"あと1分","b"],[30,"あと30秒","c"],[10,"あと10秒","c"],[0,"","c"]];
function showToast(big,cls,small="投票締切まで"){document.querySelectorAll(".toast").forEach(e=>e.remove());const d=document.createElement("div");d.className="toast "+cls;d.setAttribute("role","status");
  d.innerHTML=`${small?`<small>${small}</small>`:""}<b>${big}</b>`;document.body.appendChild(d);d.addEventListener("animationend",()=>d.remove());setTimeout(()=>d.remove(),7000);}
function notifyDl(dl,l){const sec=Math.ceil(l/1000);if(!S.ntf||S.ntf.dl!==dl)S.ntf={dl,done:new Set()};
  const c=NT.filter(x=>sec<=x[0]).pop();if(!c||S.ntf.done.has(c[0]))return;
  NT.forEach(x=>{if(x[0]>=c[0])S.ntf.done.add(x[0]);});
  if(sec<c[0]-3)return;
  if(c[0]===0)showToast("投票を締め切りました","c","");else showToast(c[1],c[2]);}
setInterval(()=>{const r=S.room;if(!r||r.status!=="open"||!r.deadline)return;const l=r.deadline-now(),t=cdt();notifyDl(r.deadline,l);
  document.querySelectorAll("[data-cd]").forEach(e=>{e.textContent=t;e.classList.toggle("warn",l<=30000);});if(l<=0&&r.master===uid)acts.close();},1000);
const uc=(new URLSearchParams(location.search).get("room")||location.hash.slice(1)||"").trim().toUpperCase();
if(uc)S.hcode=uc;
if(uc&&S.name.trim())join(uc).catch(()=>render(true));else if(S.code)join(S.code).catch(()=>{});else render(true);
