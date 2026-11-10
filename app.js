import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getDatabase,ref,onValue,set,update,push,runTransaction,get} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {firebaseConfig} from "./config.js";
import {calcOdds,TYPES,key} from "./odds.js";

const db=getDatabase(initializeApp(firebaseConfig)), $=s=>document.querySelector(s);
let off=0;const now=()=>Date.now()+off;onValue(ref(db,".info/serverTimeOffset"),x=>{off=x.val()||0;});
const uid=localStorage.uid||(localStorage.uid=crypto.randomUUID());
const S={code:localStorage.code||"",name:localStorage.name||"",room:null,hcode:"",lock:0,anim:false,seen:{},
  ui:{sel:[],type:null,stake:"",draft:null,res:["","",""],wins:[],modal:false,cfg:"10000",gt:null,ga:"",method:"normal",axis:[],part:[],pos:0,tgt:"axis",atm:null,ot:"quinella",ax:0}};
let unsub=null,oc={k:"",v:null},closing=false;
const R=p=>ref(db,`rooms/${S.code}${p?"/"+p:""}`);
const yen=n=>(n||0).toLocaleString()+"円", esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ents=()=>S.room.entrants||[], isRl=()=>S.room.type==="roulette";
const num=i=>isRl()?"":`<span class="num n${i%8}">${i+1}</span>`;
const odds=()=>{const r=S.room,k=JSON.stringify([ents(),r.rate]);if(oc.k!==k)oc={k,v:calcOdds(ents(),r.rate)};return oc.v};
const getOdds=(t,sel)=>isRl()?ents()[sel[0]].odds:odds()[t][key(t,sel)];

function watch(){unsub&&unsub();unsub=onValue(R(),s=>{const v=s.val();S.room=v;atmSync(v);let f=false;
  if(v&&v.status==="settled"&&v.settledAt&&!S.seen[v.settledAt]){S.seen[v.settledAt]=1;
    if(Math.abs(now()-v.settledAt)<15000){S.anim=true;S.lock=now()+6800;f=true;setTimeout(()=>{S.anim=false;S.lock=0;render(true)},6900);}}
  render(f,true);});}
async function join(code){
  const snap=await get(ref(db,`rooms/${code}`));if(!snap.exists())return alert("ルームが見つかりません");
  S.code=code;localStorage.code=code;localStorage.name=S.name;
  const pr=ref(db,`rooms/${code}/players/${uid}`);
  if(!(await get(pr)).exists())await set(pr,{name:S.name,balance:snap.val().initBalance??0,debt:0});
  watch();}
async function create(){const code=Math.random().toString(36).slice(2,7).toUpperCase();
  await set(ref(db,`rooms/${code}`),{master:uid,status:"config"});await join(code);}

function render(f,db){
  if(!f&&now()<S.lock)return;
  if(db&&/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement||{}).tagName)){S.pend=true;return;}
  S.pend=false;
  const a=document.activeElement,id=a&&a.id,pos=a&&a.selectionStart,old=document.getElementById("odo");
  $("#app").innerHTML=!S.code?home():!S.room?`<p class="c">読み込み中（ルームが無い場合は<button data-act="leave">戻る</button>）</p>`:room();
  if(id){const e=document.getElementById(id);if(e){e.focus();try{e.setSelectionRange(pos,pos)}catch{}}}
  hookOdo(old);}

function odoHTML(v,N){const s=String(Math.max(0,v)).padStart(N," ");let h="";
  for(let i=0;i<N;i++){const b=s[i]===" ";if(i>0&&(N-i)%3===0)h+=`<span class="odc ${s[i-1]===" "?"off":""}" data-p="${i}">,</span>`;
    h+=`<span class="od ${b?"off":""}"><span class="odi" style="transform:translateY(-${b?10:s[i]}em)">${"0123456789 ".split("").map(c=>`<i>${c===" "?"&nbsp;":c}</i>`).join("")}</span></span>`;}
  return h;}
function updateOdo(el,v){const N=+el.dataset.n,s=String(Math.max(0,v)).padStart(N," "),was=+el.dataset.v;
  el.querySelectorAll(".od").forEach((c,i)=>{c.classList.toggle("off",s[i]===" ");c.firstChild.style.transform=`translateY(-${s[i]===" "?10:s[i]}em)`;});
  el.querySelectorAll(".odc").forEach(c=>c.classList.toggle("off",s[+c.dataset.p-1]===" "));
  el.dataset.v=v;if(v!==was){el.classList.remove("up","down");void el.offsetWidth;el.classList.add(v>was?"up":"down");clearTimeout(S.odoT);S.odoT=setTimeout(()=>el.classList.remove("up","down"),1600);}}
