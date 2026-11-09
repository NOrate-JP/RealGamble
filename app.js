import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getDatabase,ref,onValue,set,update,push,runTransaction,get} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {firebaseConfig} from "./config.js";
import {calcOdds,TYPES,key} from "./odds.js";

const db=getDatabase(initializeApp(firebaseConfig)), $=s=>document.querySelector(s);
let off=0;const now=()=>Date.now()+off;onValue(ref(db,".info/serverTimeOffset"),x=>{off=x.val()||0;});
const uid=localStorage.uid||(localStorage.uid=crypto.randomUUID());
const S={code:localStorage.code||"",name:localStorage.name||"",room:null,hcode:"",lock:0,anim:false,seen:{},
  ui:{sel:[],type:null,stake:"",draft:null,res:["","",""],wins:[],modal:false,cfg:"10000",method:"normal",axis:[],part:[],pos:0,tgt:"axis",atm:null,ot:"quinella",ax:0}};
let unsub=null,oc={k:"",v:null},closing=false;
const R=p=>ref(db,`rooms/${S.code}${p?"/"+p:""}`);
const yen=n=>(n||0).toLocaleString()+"円", esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ents=()=>S.room.entrants||[], isRl=()=>S.room.type==="roulette";
const num=i=>isRl()?"":`<span class="num n${i%8}">${i+1}</span>`;
const odds=()=>{const r=S.room,k=JSON.stringify([ents(),r.rate]);if(oc.k!==k)oc={k,v:calcOdds(ents(),r.rate)};return oc.v};
const getOdds=(t,sel)=>isRl()?ents()[sel[0]].odds:odds()[t][key(t,sel)];

function watch(){unsub&&unsub();unsub=onValue(R(),s=>{const v=s.val();S.room=v;let f=false;
  if(v&&v.status==="settled"&&v.settledAt&&!S.seen[v.settledAt]){S.seen[v.settledAt]=1;
    if(Math.abs(now()-v.settledAt)<15000){S.anim=true;S.lock=now()+6800;f=true;setTimeout(()=>{S.anim=false;S.lock=0;render(true)},6900);}}
  render(f,true);});}
async function join(code){
  const snap=await get(ref(db,`rooms/${code}`));if(!snap.exists())return alert("ルームが見つかりません");
  S.code=code;localStorage.code=code;localStorage.name=S.name;
  const pr=ref(db,`rooms/${code}/players/${uid}`);
  if(!(await get(pr)).exists())await set(pr,{name:S.name,balance:snap.val().initBalance??0,bank:0,debt:0});
  watch();}
async function create(){const code=Math.random().toString(36).slice(2,7).toUpperCase();
  await set(ref(db,`rooms/${code}`),{master:uid,status:"config"});await join(code);}

