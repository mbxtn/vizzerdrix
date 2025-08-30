// testScryfallCache.js
const ScryfallCache = require('./scryfallCache.js');

async function test() {
    const testCards = ['Black Lotus', 'Lightning Bolt', 'Counterspell'];
    console.log('Loading cards:', testCards);
    await ScryfallCache.load(testCards);
    let allPassed = true;
    for (const name of testCards) {
        const card = ScryfallCache.get(name);
        if (card && card.name === name) {
            console.log(`PASS: ${name} loaded. Scryfall ID: ${card.id}`);
        } else {
            console.log(`FAIL: ${name} not loaded.`);
            allPassed = false;
        }
    }
    if (allPassed) {
        console.log('All tests passed!');
    } else {
        console.log('Some tests failed.');
    }
}

test();
