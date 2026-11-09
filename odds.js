export const TYPES = {
  win:{n:"単勝",k:1,o:false}, place:{n:"複勝",k:1,o:false},
  quinella:{n:"馬連",k:2,o:false}, exacta:{n:"馬単",k:2,o:true}, wide:{n:"ワイド",k:2,o:false},
  trio:{n:"三連複",k:3,o:false}, trifecta:{n:"三連単",k:3,o:true}
};
export const key = (t, sel) => (TYPES[t].o ? sel : [...sel].sort((a,b)=>a-b)).join("-");

// 単勝オッズ → 勝率 → Harvilleモデルで各券種の確率 → オッズ(払戻率rate)
export function calcOdds(ent, rate) {
  const n = ent.length, inv = ent.map(e => 1/e.odds), s = inv.reduce((a,b)=>a+b,0), p = inv.map(x=>x/s);
  const m = {place:{},quinella:{},exacta:{},wide:{},trio:{},trifecta:{}};
  const add = (t,k,v) => { m[t][k] = (m[t][k]||0) + v; };
  const sk = (...x) => x.sort((a,b)=>a-b).join("-");
  for (let a=0;a<n;a++) for (let b=0;b<n;b++) { if (b===a) continue;
    for (let c=0;c<n;c++) { if (c===a||c===b) continue;
      const pr = p[a] * p[b]/(1-p[a]) * p[c]/(1-p[a]-p[b]);
      add("trifecta",`${a}-${b}-${c}`,pr); add("trio",sk(a,b,c),pr);
      add("place",a,pr); add("place",b,pr); add("place",c,pr);
      add("wide",sk(a,b),pr); add("wide",sk(a,c),pr); add("wide",sk(b,c),pr);
      add("exacta",`${a}-${b}`,pr); add("quinella",sk(a,b),pr);
    }
  }
  const out = {win:{}};
  ent.forEach((e,i)=> out.win[i] = e.odds);
  for (const t in m) { out[t] = {};
    for (const k in m[t]) out[t][k] = Math.max(1, Math.floor(rate/m[t][k]*10)/10);
  }
  return out;
}