function hookOdo(old){let el=document.getElementById("odo");if(!el)return;const t=+el.dataset.t;
  if(old&&+old.dataset.n>=String(t).length){el.replaceWith(old);el=old;}
  void el.offsetWidth;updateOdo(el,t);S.odoPrev=t;}
function grantCard(){const u=S.ui;return `<div class="card"><h3>残高の付与（マスター）</h3><div>${Object.entries(S.room.players||{}).map(([id,p])=>`<button class="ent ${u.gt===id?"on":""}" data-act="gpick" data-v="${id}">${esc(p.name)}</button>`).join("")}<button class="ent ${u.gt==="all"?"on":""}" data-act="gpick" data-v="all">全員</button></div>
  <div class="row"><input id="in-ga" data-m="ga" type="number" step="100" placeholder="付与する金額" value="${u.ga}"><button class="ok" data-act="grant">付与する</button></div><p class="small">借入にはなりません</p></div>`;}
const home=()=>`<div class="hero"><h1>HIPPODROME</h1><p>身近なものを、賭けの対象に。架空通貨のみ使用。</p></div>
<div class="card" style="max-width:420px;margin:auto"><label>名前<input id="in-name" data-m="name" value="${esc(S.name)}" maxlength="12"></label>
<button class="primary" data-act="create">ルームを作る</button><hr style="border:0;border-top:1px solid #e6ece7;margin:16px 0">
<label>ルームコード<input id="in-code" data-m="hcode" value="${esc(S.hcode)}" maxlength="8"></label><button class="primary" style="background:#fff;color:#14532d" data-act="join">参加する</button></div>`;

const cdt=()=>{const l=S.room.deadline-now();return l>0?`${Math.floor(l/60000)}:${String(Math.floor(l%60000/1000)).padStart(2,"0")}`:"締切";};
function config(){return `<div class="card"><h2>部屋全体の設定</h2><label>全員の初期金額（円）<input id="in-cfg" data-m="cfg" type="number" step="1000" value="${S.ui.cfg}"></label>
  <button class="primary" data-act="cfgok">この設定で部屋を開く</button></div>`;}
function room(){
  const r=S.room,u=S.ui,me=(r.players||{})[uid],isM=r.master===uid,st=r.status,dl=st==="open"&&r.deadline;
  const lab={config:"部屋設定中",setup:"準備中",open:"発売中",closed:"発売締切",settled:"結果確定"}[st];
  const reqs=Object.entries(r.requests||{}),pend=reqs.filter(([,q])=>q.status==="pending"),mine=reqs.filter(([,q])=>q.uid===uid).sort((a,b)=>b[1].at-a[1].at).slice(0,3);
  const ts=Object.entries(r.tickets||{}).filter(([,t])=>t.uid===uid).sort((a,b)=>b[1].at-a[1].at),net=p=>(p.balance||0)-(p.debt||0);
  const bal=(me&&me.balance)||0,pv=S.odoPrev??bal,ON=Math.max(String(pv).length,String(bal).length);
  const main=st==="config"?(isM?config():`<div class="card c">マスターが部屋の設定中です</div>`):st==="setup"?(isM?setup():`<div class="card c">マスターがラウンドの準備中です</div>`)
    :(dl?`<div class="banner">まもなく発売終了　締切まで <span class="cd2" data-cd>${cdt()}</span></div>`:"")+board()+(st==="open"&&me?betForm():"")+oddsTable()+(isM&&(st==="open"||st==="closed")?control():"")+(st==="settled"?resultView():"");
  return `<div class="bar"><div><b>${esc(r.title||"ルーム")}</b> <span class="small" style="color:#cfe">${r.type==="roulette"?"当たり外れ型":r.type?"順位型":""}</span></div>
  <div>${dl?`<span class="cd" data-cd>${cdt()}</span>`:""}<span class="pill ${st}">${lab}</span></div></div>
  <div class="grid"><main>${main}</main><aside>
  <div class="card"><div class="small">ルームコード <b>${S.code}</b> ${isM?"(マスター)":""} <button style="float:right;padding:2px 8px" data-act="leave">退出</button></div>
  <div class="small" style="margin-top:8px">手持ち残高</div><div class="amt"><span id="odo" class="odo" data-n="${ON}" data-v="${pv}" data-t="${bal}">${odoHTML(pv,ON)}</span><span class="odu">円</span></div>
  <div class="small">借入残高 ${yen(me&&me.debt)}</div><button data-act="atmopen" style="margin-top:8px">ATMを利用する</button></div>
  ${mine.length?`<div class="card"><h3>ご融資の申請</h3>${mine.map(([,q])=>`<div class="small">${yen(q.amount)}　${{pending:"承認待ち",approved:"承認",rejected:"却下"}[q.status]}</div>`).join("")}</div>`:""}
  ${isM?grantCard():""}${isM&&pend.length?`<div class="card"><h3>ご融資の申請（${pend.length}件）</h3>${pend.map(([id,q])=>`<div class="rq"><span>${esc(q.name)} / <b>${yen(q.amount)}</b></span><button class="ok" data-act="apv" data-v="${id}">承認</button><button class="red" data-act="rej" data-v="${id}">却下</button></div>`).join("")}</div>`:""}
  ${ts.length?`<div class="card"><h3>自分の馬券</h3>${ts.map(([id,t])=>tk(t,S.anim,id)).join("")}</div>`:""}
  <div class="card"><h3>参加者（資産順）</h3>${Object.values(r.players||{}).sort((a,b)=>net(b)-net(a)).map(p=>`<div class="small" style="font-size:13px">${esc(p.name)}　資産 ${yen(net(p))}${p.debt?`（借入 ${yen(p.debt)}）`:""}</div>`).join("")}</div>
  </aside></div>${u.modal?modal():""}`;
}

