/**
 * Test script to validate the Join Game UI separation
 */

// Test that JoinGameUI can be imported and instantiated
try {
    console.log('Testing JoinGameUI import and basic functionality...');
    
    // Mock socket for testing
    const mockSocket = {
        emit: (event, data) => console.log(`Socket emit: ${event}`, data),
        on: (event, handler) => console.log(`Socket listener registered: ${event}`)
    };
    
    // Mock commander modal for testing
    const mockCommanderModal = {
        setCallbacks: (callbacks) => console.log('Commander modal callbacks set'),
        show: (decklist, roomName, displayName) => console.log(`Commander modal shown with ${decklist.length} cards`)
    };
    
    // Test basic import (would fail during build if imports are broken)
    import('./lib/ui/joinGameUI.js').then(({ JoinGameUI }) => {
        console.log('✅ JoinGameUI import successful');
        
        // Test basic instantiation
        const joinGameUI = new JoinGameUI(mockSocket, mockCommanderModal);
        console.log('✅ JoinGameUI instantiation successful');
        
        // Test callback setup
        joinGameUI.setCallbacks({
            onGameJoined: (game, player) => console.log('Game joined callback triggered'),
            showMessage: (msg) => console.log('Message callback triggered:', msg)
        });
        console.log('✅ JoinGameUI callback setup successful');
        
        console.log('🎉 All JoinGameUI tests passed!');
    }).catch(error => {
        console.error('❌ JoinGameUI test failed:', error);
    });
    
} catch (error) {
    console.error('❌ JoinGameUI test failed:', error);
}