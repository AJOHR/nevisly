const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {
  parseDailyFaceoffPowerPlayPage,
  powerPlayKey,
  normalizePowerPlayTeam,
}=load('src/lib/nhl/powerPlay.ts');

const html=`
<html><body>
<div>Last updated: 2026-09-17T20:06:15.055Z</div>
<h3>1st Powerplay Unit</h3>
<a><span>Jake DeBrusk</span></a>
<a><span>Marco Rossi</span></a>
<a><span>Brock Boeser</span></a>
<a><span>Zeev Buium</span></a>
<a><span>Elias Pettersson</span></a>
<div>Click player jersey for news, stats and more!</div>
<h3>2nd Powerplay Unit</h3>
<a>Liam Ohgren</a><a>Filip Chytil</a><a>Linus Karlsson</a><a>Jonathan Lekkerimaki</a><a>Filip Hronek</a>
<h3>1st Penalty Kill Unit</h3>
</body></html>`;

test('Daily Faceoff parser returns PP1, PP2 and source freshness',()=>{
  const result=parseDailyFaceoffPowerPlayPage(html,'VAN','vancouver-canucks');
  assert.equal(result.status,'ok');
  assert.equal(result.updatedAt,'2026-09-17T20:06:15.055Z');
  assert.equal(result.players.length,10);
  assert.deepEqual(result.players.slice(0,2).map(p=>[p.name,p.unit]),[
    ['Jake DeBrusk','PP1'],
    ['Marco Rossi','PP1'],
  ]);
  assert.equal(result.players[9].unit,'PP2');
  assert.ok(result.players.every(p=>p.source==='Daily Faceoff'));
});

test('PP matching normalizes accents, punctuation and common team aliases',()=>{
  assert.equal(powerPlayKey("Ryan O'Reilly",'NSH'),powerPlayKey('Ryan O’Reilly','NSH'));
  assert.equal(normalizePowerPlayTeam('SJ'),'SJS');
  assert.equal(normalizePowerPlayTeam('TB'),'TBL');
  assert.equal(normalizePowerPlayTeam('Utah'),'UTA');
});

test('missing power-play sections degrade to unknown without guessing',()=>{
  const result=parseDailyFaceoffPowerPlayPage('<html>No unit data</html>','BOS','boston-bruins');
  assert.equal(result.status,'unknown');
  assert.deepEqual(result.players,[]);
});