function render(f,db){
  if(!f&&now()<S.lock)return;
  if(db&&/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement||{}).tagName)){S.pend=true;return;}
  S.pend=false;
  const a=document.activeElement,id=a&&a.id,pos=a&&a.selectionStart;
  $("#app").innerHTML=!S.code?home():!S.room?`<p class="c">読み込み中（ルームが無い場合は<button data-act="leave">戻る</button>）</p>`:room();
  if(id){const e=document.getElementById(id);if(e){e.focus();try{e.setSelectionRange(pos,pos)}catch{}}}}

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
  const ts=Object.entries(r.tickets||{}).filter(([,t])=>t.uid===uid).sort((a,b)=>b[1].at-a[1].at),net=p=>(p.balance||0)+(p.bank||0)-(p.debt||0);
  const main=st==="config"?(isM?config():`<div class="card c">マスターが部屋の設定中です</div>`):st==="setup"?(isM?setup():`<div class="card c">マスターがラウンドの準備中です</div>`)
    :(dl?`<div class="banner">まもなく発売終了　締切まで <span class="cd2" data-cd>${cdt()}</span></div>`:"")+board()+(st==="open"&&me?betForm():"")+oddsTable()+(isM&&(st==="open"||st==="closed")?control():"")+(st==="settled"?resultView():"");
  return `<div class="bar"><div><b>${esc(r.title||"ルーム")}</b> <span class="small" style="color:#cfe">${r.type==="roulette"?"当たり外れ型":r.type?"順位型":""}</span></div>
  <div>${dl?`<span class="cd" data-cd>${cdt()}</span>`:""}<span class="pill ${st}">${lab}</span></div></div>
  <div class="grid"><main>${main}</main><aside>
  <div class="card"><div class="small">ルームコード <b>${S.code}</b> ${isM?"(マスター)":""} <button style="float:right;padding:2px 8px" data-act="leave">退出</button></div>
  <div class="small" style="margin-top:8px">手持ち残高</div><div class="amt">${yen(me&&me.balance)}</div>
  <div class="small">口座残高 ${yen(me&&me.bank)}　借入残高 ${yen(me&&me.debt)}</div><button data-act="atmopen" style="margin-top:8px">ATMを利用する</button></div>
  ${mine.length?`<div class="card"><h3>ご融資の申請</h3>${mine.map(([,q])=>`<div class="small">${yen(q.amount)}　${{pending:"承認待ち",approved:"承認",rejected:"却下"}[q.status]}</div>`).join("")}</div>`:""}
  ${isM&&pend.length?`<div class="card"><h3>ご融資の申請（${pend.length}件）</h3>${pend.map(([id,q])=>`<div class="rq"><span>${esc(q.name)} / <b>${yen(q.amount)}</b></span><button class="ok" data-act="apv" data-v="${id}">承認</button><button class="red" data-act="rej" data-v="${id}">却下</button></div>`).join("")}</div>`:""}
  ${ts.length?`<div class="card"><h3>自分の馬券</h3>${ts.map(([id,t])=>tk(t,S.anim,id)).join("")}</div>`:""}
  <div class="card"><h3>参加者（資産順）</h3>${Object.values(r.players||{}).sort((a,b)=>net(b)-net(a)).map(p=>`<div class="small" style="font-size:13px">${esc(p.name)}　資産 ${yen(net(p))}${p.debt?`（借入 ${yen(p.debt)}）`:""}</div>`).join("")}</div>
  </aside></div>${u.modal?modal():""}${u.atm?atm():""}`;
}

function tk(t,hide,id){const T=TYPES[t.type],n=(t.cs||[1]).length,disp=t.disp??(t.sel||[]).map(i=>i+1).join("-"),d=new Date(t.at||now()),p2=x=>String(x).padStart(2,"0"),
  ts=`${p2(d.getMonth()+1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`,pay=t.payout,w=pay>0&&!hide;
  return `<div class="tkt tk-${t.type}"><div class="tkt-h"><span>HIPPODROME</span><span>${ts}</span></div>
  <div class="tkt-t">${t.type==="r"?"投票券":T.n}<small>${esc(t.meth||"")}</small></div><div class="tkt-b">${esc(disp)}</div>
  <div class="tkt-m"><span>${n}点</span><span>￥${(t.stake||0).toLocaleString()}</span></div><div class="tkt-bar"></div>
  <div class="tkt-s">${esc(S.room.title||"")}　No.${id?id.slice(-8).toUpperCase():"--------"}</div>
  ${hide||pay==null?"":w?`<div class="tkt-r">払戻金 ￥${pay.toLocaleString()}</div><span class="stamp">的中</span>`:`<div class="tkt-r x">ハズレ</div>`}</div>`;}

function draftOdds(d){const rate=Number(d.rate)||0.8;if(d.mode!=="prob")return d.ent.map(e=>Number(e.odds));
  const ws=d.ent.map(e=>Number(e.w)||0);
  if(isRl())return ws.map(w=>w>0&&w<100?Math.max(1.1,Math.floor(rate/(w/100)*10)/10):NaN);
  const t=ws.reduce((a,b)=>a+b,0);return ws.map(w=>w>0?Math.max(1.1,Math.floor(rate*t/w*10)/10):NaN);}
