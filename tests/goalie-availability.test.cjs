const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {matchDraftPickToGoalie}=load('src/lib/draft/goalieAvailability.ts');

const goalies=[
 {id:'goalie:andreivasilevskiy',name:'Andrei Vasilevskiy',team:'TBL',gp:58,wins:36,svPct:.918,shutouts:5},
 {id:'goalie:igor-shesterkin',name:'Igor Shesterkin',team:'NYR',gp:57,wins:34,svPct:.915,shutouts:4},
];

test('Yahoo goalie is removed by unique name even when eligibility is missing',()=>{
 const pick={playerId:'local:test:pick:4',playerName:'Andrei Vasilevskiy',nhlTeam:'TB',positions:[],source:'yahoo',resolution:'unresolved',fantasyTeamId:'team-4',pickNumber:4};
 assert.equal(matchDraftPickToGoalie(pick,goalies)?.id,'goalie:andreivasilevskiy');
});

test('manual goalie direct id still matches',()=>{
 const pick={playerId:'goalie:andreivasilevskiy',playerName:'Andrei Vasilevskiy',positions:['G'],source:'manual',resolution:'goalie',fantasyTeamId:'team-1',pickNumber:1};
 assert.equal(matchDraftPickToGoalie(pick,goalies)?.id,'goalie:andreivasilevskiy');
});

test('unrelated skater pick does not remove a goalie',()=>{
 const pick={playerId:'projection:nathanmackinnon',playerName:'Nathan MacKinnon',positions:['C'],source:'yahoo',resolution:'matched',fantasyTeamId:'team-2',pickNumber:2};
 assert.equal(matchDraftPickToGoalie(pick,goalies),undefined);
});
