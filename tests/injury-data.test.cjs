const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {normalizeInjuryTeam,parseBigBallsInjuries}=load('src/lib/nhl/injuries.ts');

test('injury team aliases normalize to projection abbreviations',()=>{
  assert.equal(normalizeInjuryTeam('SJ'),'SJS');
  assert.equal(normalizeInjuryTeam('NJ'),'NJD');
  assert.equal(normalizeInjuryTeam('TB'),'TBL');
  assert.equal(normalizeInjuryTeam('MON'),'MTL');
  assert.equal(normalizeInjuryTeam('CLB'),'CBJ');
  assert.equal(normalizeInjuryTeam('LA'),'LAK');
  assert.equal(normalizeInjuryTeam('WAS'),'WSH');
});

test('Big Balls injury payload maps names, aliases and metadata',()=>{
  const rows=parseBigBallsInjuries({data:{injuries:[
    {player:{id:123,name:'Example Player',team:{abbreviation:'SJ'}},status:'out',injury_type:'upper body',return_date:'2026-10-10'},
    {player:{id:'456',name:'Second Player',team:{abbreviation:'NJ'}},status:'DTD',injury_type:null,return_date:null},
  ]}});
  assert.equal(rows.length,2);
  assert.deepEqual(rows[0],{
    id:'123',name:'Example Player',team:'SJS',status:'out',
    injuryType:'upper body',returnDate:'2026-10-10',
  });
  assert.equal(rows[1].team,'NJD');
});

test('missing injury array is invalid rather than a false successful empty list',()=>{
  assert.equal(parseBigBallsInjuries({data:{}}),null);
  assert.equal(parseBigBallsInjuries({}),null);
});

test('a real empty injury array remains valid',()=>{
  assert.deepEqual(parseBigBallsInjuries({data:{injuries:[]}}),[]);
});

test('malformed individual rows are skipped without invalidating valid rows',()=>{
  const rows=parseBigBallsInjuries({data:{injuries:[
    null,
    {player:{name:'',team:{abbreviation:'TB'}},status:'out'},
    {player:{name:'Valid Player',team:{abbreviation:'TB'}},status:''},
  ]}});
  assert.deepEqual(rows,[{
    id:'',name:'Valid Player',team:'TBL',status:'unknown',injuryType:null,returnDate:null,
  }]);
});