function setup(){const r=S.room;
  if(!r.type)return `<div class="card"><h2>このラウンドのタイプを選択</h2><div class="two">
  <button class="big" data-act="settype" data-v="ranking"><b>順位型</b><span>競馬のように着順で的中が決まる。全券種のオッズを自動生成</span></button>
  <button class="big" data-act="settype" data-v="roulette"><b>当たり外れ型</b><span>ルーレットのように選択肢ごとに当たり外れが出る</span></button></div></div>`;
  const rl=isRl(),d=S.ui.draft||(S.ui.draft={title:r.title||"",ent:ents().map(e=>({...e})),rate:r.rate??0.8,mode:"odds"}),pm=d.mode==="prob",od=pm?draftOdds(d):[];
  return `<div class="card"><h2>${rl?"選択肢と払戻倍率":"出走馬とオッズ"}</h2>
  <label>タイトル<input id="in-title" data-m="title" value="${esc(d.title)}"></label>
  <div class="tabs"><button class="tab ${pm?"":"on"}" data-act="smode" data-v="odds">オッズで入力</button><button class="tab ${pm?"on":""}" data-act="smode" data-v="prob">勝率で入力（オッズを自動計算）</button></div>
  ${pm?`<p class="hint">${rl?"それぞれが当たる確率(%)を入力":"なんとなくの勝ちやすさを数字で入力（合計100でなくてOK。大きいほど有力）"}</p>`:""}
  <table><tr><th></th><th>名前</th><th>${pm?"勝率":rl?"倍率":"単勝オッズ"}</th>${pm?"<th>オッズ</th>":""}<th></th></tr>
  ${d.ent.map((e,i)=>`<tr><td>${rl?i+1:num(i)}</td><td><input id="en${i}" data-m="en:${i}" placeholder="名前" value="${esc(e.name)}"></td>
  ${pm?`<td><input id="ew${i}" data-m="ew:${i}" type="number" step="any" min="0" value="${e.w??""}" style="width:90px"></td><td><b id="od${i}">${od[i]>=1.1?od[i].toFixed(1):"-"}</b></td>`
  :`<td><input id="eo${i}" data-m="eo:${i}" type="number" step="0.1" value="${e.odds??""}" style="width:100px"></td>`}
  <td><button class="red" data-act="delent" data-v="${i}">削除</button></td></tr>`).join("")}</table>
  <button data-act="addent">追加</button>
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

function modal(){const u=S.ui,b=betInfo(),tkt={type:b.t,meth:methOf(),disp:dispOf(),stake:b.tot,cs:b.cs,at:now()};
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

function atm(){const A=S.ui.atm,me=(S.room.players||{})[uid]||{},kb=k=>`<button class="k" data-act="ak" data-v="${k}">${k}</button>`;
  const pad=`<div class="pad">${[1,2,3,4,5,6,7,8,9,0].map(kb).join("")}<button class="k fix" data-act="ak" data-v="fix">訂正</button></div>`,cur=A.amt+Number(A.tmp||0);
  const N={dep:"お預入れ",wd:"お引出し",loan:"ご融資",rep:"ご返済"}[A.mode];let h;
  if(A.step==="menu")h=`<h3 class="at">ご希望の取引を押してください</h3><div class="am">
    <button class="mb" data-act="amode" data-v="dep">お預入れ<small>Deposit</small></button><button class="mb" data-act="amode" data-v="wd">お引出し<small>Withdrawal</small></button>
    <button class="mb" data-act="amode" data-v="loan">ご融資（借入）<small>Cash Advance</small></button><button class="mb" data-act="amode" data-v="rep">ご返済<small>Repayment</small></button>
    <button class="sb" data-act="ainq" data-v="in1">出金可能額照会<small>Available Balance</small></button><button class="sb" data-act="ainq" data-v="in2">入金可能額照会<small>Deposit Limit</small></button></div>`;
  else if(A.step==="inq")h=`<h3 class="at">${A.mode==="in1"?"出金可能額照会":"入金可能額照会"}</h3><div class="disp" style="text-align:left;font-size:16px">${A.mode==="in1"
    ?`お引出し可能額（口座残高）<br><b>${yen(me.bank)}</b><br><span class="small">ご融資はマスターの承認制です</span>`
    :`お預入れ可能額（手持ち）<br><b>${yen(me.balance)}</b><br>ご返済額（借入残高）<br><b>${yen(me.debt)}</b>`}</div><button data-act="amenu">メニューへ戻る</button>`;
  else if(A.step==="pin")h=`<h3 class="at">暗証番号の${me.pin?"入力":"登録"}</h3><p class="small">${me.pin?"暗証番号を入力してください":"今回使う4桁を決めて入力してください（実在の暗証番号は使わないこと）"}</p><div class="disp">${"●".repeat(A.pin.length)||"&nbsp;"}</div>${pad}`;
  else if(A.step==="amt")h=`<h3 class="at">金額の入力（${N}）</h3><p class="small">${{dep:"手持ち残高 "+yen(me.balance),wd:"口座残高 "+yen(me.bank),loan:"借入残高 "+yen(me.debt)+"（マスター承認制）",rep:"借入残高 "+yen(me.debt)+" / 手持ち "+yen(me.balance)}[A.mode]}　1,000円単位</p>
    <div class="disp">金額：${cur.toLocaleString()}円</div><div class="pad2">${pad}<div class="side"><button class="k u" data-act="ak" data-v="万">万</button><button class="k u" data-act="ak" data-v="千">千</button><button class="k en" data-act="ak" data-v="円">円</button></div></div>`;
  else h=`<h3 class="at">${esc(A.msg)}</h3>`;
  return `<div class="ov"><div class="atm"><div class="atmh"><b>ATM</b><button class="ab" data-act="aclose">${A.step==="done"?"閉じる":"取引中止"}</button></div>${h}</div></div>`;}
async function atmGo(){const A=S.ui.atm,amt=A.amt,me=S.room.players[uid],P=k=>ref(db,`rooms/${S.code}/players/${uid}/${k}`),fail=m=>{A.amt=0;A.tmp="";render(true);alert(m);};
  if(!(amt>=1000&&amt%1000===0))return fail("金額は1,000円単位で入力してください");
  if(A.mode==="dep"){if(!(await runTransaction(P("balance"),b=>(b>=amt?b-amt:undefined))).committed)return fail("手持ち残高が足りません");
    await runTransaction(P("bank"),b=>(b||0)+amt);A.msg=`${yen(amt)} をお預入れしました`;}
  else if(A.mode==="wd"){if(!(await runTransaction(P("bank"),b=>((b||0)>=amt?b-amt:undefined))).committed)return fail("口座残高が足りません");
    await runTransaction(P("balance"),b=>(b||0)+amt);A.msg=`${yen(amt)} をお引出ししました`;}
  else if(A.mode==="rep"){if((me.debt||0)<amt)return fail("借入残高を超えています");
    if(!(await runTransaction(P("balance"),b=>(b>=amt?b-amt:undefined))).committed)return fail("手持ち残高が足りません");
    await runTransaction(P("debt"),b=>Math.max(0,(b||0)-amt));A.msg=`${yen(amt)} をご返済いただきました`;}
  else{await push(R("requests"),{uid,name:S.name,amount:amt,status:"pending",at:now()});A.msg=`${yen(amt)} のご融資を申し込みました。マスターの承認後に手持ち残高へ反映されます`;}
  A.step="done";render(true);}

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
  await push(R("tickets"),{uid,name:S.name,type:t,meth:methOf(),disp:dispOf(),per:b.per,stake:b.tot,cs,at:now()});
  u.sel=[];u.axis=[];u.part=[];u.stake="";render();}
async function start(){const d=S.ui.draft,rl=isRl(),pm=d.mode==="prob";
  if(!d.ent.length||d.ent.some(e=>!String(e.name).trim()))return alert("全ての名前を入力してください");
  if(!rl&&(d.ent.length<3||d.ent.length>18))return alert("出走数は3〜18です");
  const rate=Number(d.rate);if((!rl||pm)&&!(rate>=0.5&&rate<=1))return alert("払戻率は0.5〜1で入力してください");
  const od=draftOdds(d);if(od.some(o=>!(o>=1.1)))return alert(pm?"全ての勝率を入力してください":"全てのオッズに1.1以上を入力してください");
  await update(R(),{title:d.title.trim(),entrants:d.ent.map((e,i)=>({name:String(e.name).trim(),odds:od[i]})),rate:rate||0.8,status:"open",deadline:null});
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
  addent:()=>{S.ui.draft.ent.push({name:"",odds:"",w:""});render();},
  delent:v=>{S.ui.draft.ent.splice(v,1);render();},
  start,buy,settle,
  close:async()=>{if(closing)return;closing=true;await update(R(),{status:"closed"});closing=false;},
  next:()=>{S.ui.draft=null;S.ui.res=["","",""];S.ui.wins=[];S.ui.sel=[];S.ui.type=null;update(R(),{status:"setup",tickets:null,result:null,settledAt:null,deadline:null,type:null,entrants:null,rate:null,title:null});},
  type:v=>{Object.assign(S.ui,{type:v,sel:[],axis:[],part:[],pos:0});render();},
  meth:v=>{Object.assign(S.ui,{method:v,sel:[],axis:[],part:[]});render();},pos:v=>{S.ui.pos=+v;render();},tgt:v=>{S.ui.tgt=v;render();},
  pick:v=>{const u=S.ui,i=+v;if(isRl()){u.sel=[i];render();return;}const t=u.type;if(!t)return;const T=TYPES[t],m=T.k===1?"normal":u.method;
    if(m==="normal"){if(u.sel.includes(i))u.sel=u.sel.filter(x=>x!==i);else if(T.k===1)u.sel=[i];else if(u.sel.length<T.k)u.sel.push(i);}
    else if(m==="box")u.sel=u.sel.includes(i)?u.sel.filter(x=>x!==i):[...u.sel,i];
    else{const a=u.tgt,o=a==="axis"?"part":"axis",lim=T.o?1:T.k-1;
      if(u[a].includes(i))u[a]=u[a].filter(x=>x!==i);else{u[o]=u[o].filter(x=>x!==i);u[a]=a==="axis"?[...u.axis,i].slice(-lim):[...u.part,i];}}
    render();},
  review:()=>{S.ui.modal=true;render();},cancel:()=>{S.ui.modal=false;render();},
  atmopen:()=>{S.ui.atm={step:"menu",mode:"",pin:"",amt:0,tmp:"",msg:""};render(true);},
  amode:v=>{S.ui.atm.mode=v;S.ui.atm.step="pin";render(true);},aclose:()=>{S.ui.atm=null;render(true);},
  ak:async v=>{const A=S.ui.atm;if(!A)return;const me=S.room.players[uid];
    if(A.step==="pin"){if(v==="fix")A.pin="";else if(/^\d$/.test(v)&&A.pin.length<4)A.pin+=v;
      if(A.pin.length===4){if(!me.pin){await update(R(`players/${uid}`),{pin:A.pin});A.step="amt";}else if(me.pin===A.pin)A.step="amt";else{A.pin="";alert("暗証番号が違います");}}
      render(true);return;}
    if(A.step==="amt"){if(v==="fix"){A.amt=0;A.tmp="";}
      else if(/^\d$/.test(v)){if((A.tmp||"").length<7)A.tmp=(A.tmp||"")+v;}
      else if(v==="万"||v==="千"){A.amt+=Number(A.tmp||1)*(v==="万"?10000:1000);A.tmp="";}
      else if(v==="円"){A.amt+=Number(A.tmp||0);A.tmp="";await atmGo();return;}
      render(true);}},
  ot:v=>{S.ui.ot=v;S.ui.ax=0;render();},axis:v=>{S.ui.ax=+v;render();},
  cell:v=>{const[t,x]=v.split("|");Object.assign(S.ui,{type:t,method:"normal",axis:[],part:[],sel:x.split("-").map(Number)});render();const e=document.getElementById("in-stake");if(e){e.scrollIntoView({block:"center"});e.focus();}},
  cfgok:async()=>{const n=Number(S.ui.cfg);if(!(n>=1000))return alert("初期金額を入力してください");const up={initBalance:n,status:"setup"};Object.keys(S.room.players||{}).forEach(id=>up[`players/${id}/balance`]=n);await update(R(),up);},
  smode:v=>{S.ui.draft.mode=v;render();},
  dl:v=>update(R(),{deadline:+v>0?now()+(+v)*1000:null}),
  resp:v=>{const[j,i]=v.split("|").map(Number);S.ui.res[j]=S.ui.res[j]===i?"":i;render();},
  winp:v=>{const i=+v,w=S.ui.wins;S.ui.wins=w.includes(i)?w.filter(x=>x!==i):[...w,i];render();},
  ainq:v=>{S.ui.atm.mode=v;S.ui.atm.step="inq";render(true);},amenu:()=>{S.ui.atm.step="menu";render(true);},
  apv:async id=>{const q=S.room.requests[id];if(q.status!=="pending")return;await update(R(`requests/${id}`),{status:"approved"});const b=`rooms/${S.code}/players/${q.uid}`;
    await runTransaction(ref(db,b+"/balance"),x=>(x||0)+q.amount);await runTransaction(ref(db,b+"/debt"),x=>(x||0)+q.amount);},
  rej:id=>update(R(`requests/${id}`),{status:"rejected"})
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(b&&!b.disabled)acts[b.dataset.act](b.dataset.v);});
document.addEventListener("input",e=>{const m=e.target.dataset.m;if(!m)return;const v=e.target.value,[k,i]=m.split(":"),u=S.ui;
  if(k==="name")S.name=v;else if(k==="hcode")S.hcode=v;else if(k==="stake"){u.stake=v;refreshBet();}
  else if(k==="bank")u.draft.bank=v;
  else if(k==="title")u.draft.title=v;else if(k==="en")u.draft.ent[i].name=v;else if(k==="eo")u.draft.ent[i].odds=v;else if(k==="ew"){u.draft.ent[i].w=v;refreshDraft();}else if(k==="cfg")u.cfg=v;
  else if(k==="rate"){u.draft.rate=v;refreshDraft();}else if(k==="init")u.draft.init=v;else if(k==="dl")u.draft.dl=v;
  else if(k==="res")u.res[i]=v;else if(k==="win")u.wins=e.target.checked?[...u.wins,+i]:u.wins.filter(x=>x!==+i);});
document.addEventListener("focusout",()=>{if(S.pend)setTimeout(()=>{if(S.pend&&!/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement||{}).tagName))render();},60);});
document.addEventListener("keydown",e=>{const A=S.ui.atm;if(!A||!["pin","amt"].includes(A.step)||/INPUT|SELECT/.test(e.target.tagName))return;
  if(/^\d$/.test(e.key))acts.ak(e.key);else if(e.key==="Backspace")acts.ak("fix");else if(e.key==="Enter"&&A.step==="amt")acts.ak("円");});
setInterval(()=>{const r=S.room;if(!r||r.status!=="open"||!r.deadline)return;const l=r.deadline-now(),t=cdt();
  document.querySelectorAll("[data-cd]").forEach(e=>{e.textContent=t;e.classList.toggle("warn",l<=30000);});if(l<=0&&r.master===uid)acts.close();},1000);
if(S.code)join(S.code).catch(()=>{});else render(true);
