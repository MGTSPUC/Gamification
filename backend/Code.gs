/* ClassUp production backend. Student data never leaves this service unauthenticated. */
const CU_DB = '1bJ_DATABASE_ID';
const CU_SOURCE = 'MARKBOOK_ID';
const CU_RANKS = ['Bronze','Silver','Gold','Platinum','Diamond','Supreme'];
const CU_DEFAULT = {skin:1,hair:0,hairColor:0,shirt:0,glasses:0,outfit:0,tie:0,head:0,wings:0};
const CU_LIMITS = {skin:8,hair:4,hairColor:5,shirt:5,glasses:5,outfit:3,tie:3,head:4,wings:3};
const CU_GATES = {skin:[0,0,0,0,0,0,2,3],glasses:[0,0,0,1,4],head:[0,1,3,5],wings:[0,4,5]};
function doGet() { return HtmlService.createHtmlOutput(CU_HTML_).setTitle('ClassUp').addMetaTag('viewport','width=device-width,initial-scale=1,viewport-fit=cover'); }
// Only this dispatcher is exposed to the HTML Service client.
function classupApi(request) {
  try {
    if (!request || typeof request !== 'object' || JSON.stringify(request).length > 5000) fail_('BAD_REQUEST');
    const action = request.action;
    if (action === 'login') return {ok:true,data:login_(request)};
    if (!['snapshot','saveProfile','logout'].includes(action)) fail_('BAD_REQUEST');
    const session = session_(request.token);
    if (action === 'logout') { CacheService.getScriptCache().remove('session:'+hash_(request.token)); return {ok:true,data:{loggedOut:true}}; }
    const db = readDb_();
    if (!db.accounts.has(session.studentId) || !equal_(session.fingerprint, fingerprint_(db.accounts.get(session.studentId)))) fail_('SESSION_EXPIRED');
    if (action === 'snapshot') return {ok:true,data:snapshot_(session.studentId,db)};
    if (action === 'saveProfile') return {ok:true,data:saveProfile_(session.studentId,request.profile,db)};
  } catch(e) {
    const known = ['BAD_REQUEST','INVALID_LOGIN','RATE_LIMIT','SESSION_EXPIRED','NO_ENROLLMENT','DATA_UNAVAILABLE','LOCKED_ITEM','INVALID_PROFILE','BUSY'];
    return {ok:false,error:known.includes(e.message)?e.message:'DATA_UNAVAILABLE'};
  }
}
function fail_(code) { throw new Error(code); }
function props_(){return PropertiesService.getScriptProperties()}
function secret_(){let s=props_().getProperty('CU_SECRET');if(!s){s=Utilities.getUuid()+Utilities.getUuid();props_().setProperty('CU_SECRET',s)}return s}
function hash_(s){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s))).replace(/=+$/,'')}
function hmac_(s){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(s),secret_())).replace(/=+$/,'')}
function equal_(a,b){a=String(a);b=String(b);let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
function text_(v){return String(v==null?'':v).trim()}
function number_(v){if(v===''||v==null)return null;const n=Number(v);if(!Number.isFinite(n))fail_('DATA_UNAVAILABLE');return n}
function locked_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(10000))fail_('BUSY');try{return fn()}finally{lock.releaseLock()}}
function rate_(user){
  // Fixed bucket count prevents unbounded property growth from invented usernames.
  const bucket=hash_(user).split('').reduce((a,c)=>(a*31+c.charCodeAt(0))%256,0);
  const now=Date.now(),p=props_();
  for(const [key,max,windowMs] of [['CU_RATE_GLOBAL',120,60000],['CU_RATE_'+bucket,8,900000]]){
    let r=JSON.parse(p.getProperty(key)||'null');if(!r||now>=r.until)r={n:0,until:now+windowMs};
    if(r.n>=max)fail_('RATE_LIMIT');r.n++;p.setProperty(key,JSON.stringify(r));
  }
}
function readDb_(){
  const sh=SpreadsheetApp.openById(CU_DB).getSheetByName('แสดงผล');if(!sh||sh.getLastRow()<2)fail_('DATA_UNAVAILABLE');
  const n=sh.getLastRow()-1;if(n>10000)fail_('DATA_UNAVAILABLE');
  const display=sh.getRange(2,1,n,8).getDisplayValues();
  const accounts=new Map(),ambiguous=new Set();
  display.forEach(r=>{const id=text_(r[0]),user=text_(r[4]),password=String(r[5]||'');if(!id||!user||!password)return;
    const a={studentId:id,user,password};const old=accounts.get(id);
    if(old&&(old.user!==user||old.password!==password))ambiguous.add(id);else accounts.set(id,a);
  });ambiguous.forEach(id=>accounts.delete(id));
  // Read scores from the original mark book, avoiding IMPORTRANGE propagation delay.
  const source=SpreadsheetApp.openById(CU_SOURCE).getSheetByName('รวม');if(!source||source.getLastRow()<2)fail_('DATA_UNAVAILABLE');
  const raw=source.getRange(2,1,source.getLastRow()-1,45).getValues(),seen=new Set(),rows=[];
  raw.forEach(r=>{const id=text_(r[3]),course=text_(r[1]),group=text_(r[2]);if(!id||!course||!group)return;
    const key=JSON.stringify([id,course,group]);if(seen.has(key))fail_('DATA_UNAVAILABLE');seen.add(key);
    const total=number_(r[40]);if(total===null)fail_('DATA_UNAVAILABLE');
    rows.push({studentId:id,code:course,group,score:total,extra:number_(r[41]),net:number_(r[42]),parts:[number_(r[21]),number_(r[35]),r[36]===''||r[36]==null?null:number_(r[37]),number_(r[38]),number_(r[39])]});
  });
  if(!rows.length)fail_('DATA_UNAVAILABLE');return {accounts,rows};
}
function fingerprint_(a){return hmac_(JSON.stringify([a.studentId,a.user,a.password]))}
function login_(r){
  if(typeof r.username!=='string'||typeof r.password!=='string'||r.username.length>100||r.password.length>256)fail_('INVALID_LOGIN');
  const user=r.username.trim();if(!user||!r.password)fail_('INVALID_LOGIN');
  return locked_(()=>{
    secret_();rate_(user);const db=readDb_();
    const matches=[...db.accounts.values()].filter(a=>a.user===user||a.studentId===user);
    if(matches.length!==1||!equal_(hmac_(r.password),hmac_(matches[0].password)))fail_('INVALID_LOGIN');
    const a=matches[0],data=snapshot_(a.studentId,db);
    const token=Utilities.getUuid()+Utilities.getUuid(),expiresAt=Date.now()+3600000;
    CacheService.getScriptCache().put('session:'+hash_(token),JSON.stringify({studentId:a.studentId,fingerprint:fingerprint_(a),expiresAt}),3600);
    return {token,expiresAt,...data};
  });
}
function session_(token){if(typeof token!=='string'||!/^[a-f0-9-]{72}$/.test(token))fail_('SESSION_EXPIRED');const raw=CacheService.getScriptCache().get('session:'+hash_(token));if(!raw)fail_('SESSION_EXPIRED');const s=JSON.parse(raw);if(Date.now()>=s.expiresAt)fail_('SESSION_EXPIRED');return s}
function percentile_(a,p){const pos=(a.length-1)*p,low=Math.floor(pos);return a[low]+(a[Math.ceil(pos)]-a[low])*(pos-low)}
function ranked_(rows){const sorted=rows.slice().sort((a,b)=>b.score-a.score||a.studentId.localeCompare(b.studentId));const asc=sorted.map(r=>r.score).reverse();const cuts=[.2,.4,.6,.8].map(p=>percentile_(asc,p));let position=0,last=null;
  const top=sorted[Math.min(4,sorted.length-1)].score;
  return {cuts,top,rows:sorted.map((r,i)=>{if(last!==r.score)position=i+1;last=r.score;return {...r,position,rank:r.score>=top?'Supreme':CU_RANKS[cuts.filter(v=>r.score>v).length]}})};
}
function profile_(id){let p={};try{p=JSON.parse(props_().getProperty('CU_PROFILE_'+hash_(id))||'{}')}catch(e){}return {nickname:typeof p.nickname==='string'?p.nickname:'ผู้เรียน '+hmac_(id).slice(0,6),avatar:p.avatar||{...CU_DEFAULT},goal:[0,1,2].includes(p.goal)?p.goal:null,customized:!!p.customized}}
function cleanAvatar_(a,level,strict){const out={...CU_DEFAULT};for(const k of Object.keys(CU_LIMITS)){const v=a&&a[k];if(!Number.isInteger(v)||v<0||v>=CU_LIMITS[k]){if(strict)fail_('INVALID_PROFILE');continue}if(CU_GATES[k]&&CU_GATES[k][v]>level){if(strict)fail_('LOCKED_ITEM');continue}out[k]=v}return out}
function enrollmentGroups_(id,db){return [...new Set(db.rows.filter(r=>r.studentId===id).map(r=>JSON.stringify([r.code,r.group])))].map(key=>{const [code,group]=JSON.parse(key);return {code,group,...ranked_(db.rows.filter(r=>r.code===code&&r.group===group))}})}
function level_(id,db){const groups=enrollmentGroups_(id,db);if(!groups.length)fail_('NO_ENROLLMENT');return Math.max(...groups.map(g=>CU_RANKS.indexOf(g.rows.find(r=>r.studentId===id).rank)))}
function snapshot_(id,db){
  const groups=enrollmentGroups_(id,db);if(!groups.length)fail_('NO_ENROLLMENT');const level=level_(id,db),profile=profile_(id);profile.avatar=cleanAvatar_(profile.avatar,level,false);
  const enrollments=groups.map(g=>{const mine=g.rows.find(r=>r.studentId===id),ri=CU_RANKS.indexOf(mine.rank),nextRank=CU_RANKS[ri+1]||null,nextScore=nextRank==='Supreme'?g.top:nextRank?g.cuts[ri]+.01:mine.score;
    return {c:{code:g.code,group:g.group,size:g.rows.length,max:100},you:{position:mine.position,score:mine.score,rank:mine.rank},parts:mine.parts,extra:mine.extra,net:mine.net,nextRank,nextScore,difference:Math.max(0,nextScore-mine.score),supremeCount:g.rows.filter(r=>r.rank==='Supreme').length,
      rows:g.rows.map(r=>{const p=r.studentId===id?profile:profile_(r.studentId);return {name:p.nickname,position:r.position,rank:r.rank,isYou:r.studentId===id,av:cleanAvatar_(p.avatar,level_(r.studentId,db),false)}})};
  });return {profile,level,enrollments,updatedAt:new Date().toISOString()};
}
function saveProfile_(id,p,db){
  if(!p||typeof p!=='object'||typeof p.nickname!=='string'||!p.nickname.trim()||[...p.nickname.trim()].length>20||/[<>\u0000-\u001f]/.test(p.nickname))fail_('INVALID_PROFILE');
  if(p.goal!==null&&![0,1,2].includes(p.goal))fail_('INVALID_PROFILE');
  const avatar=cleanAvatar_(p.avatar,level_(id,db),true);
  return locked_(()=>{const profile={nickname:p.nickname.trim(),avatar,goal:p.goal,customized:true};props_().setProperty('CU_PROFILE_'+hash_(id),JSON.stringify(profile));return snapshot_(id,db)});
}
// Editor-only diagnostics, never available to google.script.run because of trailing underscore.
function inspectConnection_(){const db=readDb_();const result={accounts:db.accounts.size,enrollments:db.rows.length,groups:new Set(db.rows.map(r=>r.code+'|'+r.group)).size};console.log(JSON.stringify(result));return result}
