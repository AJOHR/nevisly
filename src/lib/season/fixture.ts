import {normalizeSeasonState, SKATER_CATEGORIES, type SeasonLeagueState, type SeasonPlayer} from './state';
/** Real drafted names only. All team eligibility, rates, ROS utilities, starts and matchup numbers below are illustrative manual inputs. */
const names:[string,string,string][]=[
 ['Nathan MacKinnon','COL','C'],['Martin Necas','COL','RW'],['Moritz Seider','DET','D'],['Tim Stutzle','OTT','C,LW'],
 ['Jakob Chychrun','WSH','D'],['J.T. Miller','NYR','C,LW,RW'],['Jackson LaCombe','ANA','D'],['Jet Greaves','CBJ','G'],
 ['Will Smith','SJS','LW,RW'],['Beckett Sennecke','ANA','RW'],['Mackenzie Blackwood','COL','G'],['Kiefer Sherwood','SJS','LW,RW'],
 ['Dougie Hamilton','NJD','D'],['Dylan Strome','WSH','C'],['Alexander Nikishin','CAR','D'],['Eeli Tolvanen','SEA','LW,RW']];
// Illustrative rates distinguish established scorers, peripherals and developing players.
// Values are mock inputs, not outputs of a second projection/scoring model.
const mockRates:[number,number,number,number,number,number,number][]=[
 [.5,.8,.4,4,.6,.4,5],[.35,.55,.25,3,.7,.4,3],[.12,.5,.2,2,2,2,3],
 [.35,.65,.3,2.5,1,.4,3],[.25,.35,.15,2.5,1,1.5,2],
 [.3,.55,.25,2,2,.6,2.5],[.12,.45,.15,1.8,1,1.8,1.5],[0,0,0,0,0,0,0],
 [.2,.3,.1,1.8,.5,.3,.8],[.2,.3,.1,2,1,.4,.8],[0,0,0,0,0,0,0],
 [.2,.2,.05,2,4,.5,1.2],[.2,.4,.2,2.8,.8,1.2,1.8],
 [.25,.55,.25,2,.4,.4,1.8],[.1,.25,.08,1.5,2,1.5,.8],[.2,.25,.08,2,1.5,.5,.7]
];
const roster:SeasonPlayer[]=names.map(([name,team,pos],i)=>{
 const [G,A,PPP,SOG,HIT,BLK,rosValue]=mockRates[i];
 return {id:`manual-${i}`,name,team,positions:pos.split(','),kind:pos==='G'?'goalie':'skater',
 usableGames:pos==='G'?undefined:i===15?1:2,rosValue:pos==='G'?undefined:rosValue,
 perGame:pos==='G'?undefined:{G,A,P:G+A,PPP,SOG,HIT,BLK}};
});
const remaining=Object.fromEntries(SKATER_CATEGORIES.map(c=>[c,roster.filter(p=>p.kind==='skater').reduce((sum,p)=>sum+p.perGame![c]!*p.usableGames!,0)]));
export const manualSeasonFixture:SeasonLeagueState=normalizeSeasonState({
 source:{kind:'manual',label:'Manual · mock matchup',asOf:null,notes:'Real Yzerplan drafted roster. Eligibility, projections, ROS utilities, weekly starts, opponent and free-agent ownership are mock examples—not live data or uploaded projections. No transactions are executed.'},
 week:1,leagueTeams:10,categories:['G','A','P','PPP','SOG','HIT','BLK','W','SV%','SO'],
 rosterSlots:{C:2,LW:2,RW:2,D:4,G:2,BN:4,'IR+':2},
 swingUnits:{G:2,A:3,P:5,PPP:2,SOG:10,HIT:10,BLK:6,W:1,'SV%':.005,SO:1},
 myTeam:{id:'yzerplan',name:'Yzerplan',roster,current:{G:8,A:14,P:22,PPP:5,SOG:80,HIT:45,BLK:30,W:1,'SV%':.911,SO:0},remaining},
 opponent:{id:'mock-opponent',name:'Example opponent',roster:[],current:{G:12,A:12,P:24,PPP:6,SOG:104,HIT:76,BLK:30,W:2,'SV%':.907,SO:0},remaining:{G:6,A:10,P:16,PPP:4,SOG:50,HIT:25,BLK:20}},
 freeAgents:[{id:'mock-wing',name:'Example checking winger',team:'DEMO',positions:['LW','RW'],kind:'skater',usableGames:3,rosValue:.6,perGame:{G:.15,A:.25,P:.4,PPP:.05,SOG:2,HIT:3,BLK:.6}},
 {id:'mock-center',name:'Example scoring center',team:'DEMO',positions:['C'],kind:'skater',usableGames:2,rosValue:1.8,perGame:{G:.3,A:.5,P:.8,PPP:.3,SOG:2.5,HIT:.3,BLK:.2}}]
});