const VT={win:["WIN","単勝"],place:["PLACE","複勝"],quinella:["QUINELLA","馬連"],exacta:["EXACTA","馬単"],wide:["WIDE","ワイド"],trio:["TRIO","3連複"],trifecta:["TRIFECTA","3連単"],r:["BET","投票"]};
function qr(seed){let h=7;for(const c of String(seed))h=(h*31+c.charCodeAt(0))>>>0;const N=21,fz=(x,y)=>(x<8&&y<8)||(x>12&&y<8)||(x<8&&y>12),rn=()=>((h=(h*1664525+1013904223)>>>0)>>>16)%2;let d="";
  for(let y=0;y<N;y++){let x=0;while(x<N){if(!fz(x,y)&&rn()){let e=x;while(e+1<N&&!fz(e+1,y)&&rn())e++;d+=`M${x} ${y}h${e-x+1}v1h-${e-x+1}z`;x=e+1;}else x++;}}
  const f=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#f6f8f6"/><rect x="${x+2}" y="${y+2}" width="3" height="3"/>`;
  return `<svg viewBox="0 0 21 21" shape-rendering="crispEdges"><path d="${d}"/>${f(0,0)}${f(14,0)}${f(0,14)}</svg>`;}
const sn=id=>{let h=0;for(const c of String(id))h=(h*131+c.charCodeAt(0))>>>0;const g=n=>{let x="";for(let i=0;i<n;i++){h=(h*1103515245+12345)>>>0;x+=(h>>>16)%10;}return x;};return [g(13),g(13),g(8),g(6)].join(" ");};
function tk(t,hide,id){const T=TYPES[t.type],v=VT[t.type],rl=t.type==="r",cs=t.cs||[{s:t.sel||[]}],n=cs.length,per=t.per||t.stake,tot=t.stake||0,k=T?T.k:1,ord=T&&T.o,
  m=t.m||{k:n===1?"normal":"text",sel:cs[0].s||[]},sel=m.sel||[],ax=m.ax||[],pt=m.pt||[],d=new Date(t.at||now()),pay=t.payout,w=pay>0&&!hide,sheets=Math.round(tot/10),N1=i=>i+1,
  grid=a=>`<div class="jt-g">${ents().map((e,i)=>`<span class="${a.includes(i)?"s":""}">${i+1}</span>`).join("")}</div>`,
  amt=`<span class="jt-a">☆☆☆${per.toLocaleString()}円</span>`,star=(x,c)=>"★".repeat(Math.max(1,c-String(x).length));let r;
  if(rl)r=`<b class="jt-hn rl">${esc(t.disp)}</b>${cs[0].o?`<div class="jt-i">倍率 ×${cs[0].o.toFixed(1)}</div>`:""}${amt}`;
  else if(m.k==="text")r=`<b class="jt-c" style="font-size:5cqw">${esc(t.disp)}</b><div class="jt-i">組合せ数 <b>${n}</b></div>${amt}`;
  else if(m.k==="normal"&&k===1)r=`<div class="jt-row"><span class="jt-bx">${sel[0]+1}</span><b class="jt-hn">${esc((ents()[sel[0]]||{}).name||"")}</b></div>${amt}`;
  else if(m.k==="normal")r=`<b class="jt-c">${sel.map(N1).join(ord?"→":"-")}</b>${amt}`;
  else if(m.k==="box")r=`<div class="jt-lb">ボックス</div>${grid(sel)}<div class="jt-i">組合せ数 <b>${n}</b>　各組 ${amt}</div>`;
  else r=`<div class="jt-lb">${ord?(m.pos+1)+"着":""}流し</div><div class="jt-row jt-nag"><b class="jt-c">${ax.map(N1).join("-")}</b><i>▶</i>${grid(pt)}</div><div class="jt-i">組合せ数 <b>${n}</b>　各組 ${amt}</div>`;
  return `<div class="jtw"><div class="jt"><div class="jt-band"></div>
  <div class="jt-l"><div class="jt-d">${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日</div><div class="jt-v">${esc(S.code)}</div><div class="jt-rc"><b>${S.room.round||1}</b>レース</div>
  <div class="jt-q">${qr((id||"preview")+"a")}${qr((id||"preview")+"b")}</div><div class="jt-tt">${esc(S.room.title||"")}</div><div class="jt-f">HIPPODROME</div></div>
  <div class="jt-mid"><small>${v[0]}</small>${k>=2&&m.k==="normal"?"<em>普通</em>":""}<span>${v[1]}</span><small>${v[0]}</small></div>
  <div class="jt-rt"><div class="jt-r">${r}</div><div class="jt-tot">合計 ${star(sheets,6)}${sheets}枚 ${star(tot.toLocaleString(),7)}${tot.toLocaleString()}円</div><div class="jt-no">${sn(id||"preview")}</div></div>${w?`<span class="stamp">的中</span>`:""}</div>
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
  const rl=isRl(),d=S.ui.draft||(S.ui.draft={title:r.title||"",ent:ents().map(e=>({name:e.name,odds:e.odds,w:e.w??"",j:e.j??jit()})),rate:r.rate??1,mode:r.pmode?"prob":"odds"}),pm=d.mode==="prob",od=pm?draftOdds(d):[];
  return `<div class="card"><h2>${rl?"選択肢と払戻倍率":"出走馬とオッズ"}</h2>
  <label>タイトル<input id="in-title" data-m="title" value="${esc(d.title)}"></label>
  <div class="tabs"><button class="tab ${pm?"":"on"}" data-act="smode" data-v="odds">オッズで入力</button><button class="tab ${pm?"on":""}" data-act="smode" data-v="prob">勝率で入力（オッズを自動計算）</button></div>
  ${pm?`<p class="hint">${rl?"それぞれが当たる確率(%)を入力":"なんとなくの勝ちやすさを数字で入力（合計100でなくてOK。大きいほど有力）"}<br>オッズには±8%ほどの揺らぎが自動で入ります <button class="gray" data-act="reroll">揺らぎを再抽選</button></p>`:""}
  <table><tr><th></th><th>名前</th><th>${pm?"勝率":rl?"倍率":"単勝オッズ"}</th>${pm?"<th>オッズ</th>":""}<th></th></tr>
  ${d.ent.map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td><input id="en${i}" data-m="en:${i}" placeholder="名前" value="${esc(e.name)}"></td>
  ${pm?`<td><input id="ew${i}" data-m="ew:${i}" type="number" step="any" min="0" value="${e.w??""}" style="width:90px"></td><td><b id="od${i}">${od[i]>=1.1?od[i].toFixed(1):"-"}</b></td>`
  :`<td><input id="eo${i}" data-m="eo:${i}" type="number" step="0.1" value="${e.odds??""}" style="width:100px"></td>`}
  <td><button class="red" data-act="delent" data-v="${i}">削除</button></td></tr>`).join("")}</table>
  <button data-act="addent">追加</button><button class="gray" data-act="clr">出走馬・オッズをクリア</button>
  <label>払戻率（0.5〜1）<input id="in-rate" data-m="rate" type="number" step="0.01" value="${d.rate}"></label>
  <button class="primary" data-act="start">発売開始</button> <button data-act="settype" data-v="">タイプを選び直す</button></div>`;}

function board(){const r=S.room,rl=isRl(),O=rl?null:odds(),pool=Object.values(r.tickets||{}).reduce((a,t)=>a+t.stake,0);
  return `<div class="card"><h2>${rl?"オッズ（的中時の払戻倍率）":"出馬表"}</h2><table><tr><th>${rl?"No":"馬番"}</th><th>名前</th><th>${rl?"倍率":"単勝"}</th>${rl?"":"<th>複勝</th>"}</tr>
  ${ents().map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td>${esc(e.name)}</td><td><b>${e.odds.toFixed(1)}</b></td>${rl?"":`<td>${O.place[i].toFixed(1)}</td>`}</tr>`).join("")}</table>
  <div class="small" style="margin-top:8px">発売額合計 <b>${yen(pool)}</b></div></div>`;}

const perms=(a,m)=>m===0?[[]]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)],m-1).map(p=>[x,...p]));
const combs=(a,m)=>m===0?[[]]:a.flatMap((x,i)=>combs(a.slice(i+1),m-1).map(c=>[x,...c]));
function genCombos(){const u=S.ui;if(isRl())return u.sel.length===1?[u.sel]:[];const t=u.type;if(!t)return [];const T=TYPES[t],k=T.k,m=k===1?"normal":u.method;
  if(m==="normal")return u.sel.length===k?[u.sel]:[];
  if(m==="box")return u.sel.length>=k?(T.o?perms(u.sel,k):combs(u.sel,k)):[];
  const ax=u.axis,pt=u.part;
  if(T.o){if(ax.length!==1||pt.length<k-1)return [];return perms(pt,k-1).map(p=>{const o=[...p];o.splice(u.pos,0,ax[0]);return o;});}
  if(ax.length<1||ax.length>k-1||pt.length<k-ax.length)return [];
  return combs(pt,k-ax.length).map(c=>[...ax,...c]);}
const methOf=()=>{if(isRl())return "";const T=TYPES[S.ui.type];return !T||T.k===1?"通常":{normal:"通常",box:"ボックス",nagashi:"流し"}[S.ui.method];};
const mOf=()=>{const u=S.ui,T=TYPES[u.type];return {k:isRl()||!T||T.k===1?"normal":u.method,sel:[...u.sel],ax:[...u.axis],pt:[...u.part],pos:u.pos};};
function dispOf(){const u=S.ui,n=i=>i+1;if(isRl())return u.sel.length?ents()[u.sel[0]].name:"";const T=TYPES[u.type],m=T.k===1?"normal":u.method;
  if(m==="normal")return u.sel.map(n).join(T.o?"→":"-");if(m==="box")return u.sel.map(n).join("-");
  return `${T.o?(u.pos+1)+"着軸 ":"軸 "}${u.axis.map(n).join("-")} / 相手 ${u.part.map(n).join("-")}`;}
function betInfo(){const u=S.ui,t=isRl()?"r":u.type,cs=genCombos(),per=Number(u.stake)||0,n=cs.length;let lo=null,hi=null;
  if(t&&n&&n<=300){const os=cs.map(x=>getOdds(t,x));lo=Math.min(...os);hi=Math.max(...os);}
  return {t,cs,per,n,lo,hi,tot:per*n};}
function refreshBet(){const b=betInfo(),f=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;},g=(a,c)=>a===c?a:`${a}〜${c}`,p=o=>yen(Math.floor(b.per*o/10)*10);
  f("b-n",b.n);f("b-tot",yen(b.tot));f("b-od",b.lo==null?"-":g(b.lo.toFixed(1),b.hi.toFixed(1)));f("b-pay",b.lo==null||!b.per?"-":g(p(b.lo),p(b.hi)));
  const e=document.getElementById("b-go");if(e)e.disabled=!(b.n&&b.per>=100);}
function refreshDraft(){const d=S.ui.draft;if(!d||d.mode!=="prob")return;draftOdds(d).forEach((o,i)=>{const e=document.getElementById("od"+i);if(e)e.textContent=o>=1.1?o.toFixed(1):"-";});}

function betForm(){const u=S.ui,rl=isRl(),t=rl?"r":u.type,T=TYPES[t],k=T?T.k:1,m=rl||!T||k===1?"normal":u.method,b=betInfo();
  const btn=(e,i)=>{const A=u.axis.includes(i),P=u.part.includes(i),on=m==="nagashi"?A||P:u.sel.includes(i);
    return `<button class="ent ${on?(P?"on2":"on"):""}" data-act="pick" data-v="${i}">${num(i)}${esc(e.name)}${m==="normal"&&T?.o&&u.sel.includes(i)?`<i>${u.sel.indexOf(i)+1}</i>`:""}</button>`;};
  const hint=!t?"券種を選択してください":rl?"賭ける対象を選択":m==="normal"?`${k}頭を選択${T.o?"（選択順が着順）":""}`:m==="box"?`${k}頭以上を選択。組み合わせを全通り購入します`:`軸${T.o?"1頭":`1〜${k-1}頭`}と相手を選択（緑＝軸、青＝相手）`;
  return `<div class="card"><h2>投票</h2>${rl?"":`<div class="tabs">${Object.entries(TYPES).map(([id,v])=>`<button class="tab ${u.type===id?"on":""}" data-act="type" data-v="${id}">${v.n}</button>`).join("")}</div>`}
  ${T&&k>=2?`<div class="tabs">${[["normal","通常"],["box","ボックス"],["nagashi","流し"]].map(([id,l])=>`<button class="tab ${u.method===id?"on":""}" data-act="meth" data-v="${id}">${l}</button>`).join("")}</div>`:""}
  <p class="hint">${hint}</p>
  ${t&&m==="nagashi"?`<div class="tabs"><button class="tab ${u.tgt==="axis"?"on":""}" data-act="tgt" data-v="axis">軸馬を選ぶ</button><button class="tab ${u.tgt==="part"?"on":""}" data-act="tgt" data-v="part">相手馬を選ぶ</button></div>
  ${T.o?`<div class="tabs">軸の着順 ${Array.from({length:k},(_,j)=>`<button class="tab ${u.pos===j?"on":""}" data-act="pos" data-v="${j}">${j+1}着</button>`).join("")}</div>`:""}`:""}
  ${t?`<div>${ents().map(btn).join("")}</div>`:""}
  <div class="row"><span>1点あたり <input id="in-stake" data-m="stake" type="number" step="100" min="100" placeholder="100円単位" value="${u.stake}"></span></div>
  <div class="row" style="gap:10px 18px"><span>点数 <b id="b-n"></b></span><span>合計 <b id="b-tot"></b></span><span>オッズ <b id="b-od"></b></span><span>的中時(1点) <b id="b-pay"></b></span></div>
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
  if(isRl())(res.wins||[]).forEach(i=>rows.push(["当たり",esc(ents()[i].name),ents()[i].odds]));
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
    case"amt":h=`<h3 class="at">金額の入力（${N}）</h3><p class="small">借入残高 ${yen(me.debt)}${A.mode==="rep"?" / 手持ち "+yen(me.balance):""}　1,000円単位</p><div class="disp">金額：${txt}円</div><div class="err">${esc(A.err||"")}</div><div class="pad2">${pad}<div class="side"><button class="k u" data-act="ak" data-v="万">万</button><button class="k u" data-act="ak" data-v="千">千</button><button class="k en" data-act="ak" data-v="円">円</button></div></div>`;break;
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
  return `<div class="ov"><div class="atmm"><div class="sign"><span>HIPPODROME BANK　ATM</span>${p.step==="done"?"":`<button class="ab" data-act="aclose">取消 Cancel</button>`}</div><div class="scr"><div class="scr-in">${p.h}</div></div>
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
  const body=rl?`<p class="hint">当たりを選択（複数可、なしも可）</p>${ents().map((e,i)=>`<button class="ent ${u.wins.includes(i)?"on":""}" data-act="winp" data-v="${i}">${esc(e.name)}</button>`).join("")}`
    :[0,1,2].map(j=>`<div class="rr"><b>${j+1}着</b>${ents().map((e,i)=>`<button class="ent ${u.res[j]===i?"on":""}" ${u.res.some((v,k)=>k!==j&&v===i)?"disabled":""} data-act="resp" data-v="${j}|${i}">${num(i)}${esc(e.name)}</button>`).join("")}</div>`).join("");
  return `<div class="card"><h2>結果入力</h2>${body}<button class="primary" data-act="settle" style="margin-top:10px">結果を確定して払戻</button></div>`;}

function resultView(){const r=S.room,res=r.result||{},A=S.anim,isM=r.master===uid;let body;
  if(isRl()){const w=res.wins||[];body=w.length?w.map((i,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${2+j*.6}s">${esc(ents()[i].name)}</div>`).join(""):`<div class="rank ${A?"rv":""}" style="animation-delay:2s">全てハズレ</div>`;}
  else{const d=[4,2.6,.9];body=(res.order||[]).map((i,j)=>`<div class="rank ${A?"rv":""}" style="animation-delay:${d[j]}s">${j+1}着　${num(i)}${esc(ents()[i].name)}</div>`).join("");}
  return `<div class="card"><h2>${A?"<span class='pulse'>判定中</span>":"結果"}</h2>${body}${payTable(res,A)}${isM&&!A?`<button data-act="next">次のラウンドへ</button>`:""}</div>`;}

