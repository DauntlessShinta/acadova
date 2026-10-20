import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('local free application uses normal frontend origin and only the isolated API, without project env files',()=>{
  const source=fs.readFileSync(new URL('../vite.local-free.config.js',import.meta.url),'utf8')
    .replace(/^import .*;\r?$/gm,'').replace('export default defineConfig','globalThis.config=defineConfig');
  const context=vm.createContext({defineConfig:value=>value,react:()=>({}),tmpdir:()=>'/synthetic-temp'});
  vm.runInContext(source,context);
  const config=context.config;
  assert.equal(config.server.host,'localhost');assert.equal(config.server.port,5173);assert.equal(config.server.strictPort,true);
  assert.equal(config.server.proxy['/api'].target,'http://127.0.0.1:5004');assert.equal(config.envDir,'/synthetic-temp');
  for(const name of ['VITE_API_URL','VITE_ONESIGNAL_APP_ID','VITE_GOOGLE_CLIENT_ID'])assert.equal(config.define['import.meta.env.'+name],"''");
});

import { getSessionEconomyLabel } from '../src/utils/sessionPresentation.js';
test('free sessions stay free while legacy mode retains actual charges',()=>{
  assert.equal(getSessionEconomyLabel({economyVersion:'free-v1',creditAmount:0},true),'Free peer tutoring');
  assert.equal(getSessionEconomyLabel({creditAmount:20},false),'20 credits');
  assert.equal(getSessionEconomyLabel({creditAmount:1},false),'1 credit');
});
test('retired student economy distinguishes paid, reconciled and frozen historical records',()=>{
  assert.equal(getSessionEconomyLabel({creditAmount:20,settlementState:'settled'},true),'Historical paid session');
  assert.equal(getSessionEconomyLabel({creditAmount:20,settlementState:'resolved_no_transfer'},true),'Historical obligation resolved');
  assert.equal(getSessionEconomyLabel({creditAmount:20,settlementState:'not_applicable'},true),'Historical session');
  // A timestamp alone must not override contradictory server classification.
  assert.equal(getSessionEconomyLabel({creditAmount:20,creditsSettledAt:'2026-10-19',settlementState:'inconsistent'},true),'Historical obligation (frozen)');
});
