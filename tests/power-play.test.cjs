const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {
  parseDailyFaceoffPowerPlayPage,
  powerPlayKey,
  normalizePowerPlayTeam,
}=load('src/lib/nhl/powerPlay.ts');
const {
  powerPlaySnapshotTeam,
  POWER_PLAY_SNAPSHOT_TEAMS,
}=load('src/data/powerPlaySnapshot.ts');

const html=`
<html><body>
<div>Last updated: 2026-09-17T20:06:15.055Z</div>
<h3><span>1st</span> <strong>Powerplay</strong> Unit</h3>
<a href="/player/jake-debrusk"><span>Jake DeBrusk</span></a>
<a href="/player/marco-rossi"><span>Marco Rossi</span></a>
<a href="/player/brock-boeser"><span>Brock Boeser</span></a>
<a href="/player/zeev-buium"><span>Zeev Buium</span></a>
<a href="/player/elias-pettersson"><span>Elias Pettersson</span></a>
<div>Click player jersey for news, stats and more!</div>
<h3><span>2nd</span> Power<span>play</span> Unit</h3>
<a href="/player/liam-ohgren">Liam Ohgren</a>
<a href="/player/filip-chytil">Filip Chytil</a>
<a href="/player/linus-karlsson">Linus Karlsson</a>
<a href="/player/jonathan-lekkerimaki">Jonathan Lekkerimaki</a>
<a href="/player/filip-hronek">Filip Hronek</a>
<h3><span>1st</span> Penalty <strong>Kill</strong> Unit</h3>
</body></html>`;

test('Daily Faceoff parser returns PP1, PP2 and freshness through nested markup',()=>{
  const result=parseDailyFaceoffPowerPlayPage(html,'VAN','vancouver-canucks');
  assert.equal(result.status,'ok');
  assert.equal(result.reason,undefined);
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
  assert.equal(result.reason,'no-pp-data-parsed');
  assert.deepEqual(result.players,[]);
});


test('verified PP snapshot covers all 32 teams with ten assignments each',()=>{
  assert.equal(POWER_PLAY_SNAPSHOT_TEAMS.length,32);
  for(const team of POWER_PLAY_SNAPSHOT_TEAMS){
    const result=powerPlaySnapshotTeam(team);
    assert.equal(result.status,'ok',team);
    assert.equal(result.players.length,10,team);
    assert.equal(result.players.filter(p=>p.unit==='PP1').length,5,team);
    assert.equal(result.players.filter(p=>p.unit==='PP2').length,5,team);
    assert.ok(result.players.every(p=>p.delivery==='snapshot'),team);
  }
});

test('snapshot includes obvious current PP1 anchors used for acceptance',()=>{
  const col=powerPlaySnapshotTeam('COL');
  const edm=powerPlaySnapshotTeam('EDM');
  const tbl=powerPlaySnapshotTeam('TBL');
  assert.equal(col.players.find(p=>p.name==='Nathan MacKinnon')?.unit,'PP1');
  assert.equal(col.players.find(p=>p.name==='Cale Makar')?.unit,'PP1');
  assert.equal(edm.players.find(p=>p.name==='Connor McDavid')?.unit,'PP1');
  assert.equal(tbl.players.find(p=>p.name==='Nikita Kucherov')?.unit,'PP1');
});