function hit(r,t,res){if(r.type==="roulette")return(res.wins||[]).includes(t.sel[0]);
  const o=res.order,s=t.sel,top=o.slice(0,3);
  switch(t.type){case"win":return s[0]===o[0];case"place":return top.includes(s[0]);case"quinella":return s.every(x=>o.slice(0,2).includes(x));
    case"exacta":return s[0]===o[0]&&s[1]===o[1];case"wide":case"trio":return s.every(x=>top.includes(x));case"trifecta":return s.every((x,i)=>x===o[i]);}}

async function buy(){const r=S.room,u=S.ui,b=betInfo(),t=b.t;u.modal=false;
  if(r.status!=="open"||(r.deadline&&now()>r.deadline)){render();return alert("発売は締め切られました");}
  if(!b.n||!(b.per>=100&&b.per%100===0)){render();return alert("買い目と、100円単位の金額を入力してください");}
  if(b.n>300){render();return alert("点数が多すぎます（300点まで）");}
  const cs=b.cs.map(x=>({s:x,o:getOdds(t,x)}));
  const res=await runTransaction(ref(db,`rooms/${S.code}/players/${uid}/balance`),x=>(x>=b.tot?x-b.tot:undefined));
  if(!res.committed){render();return alert("残高が足りません");}
  await push(R("tickets"),{uid,name:S.name,type:t,meth:methOf(),disp:dispOf(),m:mOf(),per:b.per,stake:b.tot,cs,at:now()});
  u.sel=[];u.axis=[];u.part=[];u.stake="";render();}
