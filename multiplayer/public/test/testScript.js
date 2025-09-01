// Test script to verify adventure card functionality
// Run this in browser console after loading scryfallCache.js

console.log('=== Adventure Card Test ===');

// Test 1: Load a full adventure card name
ScryfallCache.load(['Gumdrop Poisoner // Tempt with Treats']).then(() => {
    const card = ScryfallCache.get('Gumdrop Poisoner // Tempt with Treats');
    console.log('Test 1 - Full name:', card ? '✅ Success' : '❌ Failed');
    if (card) {
        console.log('  Name:', card.name);
        console.log('  Layout:', card.layout);
        console.log('  Is Adventure:', ScryfallCache.isAdventureCard('Gumdrop Poisoner // Tempt with Treats'));
        console.log('  Has Back Face:', ScryfallCache.hasBackFace('Gumdrop Poisoner // Tempt with Treats'));
    }
    
    // Test 2: Search by creature name
    return ScryfallCache.load(['Gumdrop Poisoner']);
}).then(() => {
    const card = ScryfallCache.get('Gumdrop Poisoner');
    console.log('Test 2 - Creature name:', card ? '✅ Success' : '❌ Failed');
    if (card) {
        console.log('  Found as:', card.name);
        console.log('  Creature part:', ScryfallCache.getCreatureName('Gumdrop Poisoner'));
        console.log('  Adventure part:', ScryfallCache.getAdventureSpellName('Gumdrop Poisoner'));
    }
    
    // Test 3: Search by adventure name
    return ScryfallCache.load(['Tempt with Treats']);
}).then(() => {
    const card = ScryfallCache.get('Tempt with Treats');
    console.log('Test 3 - Adventure name:', card ? '✅ Success' : '❌ Failed');
    if (card) {
        console.log('  Found as:', card.name);
        console.log('  Full name:', ScryfallCache.getFullCardName('Tempt with Treats'));
    }
    
    // Test 4: Back face handling
    const hasBack1 = ScryfallCache.hasBackFace('Gumdrop Poisoner');
    const hasBack2 = ScryfallCache.hasBackFace('Gumdrop Poisoner // Tempt with Treats');
    console.log('Test 4 - Back face (should be false for adventure cards):');
    console.log('  Gumdrop Poisoner:', hasBack1 ? '❌ Incorrectly has back' : '✅ Correctly no back');
    console.log('  Full name:', hasBack2 ? '❌ Incorrectly has back' : '✅ Correctly no back');
    
    console.log('=== Test Complete ===');
}).catch(error => {
    console.error('Test failed:', error);
});
