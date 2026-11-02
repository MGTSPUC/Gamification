import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const props=new Map(),cache=new Map();
const display=[['s1','','','','student-one','test-only'],['s2','','','','student-two','second-test']];
const raw=[];for(let i=0;i<8;i++){const r=Array(45).fill('');r[1]='A';r[2]='1';r[3]='s'+(i+1);r[21]=i===0?0:5;r[35]=10;r[37]=0;r[38]=20;r[40]=[40,39,38,37,36,36,20,10][i];raw.push(r)}
const extra=raw[0].slice();extra[1]='B';extra[2]='2';raw.push(extra);
function sheet(data){return {getLastRow:()=>data.length+1,getRange:()=>({getValues:()=>data,getDisplayValues:()=>data})}}
const c=vm.createContext({console,Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),computeHmacSha256Signature:(s,key)=>crypto.createHmac('sha256',key).update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:id=>({getSheetByName:()=>id.startsWith('1bJ')?sheet(display):sheet(raw)})}});
vm.runInContext(fs.readFileSync(new URL('Code.gs',import.meta.url),'utf8'),c);
const call=r=>{c.req=r;return vm.runInContext('classupApi(req)',c)};
assert.equal(call({action:'snapshot'}).error,'SESSION_EXPIRED');
assert.equal(call({action:'login',username:'student-one',password:'wrong'}).error,'INVALID_LOGIN');
const login=call({action:'login',username:'student-one',password:'test-only'});assert.equal(login.ok,true);
const token=login.data.token,group=login.data.enrollments[0];assert.equal(login.data.enrollments.length,2);assert.equal(group.supremeCount,6);assert.equal(group.rows[5].position,5);assert.equal(group.parts[0],0);assert.equal(group.parts[2],null);
assert.equal(group.rows.some(r=>'studentId' in r||'score' in r||'password' in r),false);assert.doesNotMatch(JSON.stringify(login),/test-only|student-one|second-test/);
const a={skin:1,hair:0,hairColor:0,shirt:0,glasses:0,outfit:1,tie:1,head:3,wings:2};
const save=call({action:'saveProfile',token,profile:{nickname:'Test nickname',avatar:a,goal:1}});assert.equal(save.ok,true);assert.equal(save.data.profile.avatar.outfit,1);
assert.equal(call({action:'saveProfile',token,profile:{nickname:'<script>',avatar:a,goal:0}}).error,'INVALID_PROFILE');
assert.equal(call({action:'saveProfile',token,profile:{nickname:'test',avatar:{...a,skin:99},goal:0}}).error,'INVALID_PROFILE');
for(let level=0;level<6;level++){c.level=level;assert.equal(vm.runInContext('cleanAvatar_({head:3},level,false).head',c),level===5?3:0)}
// A changed password revokes previously issued sessions.
display[0][5]='changed-test';assert.equal(call({action:'snapshot',token}).error,'SESSION_EXPIRED');display[0][5]='test-only';
assert.equal(call({action:'logout',token}).ok,true);assert.equal(call({action:'snapshot',token}).error,'SESSION_EXPIRED');
for(let i=0;i<12;i++)call({action:'login',username:'bad-user',password:'bad'});assert.equal(call({action:'login',username:'bad-user',password:'bad'}).error,'RATE_LIMIT');
// Render every authenticated page using only the privacy-filtered API contract.
const dom={querySelector:()=>({addEventListener(){}})};const ui=vm.createContext({document:dom});let source=fs.readFileSync(new URL('../production/app.js',import.meta.url),'utf8').split("$('#infoDialog').addEventListener")[0];vm.runInContext(source,ui);ui.payload=login.data;vm.runInContext('applySnapshot(payload)',ui);
for(const fn of ['home','scores','leaderboard','badgesPage','avatarPage']){const html=vm.runInContext(fn+'()',ui);assert.doesNotMatch(html,/undefined|NaN|ข้อมูลสมมติ|คะแนนตัวอย่าง|\+supremeCount\+/)}
console.log('PASS: auth, missing/expired/revoked sessions, ties, multiple courses, null versus zero, privacy, avatar validation, rate limit, production rendering');