async function start(){const d=S.ui.draft,rl=isRl(),pm=d.mode==="prob";
  if(!d.ent.length||d.ent.some(e=>!String(e.name).trim()))return alert("全ての名前を入力してください");
  if(!rl&&(d.ent.length<3||d.ent.length>18))return alert("出走数は3〜18です");
  const rate=Number(d.rate);if((!rl||pm)&&!(rate>=0.5&&rate<=1))return alert("払戻率は0.5〜1で入力してください");
  const od=draftOdds(d);if(od.some(o=>!(o>=1.1)))return alert(pm?"全ての勝率を入力してください":"全てのオッズに1.1以上を入力してください");
  await update(R(),{title:d.title.trim(),entrants:d.ent.map((e,i)=>({name:String(e.name).trim(),odds:od[i],...(pm?{w:Number(e.w),j:e.j||1}:{})})),pmode:pm,rate:rate||1,status:"open",deadline:null});
  S.ui.draft=null;S.ui.sel=[];S.ui.type=null;}
async function settle(){const r=S.room,u=S.ui;if(r.status!=="closed")return;let result;
  if(isRl())result={wins:u.wins};else{if(u.res.some(v=>v==="")||new Set(u.res).size<3)return alert("1〜3着を重複なく選んでください");result={order:u.res.map(Number)};}
  const pay={},up={result,status:"settled",settledAt:now()};
  Object.entries(r.tickets||{}).forEach(([id,t])=>{const cs=t.cs||[{s:t.sel,o:t.odds}],per=t.per||t.stake,p=cs.reduce((a,c)=>a+(hit(r,{type:t.type,sel:c.s},result)?Math.floor(per*c.o/10)*10:0),0);up[`tickets/${id}/payout`]=p;if(p)pay[t.uid]=(pay[t.uid]||0)+p;});
  await update(R(),up);
  for(const[id,p]of Object.entries(pay))await runTransaction(ref(db,`rooms/${S.code}/players/${id}/balance`),b=>(b||0)+p);}

