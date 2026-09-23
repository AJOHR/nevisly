const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {OFF_NIGHT_MAX_GAMES,isOffNightGameCount}=load('src/lib/draft/offNights.ts');

test('off night means eight or fewer NHL games league-wide',()=>{
 assert.equal(OFF_NIGHT_MAX_GAMES,8);
 for(const count of [0,1,4,8])assert.equal(isOffNightGameCount(count),true);
 for(const count of [9,10,16,NaN,Infinity,-1])assert.equal(isOffNightGameCount(count),false);
});
