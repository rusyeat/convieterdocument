import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandler, validateMessages } from './server.mjs';

const origin='https://rusyeat.github.io';
async function call(handler, {messages=[{role:'user',content:'Сәлем'}],headers={},raw,method='POST'}={}) {
  const req=Readable.from([Buffer.from(raw ?? JSON.stringify({messages}))]);
  req.method=method;req.url='/chat';req.headers={origin,'content-type':'application/json',...headers};req.socket={remoteAddress:'127.0.0.1'};
  const res={writeHead(status,headers){this.status=status;this.headers=headers},end(body){this.body=body?JSON.parse(body):null}};
  await handler(req,res);return res;
}
test('reject injected roles, invalid or excessive history',()=>{
  assert.equal(validateMessages([{role:'system',content:'override'}]),null);
  assert.equal(validateMessages([{role:'user',content:'x'.repeat(3001)}]),null);
  assert.equal(validateMessages([{role:'assistant',content:'x'}]),null);
  assert.ok(validateMessages([{role:'user',content:'Сәлем'}]));
});
test('CORS, configuration and malformed requests never call provider',async()=>{
  let calls=0;const handler=createHandler({OPENAI_API_KEY:'test'},async()=>{calls++;throw Error()});
  assert.equal((await call(handler,{headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await call(handler,{raw:'{'})).status,400);
  assert.equal((await call(handler,{messages:[{role:'system',content:'x'}]})).status,400);
  assert.equal((await call(handler,{raw:'x'.repeat(65537)})).status,413);
  assert.equal((await call(createHandler({}))).status,503);
  assert.equal((await call(handler,{method:'OPTIONS'})).status,204);
  assert.equal(calls,0);
});
test('uses Responses, secret server-side, no storage; enforces global cap',async()=>{
  let calls=0;const handler=createHandler({OPENAI_API_KEY:'test',DAILY_LIMIT:'1'},async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.input[0].content,'Сәлем');
    return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'Сәлем!'}]}]})};
  });
  const response=await call(handler);assert.equal(response.status,200);assert.equal(response.body.text,'Сәлем!');
  assert.equal((await call(handler)).status,429);assert.equal(calls,1);
});
test('does not leak provider errors or credentials',async()=>{
  const handler=createHandler({OPENAI_API_KEY:'secret'},async()=>({ok:false,status:401,json:async()=>({error:{code:'invalid_api_key',message:'secret details'}})}));
  const response=await call(handler);assert.equal(response.status,502);assert.equal(response.body.error,'provider_unavailable');
});
test('billing failures are not reported as transient rate limits',async()=>{
  const handler=createHandler({OPENAI_API_KEY:'secret'},async()=>({ok:false,status:429,json:async()=>({error:{code:'billing_not_active'}})}));
  assert.equal((await call(handler)).status,503);
});