const acts={
  create:()=>{if(!S.name.trim())return alert("名前を入力してください");create();},
  join:()=>{if(!S.name.trim()||!S.hcode.trim())return alert("名前とコードを入力してください");join(S.hcode.trim().toUpperCase());},
  leave:()=>{unsub&&unsub();localStorage.removeItem("code");S.code="";S.room=null;render(true);},
  settype:v=>{S.ui.draft=null;update(R(),{type:v||null});},
  addent:()=>{S.ui.draft.ent.push({name:"",odds:"",w:"",j:jit()});render();},
  delent:v=>{S.ui.draft.ent.splice(v,1);render();},
  start,buy,settle,
  close:async()=>{if(closing)return;closing=true;await update(R(),{status:"closed"});closing=false;},
  next:()=>{S.ui.draft=null;S.ui.res=["","",""];S.ui.wins=[];S.ui.sel=[];S.ui.type=null;update(R(),{status:"setup",tickets:null,result:null,settledAt:null,deadline:null,type:null,round:(S.room.round||1)+1});},
  type:v=>{Object.assign(S.ui,{type:v,sel:[],axis:[],part:[],pos:0});render();},
  meth:v=>{Object.assign(S.ui,{method:v,sel:[],axis:[],part:[]});render();},pos:v=>{S.ui.pos=+v;render();},tgt:v=>{S.ui.tgt=v;render();},
  pick:v=>{const u=S.ui,i=+v;if(isRl()){u.sel=[i];render();return;}const t=u.type;if(!t)return;const T=TYPES[t],m=T.k===1?"normal":u.method;
    if(m==="normal"){if(u.sel.includes(i))u.sel=u.sel.filter(x=>x!==i);else if(T.k===1)u.sel=[i];else if(u.sel.length<T.k)u.sel.push(i);}
    else if(m==="box")u.sel=u.sel.includes(i)?u.sel.filter(x=>x!==i):[...u.sel,i];
    else{const a=u.tgt,o=a==="axis"?"part":"axis",lim=T.o?1:T.k-1;
      if(u[a].includes(i))u[a]=u[a].filter(x=>x!==i);else{u[o]=u[o].filter(x=>x!==i);u[a]=a==="axis"?[...u.axis,i].slice(-lim):[...u.part,i];}}
    render();},
  review:()=>{S.ui.modal=true;render();},cancel:()=>{S.ui.modal=false;render();},
  ot:v=>{S.ui.ot=v;S.ui.ax=0;render();},axis:v=>{S.ui.ax=+v;render();},
  cell:v=>{const[t,x]=v.split("|");Object.assign(S.ui,{type:t,method:"normal",axis:[],part:[],sel:x.split("-").map(Number)});render();const e=document.getElementById("in-stake");if(e){e.scrollIntoView({block:"center"});e.focus();}},
  cfgok:async()=>{const n=Number(S.ui.cfg);if(!(n>=1000))return alert("初期金額を入力してください");const up={initBalance:n,status:"setup"};Object.keys(S.room.players||{}).forEach(id=>up[`players/${id}/balance`]=n);await update(R(),up);},
  clr:()=>{S.ui.draft.ent=[];update(R(),{entrants:null});render();},
  reroll:()=>{S.ui.draft.ent.forEach(e=>e.j=jit());render();},
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
  grant:async()=>{const u=S.ui,n=Number(u.ga);if(!u.gt)return alert("付与する相手を選んでください");if(!(n>0&&n%100===0))return alert("100円単位の金額を入力してください");
    for(const id of(u.gt==="all"?Object.keys(S.room.players||{}):[u.gt]))await runTransaction(ref(db,`rooms/${S.code}/players/${id}/balance`),b=>(b||0)+n);u.ga="";render();},
  apv:async id=>{const q=S.room.requests[id];if(q.status!=="pending")return;await update(R(`requests/${id}`),{status:"approved"});const b=`rooms/${S.code}/players/${q.uid}`;
    await runTransaction(ref(db,b+"/balance"),x=>(x||0)+q.amount);await runTransaction(ref(db,b+"/debt"),x=>(x||0)+q.amount);},
  rej:id=>update(R(`requests/${id}`),{status:"rejected"})
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(b&&!b.disabled)acts[b.dataset.act](b.dataset.v);});
document.addEventListener("input",e=>{const m=e.target.dataset.m;if(!m)return;const v=e.target.value,[k,i]=m.split(":"),u=S.ui;
  if(k==="name")S.name=v;else if(k==="hcode")S.hcode=v;else if(k==="stake"){u.stake=v;refreshBet();}
  else if(k==="bank")u.draft.bank=v;
  else if(k==="title")u.draft.title=v;else if(k==="en")u.draft.ent[i].name=v;else if(k==="eo")u.draft.ent[i].odds=v;else if(k==="ew"){u.draft.ent[i].w=v;refreshDraft();}else if(k==="cfg")u.cfg=v;else if(k==="ga")u.ga=v;
  else if(k==="rate"){u.draft.rate=v;refreshDraft();}else if(k==="init")u.draft.init=v;else if(k==="dl")u.draft.dl=v;
  else if(k==="res")u.res[i]=v;else if(k==="win")u.wins=e.target.checked?[...u.wins,+i]:u.wins.filter(x=>x!==+i);});
document.addEventListener("focusout",()=>{if(S.pend)setTimeout(()=>{if(S.pend&&!/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement||{}).tagName))render();},60);});
document.addEventListener("keydown",e=>{const A=S.ui.atm;if(!A||A.step!=="amt"||/INPUT|SELECT/.test(e.target.tagName))return;
  if(/^\d$/.test(e.key))acts.ak(e.key);else if(e.key==="Backspace")acts.ak("fix");else if(e.key==="Enter"&&A.step==="amt")acts.ak("円");});
setInterval(()=>{const r=S.room;if(!r||r.status!=="open"||!r.deadline)return;const l=r.deadline-now(),t=cdt();
  document.querySelectorAll("[data-cd]").forEach(e=>{e.textContent=t;e.classList.toggle("warn",l<=30000);});if(l<=0&&r.master===uid)acts.close();},1000);
if(S.code)join(S.code).catch(()=>{});else render(true);
