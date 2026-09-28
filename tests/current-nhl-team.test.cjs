const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {resolveCurrentNhlTeam}=load('src/lib/projections/identity.ts');

test('confirmed Sep 28 trade overrides stale projection teams',()=>{
  assert.equal(resolveCurrentNhlTeam('Kirill Marchenko','CBJ'),'TOR');
  assert.equal(resolveCurrentNhlTeam('Matthew Knies','TOR'),'CBJ');
});

test('players without a confirmed override keep their provider team',()=>{
  assert.equal(resolveCurrentNhlTeam('Cale Makar','col'),'COL');
});
