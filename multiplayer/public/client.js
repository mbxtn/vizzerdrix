import ScryfallCache from './scryfallCache.js';
import { createCardElement } from './cardFactory.js';
import { CardZone } from './cardZone.js';

const socket = io();
let room = null;
let playerId = null;
let gameState = null;
let activePlayZonePlayerId = null;
let isMagnifyEnabled = false; // New state variable for magnify on hover

// UI Elements
const magnifyToggleBtn = document.getElementById('magnify-toggle-btn');
const magnifyStatusEl = document.getElementById('magnify-status');
const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-input');
const displayNameInput = document.getElementById('display-name-input');
const decklistInput = document.getElementById('decklist-input');
const joinUI = document.getElementById('join-ui');
const gameUI = document.getElementById('game-ui');
const playZonesContainer = document.getElementById('play-zones-container');
const playerTabsContainer = document.getElementById('player-tabs-container');
const handZoneEl = document.getElementById('hand-zone');
const libraryEl = document.getElementById('library');
const graveyardPileEl = document.getElementById('graveyard-pile');
const exilePileEl = document.getElementById('exile-pile');
const commandPileEl = document.getElementById('command-pile');
const libraryCountEl = document.getElementById('library-count');
const discardCountEl = document.getElementById('graveyard-count');
const exileCountEl = document.getElementById('exile-count');
const commandCountEl = document.getElementById('command-count');
const messageModal = document.getElementById('message-modal');
const messageText = document.getElementById('message-text');
const closeModalBtn = document.getElementById('close-modal-btn');
const optionsBtn = document.getElementById('options-btn'); // Options button reference                                                                         │
const optionsModal = document.getElementById('options-modal'); // Options modal reference                                                                   │
const resetBtnModal = document.getElementById('reset-btn-modal'); // New reset button reference           
const pickTurnOrderBtn = document.getElementById('pick-turn-order-btn'); // Turn order button reference
const endTurnBtn = document.getElementById('end-turn-btn'); // End turn button reference
const turnIndicator = document.getElementById('turn-indicator'); // Turn indicator reference
const currentPlayerNameEl = document.getElementById('current-player-name'); // Current player name element
const playerTabsEl = document.getElementById('player-tabs'); // Player tabs container
const increaseSizeBtn = document.getElementById('increase-size-btn'); // Card size controls
const decreaseSizeBtn = document.getElementById('decrease-size-btn');


// Selection state
let selectedCards = [];
let selectedCardIds = [];
let isSelecting = false;
let selectionBox = null;
let startX = 0;
let startY = 0;
let justSelectedByDrag = false;

let cascadedHandCardsInAreaCount = 0;
const CASCADE_AREA_MAX_X = 300; // Example: Define the max X for the initial cascade area
const CASCADE_AREA_MAX_Y = 300; // Example: Define the max Y for the initial cascade area

// Context menu state
let cardContextMenu = null;
let contextMenuJustShown = false;

// Card Zone instances
let libraryZone = null;
let graveyardZone = null;
let exileZone = null;
let commandZone = null;

// Render debouncing
let renderTimeout = null;
let isRendering = false;

// Debounced render function to prevent excessive re-renders
function debouncedRender() {
    if (renderTimeout) {
        clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(render, 16); // ~60fps max
}

// Socket.IO event handlers
joinBtn.addEventListener('click', () => {
    const roomName = roomInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const decklistRaw = decklistInput.value.trim();
    // Parse decklist into array of card names, respecting counts
    const decklist = [];
    decklistRaw.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            // Parse count and card name, e.g. "2 Arcane Signet" or "1x Arcane Signet" or "Arcane Signet"
            const countMatch = line.match(/^(\d+)\s*x?\s*(.+)$/);
            if (countMatch) {
                const count = parseInt(countMatch[1]);
                const cardName = countMatch[2].replace(/\s+\(.+\)$/, '').trim(); // Remove set codes like "(M21)"
                // Add the specified number of copies
                for (let i = 0; i < count; i++) {
                    decklist.push(cardName);
                }
            } else {
                // No count specified, assume 1 copy
                const cardName = line.replace(/\s+\(.+\)$/, '').trim(); // Remove set codes like "(M21)"
                decklist.push(cardName);
            }
        });
    if (roomName && decklist.length > 0) {
        socket.emit('join', { roomName, displayName, decklist });
    }
});

socket.on('connect', () => {
    playerId = socket.id;
    activePlayZonePlayerId = socket.id;
    console.log('Client connected. Player ID:', playerId);
});

socket.on('state', async (state) => {
    console.log('RAW STATE RECEIVED:', new Date().toISOString(), {
        currentTurn: state.currentTurn,
        turnOrderSet: state.turnOrderSet,
        turnOrder: state.turnOrder
    });
    
    // Check if state has actually changed
    const stateChanged = !gameState || JSON.stringify(gameState) !== JSON.stringify(state);
    
    // Check for turn order changes before updating gameState
    const turnOrderChanged = !gameState || 
        gameState.currentTurn !== state.currentTurn ||
        gameState.turnOrderSet !== state.turnOrderSet ||
        JSON.stringify(gameState.turnOrder) !== JSON.stringify(state.turnOrder);
    
    console.log('Received state update:', {
        turnOrderSet: state.turnOrderSet,
        turnOrder: state.turnOrder,
        currentTurn: state.currentTurn,
        stateChanged,
        turnOrderChanged,
        timestamp: new Date().toISOString()
    });
    
    // Log the full turn order state if it exists
    if (state.turnOrderSet && state.turnOrder) {
        console.log('Full turn order state:', {
            players: state.turnOrder.map((pid, index) => ({
                index,
                playerId: pid,
                displayName: state.players[pid]?.displayName,
                isCurrentTurn: index === state.currentTurn
            }))
        });
    }
    
    gameState = state;
    if (!activePlayZonePlayerId || !gameState.players[activePlayZonePlayerId]) {
        activePlayZonePlayerId = playerId;
    }
    joinUI.style.display = 'none';
    gameUI.style.display = '';
    
    // Load Scryfall images for all visible cards across all players and zones
    const allCardNames = new Set();
    
    // Collect cards from all players' zones
    Object.values(gameState.players).forEach(player => {
        // Decklist (for newly joining players or unused cards)
        if (player.decklist && Array.isArray(player.decklist)) {
            player.decklist.forEach(cardName => {
                if (typeof cardName === 'string') {
                    allCardNames.add(cardName);
                } else if (cardName && cardName.name) {
                    allCardNames.add(cardName.name);
                }
            });
        }
        
        // Hand cards
        if (player.hand && Array.isArray(player.hand)) {
            player.hand.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Library cards  
        if (player.library && Array.isArray(player.library)) {
            player.library.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Graveyard cards
        if (player.graveyard && Array.isArray(player.graveyard)) {
            player.graveyard.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Exile cards
        if (player.exile && Array.isArray(player.exile)) {
            player.exile.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
        
        // Command cards
        if (player.command && Array.isArray(player.command)) {
            player.command.forEach(cardItem => {
                if (typeof cardItem === 'string') {
                    allCardNames.add(cardItem);
                } else if (cardItem && cardItem.name) {
                    allCardNames.add(cardItem.name);
                }
            });
        }
    });
    
    // Collect cards from all play zones
    if (gameState.playZones) {
        Object.values(gameState.playZones).forEach(playZoneCards => {
            if (Array.isArray(playZoneCards)) {
                playZoneCards.forEach(cardData => {
                    if (cardData && cardData.name) {
                        allCardNames.add(cardData.name);
                    }
                });
            }
        });
    }
    
    if (allCardNames.size > 0) {
        console.log(`Loading images for ${allCardNames.size} unique cards from all zones`);
        await ScryfallCache.load(Array.from(allCardNames));
        console.log('Finished loading card images');
    }
    
    // Only render if state actually changed, or if this is a turn order update
    // TEMPORARY: Force render on any state update to debug
    console.log('Forcing render for debugging');
    debouncedRender();
    updateCascadedHandCardsInAreaCount(); // Call it here to update after server state
});

closeModalBtn.addEventListener('click', () => {
    messageModal.classList.add('hidden');
});

optionsBtn.addEventListener('click', () => {
    optionsModal.classList.remove('hidden');
});

document.getElementById('close-options-btn').addEventListener('click', () => {
    optionsModal.classList.add('hidden');
});

resetBtnModal.addEventListener('click', () => {
    // Collect all cards from hand, playZone, and graveyard
    let allCards = [];

    // Add cards from hand (these are already card objects)
    allCards.push(...hand);
    hand.length = 0; // Clear hand

    // Add cards from playZone - convert back to basic card objects
    // playZone stores objects {name, x, y, rotation, fromHandCascade, id, displayName, ...}
    playZone.forEach(card => {
        // Create a clean card object for library storage
        allCards.push({
            id: card.id,
            name: card.name,
            displayName: card.displayName || card.name,
            // Remove position and game-specific properties
        });
    });
    playZone.length = 0; // Clear playZone

    // Add cards from graveyard (these are already card objects)
    allCards.push(...graveyard);
    graveyard.length = 0; // Clear graveyard
    
    // Add cards from exile (these are already card objects)
    allCards.push(...exile);
    exile.length = 0; // Clear exile
    
    // Add cards from command zone (these are already card objects)
    allCards.push(...command);
    command.length = 0; // Clear command zone

    // Shuffle all collected cards
    shuffleArray(allCards);

    // Move all shuffled cards into the library
    library.push(...allCards);

    // Reset cascadedHandCardsInAreaCount as all cards are now in library
    cascadedHandCardsInAreaCount = 0;

    // Send the updated state to the server
    sendMove();

    // Re-render the UI
    render();

    showMessage("Your cards have been shuffled into your library!");
    optionsModal.classList.add('hidden'); // Close options modal after reset
});

function updateMagnifyStatusUI() {
    if (isMagnifyEnabled) {
        magnifyStatusEl.textContent = 'On';
        magnifyStatusEl.classList.remove('bg-red-600');
        magnifyStatusEl.classList.add('bg-green-600');
    } else {
        magnifyStatusEl.textContent = 'Off';
        magnifyStatusEl.classList.remove('bg-green-600');
        magnifyStatusEl.classList.add('bg-red-600');
    }
}

function applyMagnifyEffectToAllCards() {
    // Since magnify effect is now handled in cardFactory, 
    // we need to re-render to apply the new setting
    // and update CardZone magnify settings
    if (libraryZone) {
        libraryZone.updateMagnifyEnabled(isMagnifyEnabled);
    }
    if (graveyardZone) {
        graveyardZone.updateMagnifyEnabled(isMagnifyEnabled);
    }
    if (exileZone) {
        exileZone.updateMagnifyEnabled(isMagnifyEnabled);
    }
    if (commandZone) {
        commandZone.updateMagnifyEnabled(isMagnifyEnabled);
    }
    render();
}

magnifyToggleBtn.addEventListener('click', () => {
    isMagnifyEnabled = !isMagnifyEnabled;
    updateMagnifyStatusUI();
    applyMagnifyEffectToAllCards();
});

function showMessage(message) {
    messageText.textContent = message;
    messageModal.classList.remove('hidden');
}

// Send move debouncing
let sendMoveTimeout = null;

function sendMove() {
    if (!playerId || !gameState) return;
    socket.emit('move', {
        hand,
        library,
        graveyard: graveyard,
        exile: exile,
        command: command,
        playZone
    });
}

function debouncedSendMove() {
    if (sendMoveTimeout) {
        clearTimeout(sendMoveTimeout);
    }
    sendMoveTimeout = setTimeout(sendMove, 50); // 50ms debounce
}

// Initialize card zones
function initializeCardZones() {
    // Library zone with peek functionality
    libraryZone = new CardZone(libraryEl, 'library', {
        countElement: libraryCountEl,
        enablePeek: true,
        peekHoldTime: 200,
        currentCardWidth: currentCardWidth,
        isMagnifyEnabled: isMagnifyEnabled,
        showMessage: showMessage,
        onCardDraw: (cardObj, targetZone, options = {}) => {
            // Mark this as a client action to preserve optimistic updates
            markClientAction(`libraryTo${targetZone}`, cardObj.id);
            
            // Remove the card from the library since it was drawn from there
            const libraryIndex = library.findIndex(c => c.id === cardObj.id);
            if (libraryIndex > -1) {
                library.splice(libraryIndex, 1);
            }
            
            if (targetZone === 'hand') {
                hand.push(cardObj);
            } else if (targetZone === 'graveyard') {
                graveyard.push(cardObj);
            } else if (targetZone === 'exile') {
                exile.push(cardObj);
            } else if (targetZone === 'play') {
                cardObj.x = options.x || 10;
                cardObj.y = options.y || 10;
                cardObj.rotation = 0;
                playZone.push(cardObj);
            }
            sendMove();
            debouncedRender();
        },
        onStateChange: (action, cardIdOrIds, sourceZone, targetZone) => {
            if (action === 'moveCard') {
                handleCardMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'moveCardGroup') {
                handleCardGroupMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'shuffle') {
                // Library was shuffled, sync with server
                sendMove();
                debouncedRender();
            }
        }
    });
    
    // Graveyard zone (with peek functionality, no shuffle)
    graveyardZone = new CardZone(graveyardPileEl, 'graveyard', {
        countElement: discardCountEl,
        enablePeek: true,
        peekHoldTime: 200,
        currentCardWidth: currentCardWidth,
        isMagnifyEnabled: isMagnifyEnabled,
        showMessage: showMessage,
        showShuffle: false, // Disable shuffle for graveyard
        showTopCard: true, // Show the top card face up for graveyard
        onCardDraw: (cardObj, targetZone, options = {}) => {
            // Mark this as a client action to preserve optimistic updates  
            markClientAction(`graveyardTo${targetZone}`, cardObj.id);
            
            // Remove the card from the graveyard since it was drawn from there
            const graveyardIndex = graveyard.findIndex(c => c.id === cardObj.id);
            if (graveyardIndex > -1) {
                graveyard.splice(graveyardIndex, 1);
            }
            
            if (targetZone === 'hand') {
                hand.push(cardObj);
            } else if (targetZone === 'library') {
                library.push(cardObj);
            } else if (targetZone === 'play') {
                cardObj.x = options.x || 10;
                cardObj.y = options.y || 10;
                cardObj.rotation = 0;
                playZone.push(cardObj);
            }
            sendMove();
            debouncedRender();
        },
        onStateChange: (action, cardIdOrIds, sourceZone, targetZone) => {
            if (action === 'moveCard') {
                handleCardMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'moveCardGroup') {
                handleCardGroupMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'shuffle') {
                // Graveyard was shuffled, sync with server
                sendMove();
                debouncedRender();
            }
        }
    });
    
    // Exile zone (with peek functionality, no shuffle, identical to graveyard)
    exileZone = new CardZone(exilePileEl, 'exile', {
        countElement: exileCountEl,
        enablePeek: true,
        peekHoldTime: 200,
        currentCardWidth: currentCardWidth,
        isMagnifyEnabled: isMagnifyEnabled,
        showMessage: showMessage,
        showShuffle: false, // Disable shuffle for exile
        showTopCard: true, // Show the top card face up for exile
        onCardDraw: (cardObj, targetZone, options = {}) => {
            // Mark this as a client action to preserve optimistic updates  
            markClientAction(`exileTo${targetZone}`, cardObj.id);
            
            // Remove the card from exile since it was drawn from there
            const exileIndex = exile.findIndex(c => c.id === cardObj.id);
            if (exileIndex > -1) {
                exile.splice(exileIndex, 1);
            }
            
            if (targetZone === 'hand') {
                hand.push(cardObj);
            } else if (targetZone === 'library') {
                library.push(cardObj);
            } else if (targetZone === 'play') {
                cardObj.x = options.x || 10;
                cardObj.y = options.y || 10;
                cardObj.rotation = 0;
                playZone.push(cardObj);
            }
            sendMove();
            debouncedRender();
        },
        onStateChange: (action, cardIdOrIds, sourceZone, targetZone) => {
            if (action === 'moveCard') {
                handleCardMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'moveCardGroup') {
                handleCardGroupMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'shuffle') {
                // Exile was shuffled, sync with server
                sendMove();
                debouncedRender();
            }
        }
    });
    
    // Command zone (with peek functionality, no shuffle, similar to exile/graveyard)
    commandZone = new CardZone(commandPileEl, 'command', {
        countElement: commandCountEl,
        enablePeek: true,
        peekHoldTime: 200,
        currentCardWidth: currentCardWidth,
        isMagnifyEnabled: isMagnifyEnabled,
        showMessage: showMessage,
        showShuffle: false, // Disable shuffle for command zone
        showTopCard: true, // Show the top card face up for command zone
        onCardDraw: (cardObj, targetZone, options = {}) => {
            // Mark this as a client action to preserve optimistic updates  
            markClientAction(`commandTo${targetZone}`, cardObj.id);
            
            // Remove the card from command zone since it was drawn from there
            const commandIndex = command.findIndex(c => c.id === cardObj.id);
            if (commandIndex > -1) {
                command.splice(commandIndex, 1);
            }
            
            if (targetZone === 'hand') {
                hand.push(cardObj);
            } else if (targetZone === 'library') {
                library.push(cardObj);
            } else if (targetZone === 'play') {
                cardObj.x = options.x || 10;
                cardObj.y = options.y || 10;
                cardObj.rotation = 0;
                playZone.push(cardObj);
            }
            sendMove();
            debouncedRender();
        },
        onStateChange: (action, cardIdOrIds, sourceZone, targetZone) => {
            if (action === 'moveCard') {
                handleCardMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'moveCardGroup') {
                handleCardGroupMove(cardIdOrIds, sourceZone, targetZone);
            } else if (action === 'shuffle') {
                // Command zone was shuffled, sync with server
                sendMove();
                debouncedRender();
            }
        }
    });
}

// Turn order functionality
pickTurnOrderBtn.addEventListener('click', () => {
    console.log('Sending pickTurnOrder event');
    socket.emit('pickTurnOrder');
    showMessage("Picking random turn order...");
    optionsModal.classList.add('hidden'); // Close options modal
});

endTurnBtn.addEventListener('click', () => {
    socket.emit('endTurn');
});

function handleCardMove(cardId, sourceZone, targetZone) {
    // Find the card in the source zone
    let cardObj = null;
    if (sourceZone === 'hand') {
        const index = hand.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = hand.splice(index, 1)[0];
    } else if (sourceZone === 'play') {
        const index = playZone.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = playZone.splice(index, 1)[0];
    } else if (sourceZone === 'library') {
        const index = library.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = library.splice(index, 1)[0];
    } else if (sourceZone === 'graveyard') {
        const index = graveyard.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = graveyard.splice(index, 1)[0];
    } else if (sourceZone === 'exile') {
        const index = exile.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = exile.splice(index, 1)[0];
    } else if (sourceZone === 'command') {
        const index = command.findIndex(c => c.id === cardId);
        if (index > -1) cardObj = command.splice(index, 1)[0];
    }
    
    if (!cardObj) return;
    
    // Reset rotation (tapped state) when moving from battlefield to any other zone
    if (sourceZone === 'play' && targetZone !== 'play') {
        cardObj.rotation = 0;
    }
    
    // Add to target zone
    if (targetZone === 'hand') {
        hand.push(cardObj);
    } else if (targetZone === 'play') {
        // For play zone, we need to set position if not already set
        if (cardObj.x === undefined || cardObj.y === undefined) {
            cardObj.x = 0;
            cardObj.y = 0;
        }
        playZone.push(cardObj);
    } else if (targetZone === 'library') {
        library.push(cardObj);
    } else if (targetZone === 'graveyard') {
        graveyard.push(cardObj);
    } else if (targetZone === 'exile') {
        exile.push(cardObj);
    } else if (targetZone === 'command') {
        command.push(cardObj);
    }
    
    sendMove();
    selectedCardIds = [];
    
    render();
}

// State tracking for optimistic updates
let lastClientAction = null;
let clientActionTimeout = null;

// Mark a client action to preserve optimistic updates
function markClientAction(action, cardId = null) {
    lastClientAction = { action, cardId, timestamp: Date.now() };
    
    // Clear the action after 2 seconds to allow server authority
    if (clientActionTimeout) {
        clearTimeout(clientActionTimeout);
    }
    clientActionTimeout = setTimeout(() => {
        lastClientAction = null;
    }, 2000);
}

function render() {
    console.log('Render called at:', new Date().toISOString());
    
    // Debounce render calls to prevent flickering
    if (renderTimeout) {
        clearTimeout(renderTimeout);
    }
    
    if (isRendering) {
        renderTimeout = setTimeout(render, 16); // ~60fps
        return;
    }
    
    isRendering = true;
    
    try {
        if (!gameState || !playerId) {
            console.log('Render aborted: missing gameState or playerId');
            return;
        }

        // Smart merge: preserve recent client changes, use server for everything else
        // Hand always shows current player's data
        const serverHand = gameState.players[playerId]?.hand || [];
        
        // Other zones show data for the player whose play zone is currently being viewed
        const viewedPlayerId = activePlayZonePlayerId || playerId;
        const serverLibrary = gameState.players[viewedPlayerId]?.library || [];
        const serverGraveyard = gameState.players[viewedPlayerId]?.graveyard || [];
        const serverExile = gameState.players[viewedPlayerId]?.exile || [];
        const serverCommand = gameState.players[viewedPlayerId]?.command || [];
        const serverPlayZone = gameState.playZones[viewedPlayerId] || [];
        
        // If we have a recent client action, preserve local state for a short time
        const hasRecentClientAction = lastClientAction && (Date.now() - lastClientAction.timestamp < 1000);
        
        if (hasRecentClientAction && viewedPlayerId === playerId) {
            // Only preserve local state if we're viewing our own zones
            console.log('Preserving local state due to recent client action:', lastClientAction.action);
            // Keep local state for recent actions, but merge other players' changes
            // Only merge playZone from server if it has more cards (other players added cards)
            if (serverPlayZone.length > playZone.length) {
                // Merge server cards that aren't in our local state
                serverPlayZone.forEach(serverCard => {
                    if (!playZone.find(localCard => localCard.id === serverCard.id)) {
                        playZone.push(serverCard);
                    }
                });
            }
        } else {
            // No recent client action or viewing another player, use server state as source of truth
            hand = serverHand; // Hand is always current player
            
            if (viewedPlayerId === playerId) {
                // Viewing our own zones
                library = serverLibrary;
                graveyard = serverGraveyard;
                exile = serverExile;
                command = serverCommand || []; // Ensure command is always an array
                playZone = serverPlayZone;
            } else {
                // Viewing another player's zones - use their data for zones but keep our hand
                library = serverLibrary;
                graveyard = serverGraveyard;
                exile = serverExile;
                command = serverCommand || [];
                playZone = serverPlayZone;
            }
        }

        // Update CardZone instances (these now have change detection)
        // Only allow interactions if we're viewing our own zones
        const allowInteractions = viewedPlayerId === playerId;
        
        if (libraryZone) {
            libraryZone.updateCards(library);
            libraryZone.setInteractionEnabled(allowInteractions);
        }
        if (graveyardZone) {
            graveyardZone.updateCards(graveyard);
            graveyardZone.setInteractionEnabled(allowInteractions);
        }
        if (exileZone) {
            exileZone.updateCards(exile);
            exileZone.setInteractionEnabled(allowInteractions);
        }
        if (commandZone) {
            commandZone.updateCards(command);
            commandZone.setInteractionEnabled(allowInteractions);
        }

        // Render hand
        handZoneEl.innerHTML = '';
        hand.forEach(card => {
            handZoneEl.appendChild(createCardElement(card, 'hand', {
                isMagnifyEnabled: isMagnifyEnabled,
                isInteractable: true,
                onCardClick: handleCardClick,
                onCardDblClick: handleCardDoubleClick,
                onCardDragStart: handleCardDragStart,
                showBack: card.faceShown === 'back'
            }));
        });

    // Render play zones and tabs
    playZonesContainer.innerHTML = '';
    playerTabsEl.innerHTML = '';
    
    // Determine player order - use turn order if set, otherwise just use Object.keys order
    let playerOrder = [];
    if (gameState.turnOrderSet && gameState.turnOrder) {
        playerOrder = gameState.turnOrder;
    } else {
        playerOrder = Object.keys(gameState.players);
    }
    
    playerOrder.forEach(pid => {
        // Only create elements for players that still exist
        if (!gameState.players[pid]) return;
        
        // Create play zone div
        const playerZoneEl = document.createElement('div');
        playerZoneEl.id = `play-zone-${pid}`;
        playerZoneEl.className = 'play-zone w-full h-full relative';
        if (pid !== activePlayZonePlayerId) {
            playerZoneEl.style.display = 'none';
        }
        
        const playerZoneData = gameState.playZones[pid] || [];
        playerZoneData.forEach(cardData => {
            const isInteractable = (pid === activePlayZonePlayerId && pid === playerId);
            const cardEl = createCardElement(cardData, 'play', {
                isMagnifyEnabled: isMagnifyEnabled,
                isInteractable: isInteractable,
                onCardClick: isInteractable ? handleCardClick : null,
                onCardDblClick: isInteractable ? handleCardDoubleClick : null,
                onCardDragStart: isInteractable ? handleCardDragStart : null,
                showBack: cardData.faceShown === 'back'
            });
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${cardData.x}px`;
            cardEl.style.top = `${cardData.y}px`;
            cardEl.style.transform = `rotate(${cardData.rotation || 0}deg)`;
            playerZoneEl.appendChild(cardEl);
        });
        playZonesContainer.appendChild(playerZoneEl);

        // Create player tab
        const tabEl = document.createElement('button');
        tabEl.className = 'px-4 py-2 text-sm font-medium rounded-md transition-colors';
        
        // Add turn order indicator if turn order is set
        let tabText = pid === playerId ? 'Your Play Zone' : gameState.players[pid].displayName;
        if (gameState.turnOrderSet && gameState.turnOrder) {
            const turnIndex = gameState.turnOrder.indexOf(pid) + 1;
            tabText = `${turnIndex}. ${tabText}`;
            
            // Highlight current turn player
            if (gameState.currentTurn !== undefined && gameState.turnOrder[gameState.currentTurn] === pid) {
                tabEl.classList.add('ring-2', 'ring-yellow-400');
            }
        }
        
        tabEl.textContent = tabText;
        if (pid === activePlayZonePlayerId) {
            tabEl.classList.add('bg-blue-600', 'text-white');
        } else {
            tabEl.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
        tabEl.addEventListener('click', () => {
            activePlayZonePlayerId = pid;
            render();
        });
        playerTabsEl.appendChild(tabEl);
    });
    
    // Update turn control UI
    console.log('Updating turn control UI:', {
        turnOrderSet: gameState.turnOrderSet,
        turnOrder: gameState.turnOrder,
        currentTurn: gameState.currentTurn
    });
    
    if (gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined) {
        const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurn];
        const currentPlayerName = gameState.players[currentTurnPlayerId]?.displayName || 'Unknown';
        
        console.log('Turn control - current player:', currentTurnPlayerId, 'my player ID:', playerId, 'is my turn:', currentTurnPlayerId === playerId);
        
        turnIndicator.style.display = 'block';
        currentPlayerNameEl.textContent = currentTurnPlayerId === playerId ? 'You' : currentPlayerName;
        
        // Show end turn button only if it's the current player's turn
        if (currentTurnPlayerId === playerId) {
            console.log('Showing end turn button for my turn');
            endTurnBtn.style.display = 'block';
            endTurnBtn.disabled = false;
        } else {
            console.log('Hiding end turn button - not my turn');
            endTurnBtn.style.display = 'none';
            endTurnBtn.disabled = true;
        }
    } else {
        console.log('No turn order set, hiding turn controls');
        // No turn order set yet
        turnIndicator.style.display = 'none';
        endTurnBtn.style.display = 'none';
        endTurnBtn.disabled = true;
    }

    // Re-apply selection and re-populate selectedCards array
    selectedCards = [];
    const currentActivePlayZoneEl = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    if (currentActivePlayZoneEl) {
        selectedCardIds.forEach(cardId => {
            const cardEl = currentActivePlayZoneEl.querySelector(`.card[data-id="${cardId}"]`);
            if (cardEl) {
                cardEl.classList.add('selected-card');
                selectedCards.push(cardEl);
            }
        });
    }

    // Re-add drop listeners to the new active play zone
    addDropListeners();
    addSelectionListeners();
    updateCounts();
    } finally {
        isRendering = false;
    }
}

function addDropListeners() {
    const activeZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    if (!activeZone) return;

    // Only handle play zone and hand zone - library and discard are handled by CardZone instances
    const dropZones = [activeZone, handZoneEl];
    dropZones.forEach(zone => {
        // Prevent adding duplicate listeners
        if(zone.dataset.listening) return;
        zone.dataset.listening = true;

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (zone.id.startsWith('play-zone') && activePlayZonePlayerId !== playerId) {
                return;
            }
            zone.classList.add('zone-active');
        });
        zone.addEventListener('dragleave', (e) => {
            zone.classList.remove('zone-active');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('zone-active');
            
            if (zone.id.startsWith('play-zone') && activePlayZonePlayerId !== playerId) {
                return;
            }

            const groupDataString = e.dataTransfer.getData('application/json');
            if (groupDataString) {
                const groupData = JSON.parse(groupDataString);
                
                if (zone.id.startsWith('play-zone')) {
                    const cascadeOffset = 15;
                    groupData.cardIds.forEach((cardId, index) => {
                        const rect = zone.getBoundingClientRect();
                        const x = e.clientX - rect.left - (currentCardWidth / 2) + (index * cascadeOffset);
                        const y = e.clientY - rect.top - ((currentCardWidth * 120/90) / 2) + (index * cascadeOffset);
                        
                        let cardObj = hand.find(c => c.id === cardId) || playZone.find(c => c.id === cardId) || graveyard.find(c => c.id === cardId) || exile.find(c => c.id === cardId) || command.find(c => c.id === cardId) || library.find(c => c.id === cardId);
                        if (!cardObj) {
                            console.error('Card not found:', cardId);
                            return;
                        }
                        removeCardFromSource(cardId, groupData.sourceZone);
                        // Create a copy to avoid reference issues
                        const cardCopy = { ...cardObj };
                        cardCopy.x = x;
                        cardCopy.y = y;
                        playZone.push(cardCopy);
                    });
                } else if (zone.id === 'hand-zone') {
                    groupData.cardIds.forEach(cardId => {
                        let cardObj = hand.find(c => c.id === cardId) || playZone.find(c => c.id === cardId) || graveyard.find(c => c.id === cardId) || exile.find(c => c.id === cardId) || command.find(c => c.id === cardId) || library.find(c => c.id === cardId);
                        if (!cardObj) {
                            console.error('Card not found for hand move:', cardId);
                            return;
                        }
                        removeCardFromSource(cardId, groupData.sourceZone);
                        // Create a copy to avoid reference issues
                        const cardCopy = { ...cardObj };
                        hand.push(cardCopy);
                    });
                }
            } else {
                const cardId = e.dataTransfer.getData('text/plain');
                const sourceZone = e.dataTransfer.getData('sourceZone');
                
                // Handle cards from any source zone
                let cardObj = hand.find(c => c.id === cardId) || playZone.find(c => c.id === cardId) || graveyard.find(c => c.id === cardId) || exile.find(c => c.id === cardId) || command.find(c => c.id === cardId) || library.find(c => c.id === cardId);
                if (!cardObj) return;
                
                // For play zone drops, we need to handle positioning manually
                if (zone.id.startsWith('play-zone')) {
                    const rect = zone.getBoundingClientRect();
                    const x = e.clientX - rect.left - (currentCardWidth / 2);
                    const y = e.clientY - rect.top - ((currentCardWidth * 120/90) / 2);
                    
                    removeCardFromSource(cardId, sourceZone);
                    cardObj.x = x;
                    cardObj.y = y;
                    playZone.push(cardObj);
                    
                    sendMove();
                    selectedCardIds = [];
                    render();
                    return;
                }
                
                // For other zones, use handleCardMove
                let targetZone = null;
                if (zone.id === 'hand-zone') {
                    targetZone = 'hand';
                } else if (zone.id === 'library') {
                    targetZone = 'library';
                } else if (zone.id === 'graveyard-pile') {
                    targetZone = 'graveyard';
                }
                
                if (targetZone) {
                    handleCardMove(cardId, sourceZone, targetZone);
                    return;
                }
                
                // Fallback (shouldn't reach here normally)
                removeCardFromSource(cardId, sourceZone);
                if (zone.id === 'hand-zone') {
                    hand.push(cardObj);
                }
                
                sendMove();
                selectedCardIds = [];
                debouncedRender();
            }
            
            sendMove();
            selectedCardIds = [];
            debouncedRender();
        });
    });
}

function addSelectionListeners() {
    const activeZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    if (!activeZone || activePlayZonePlayerId !== playerId) return;

    activeZone.addEventListener('mousedown', (e) => {
        if (e.target === activeZone) {
            isSelecting = true;
            startX = e.clientX;
            startY = e.clientY;
            
            selectedCards.forEach(c => c.classList.remove('selected-card'));
            selectedCards = [];
            selectedCardIds = [];

            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            selectionBox.style.left = `${e.clientX}px`;
            selectionBox.style.top = `${e.clientY}px`;
            activeZone.appendChild(selectionBox);
        }
    });
}

document.addEventListener('mousemove', (e) => {
    if (isSelecting) {
        const currentX = e.clientX;
        const currentY = e.clientY;
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(startX - currentX);
        const height = Math.abs(startY - currentY);
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;

        const selectionRect = selectionBox.getBoundingClientRect();
        const activeZone = document.getElementById(`play-zone-${playerId}`);
        const allCards = activeZone.querySelectorAll('.card');
        
        selectedCards = [];
        selectedCardIds = [];
        allCards.forEach(cardEl => {
            const cardRect = cardEl.getBoundingClientRect();
            if (checkIntersection(selectionRect, cardRect)) {
                const cardId = cardEl.dataset.id;
                // Only add if not already in the array (prevent duplicates)
                if (!selectedCardIds.includes(cardId)) {
                    selectedCards.push(cardEl);
                    selectedCardIds.push(cardId);
                }
                cardEl.classList.add('selected-card');
            } else {
                cardEl.classList.remove('selected-card');
            }
        });
    }
});

document.addEventListener('mouseup', (e) => {
    if (isSelecting) {
        isSelecting = false;
        if (selectedCards.length > 0) {
            justSelectedByDrag = true;
        }
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
    }
});

document.addEventListener('click', (e) => {
    if (justSelectedByDrag) {
        justSelectedByDrag = false;
        return;
    }
    if (!e.target.closest('.play-zone') && !e.target.closest('#hand-zone')) {
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards = [];
        selectedCardIds = [];
    }
    // Hide context menu on any click (unless it was just shown)
    if (!contextMenuJustShown) {
        hideCardContextMenu();
    }
});

// Context menu event handlers
document.addEventListener('contextmenu', (e) => {
    // Only show context menu if we have selected cards and right-clicking in a valid area
    if (selectedCards.length > 0 && (e.target.closest('.play-zone') || e.target.closest('#hand-zone') || e.target.closest('.card'))) {
        showCardContextMenu(e);
    }
});

function checkIntersection(rect1, rect2) {
    return rect1.left < rect2.right &&
           rect1.right > rect2.left &&
           rect1.top < rect2.bottom &&
           rect1.bottom > rect2.top;
}

// Utility to generate a unique card id
function generateCardId() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback: timestamp + random
    return 'card-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
}

// Example deck creation (replace with your deck logic)
function createDeck(cardNames) {
    return cardNames.map(name => ({
        id: generateCardId(),
        name,
        displayName: name // You can customize this per card
    }));
}

// Zones now store card objects
let library = [];
let hand = [];
let graveyard = [];
let exile = [];
let command = [];
let playZone = [];
let currentCardWidth = 80;
const minCardWidth = 60;
const maxCardWidth = 120;
const cardSizeStep = 10;

// Card interaction callbacks for the cardFactory
function handleCardClick(e, card, cardEl, location) {
    e.stopPropagation();
    if (location === 'play' && activePlayZonePlayerId !== playerId) return;
    const cardId = cardEl.dataset.id;
    const isSelected = selectedCardIds.includes(cardId);
    if (!e.ctrlKey && !e.metaKey) {
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards = [];
        selectedCardIds = [];
    }
    if (isSelected) {
        selectedCardIds = selectedCardIds.filter(id => id !== cardId);
        const index = selectedCards.indexOf(cardEl);
        if (index > -1) selectedCards.splice(index, 1);
        cardEl.classList.remove('selected-card');
    } else {
        // Only add if not already in the array (prevent duplicates)
        if (!selectedCardIds.includes(cardId)) {
            selectedCardIds.push(cardId);
            selectedCards.push(cardEl);
        }
        cardEl.classList.add('selected-card');
    }
}

function handleCardDoubleClick(e, card, location) {
    e.stopPropagation();
    console.log('Double click detected:', { cardId: card.id, cardName: card.name, location });
    
    const cardId = card.id;
    if (location === 'play') {
        // Double-click on play zone cards to tap/untap them
        // Get the specific card element that was double-clicked
        const cardEl = e.target.closest('.card');
        if (cardEl && cardEl.dataset.id === cardId) {
            // Only tap/untap this specific card, regardless of selection state
            tapUntapCards([cardEl]);
        }
        return;
    } else if (location === 'hand') {
        console.log('Processing hand card double-click for card:', cardId);
        console.log('Current hand before removal:', hand.map(c => ({ id: c.id, name: c.name })));
        console.log('Current playZone before addition:', playZone.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y })));
        
        // Find the card in hand by ID
        const cardIndex = hand.findIndex(c => c.id === cardId);
        console.log('Card found in hand at index:', cardIndex, 'Hand length:', hand.length);
        
        if (cardIndex > -1) {
            // Mark this as a client action to preserve optimistic updates
            markClientAction('handToPlay', cardId);
            
            // Remove from hand
            const cardObj = hand.splice(cardIndex, 1)[0];
            console.log('Removed card from hand:', cardObj);
            
            const cascadeOffset = 15;
            const initialX = 10;
            const initialY = 10;
            const maxCardsPerRow = 5;
            const row = Math.floor(cascadedHandCardsInAreaCount / maxCardsPerRow);
            const col = cascadedHandCardsInAreaCount % maxCardsPerRow;
            const x = initialX + (col * cascadeOffset);
            const y = initialY + (row * cascadeOffset);
            
            // Move the full card object to playZone, preserving its ID and properties
            const playCard = { ...cardObj, x, y, rotation: 0, fromHandCascade: true };
            playZone.push(playCard);
            console.log('Added card to play zone:', playCard);
            console.log('Current hand after removal:', hand.map(c => ({ id: c.id, name: c.name })));
            console.log('Current playZone after addition:', playZone.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y })));
            
            updateCascadedHandCardsInAreaCount();
            
            // Render immediately to update the UI before server response
            console.log('Rendering UI immediately');
            render();
            
            // Send update to server after the local render
            sendMove();
            
            console.log('Move sent to server');
        } else {
            console.warn('Card not found in hand:', cardId);
        }
    }
}

function handleCardDragStart(e, card, location) {
    const sourceZone = location;
    if (selectedCardIds.length > 1 && selectedCardIds.includes(card.id)) {
        const groupData = {
            cardIds: selectedCardIds,
            sourceZone: sourceZone
        };
        console.log('Group drag starting with card IDs:', selectedCardIds);
        e.dataTransfer.setData('application/json', JSON.stringify(groupData));
    } else {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.setData('sourceZone', sourceZone);
    }
}

function removeCardFromSource(cardId, sourceZone) {
    let cardIndex;
    switch (sourceZone) {
        case 'hand':
            cardIndex = hand.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                hand.splice(cardIndex, 1);
            }
            break;
        case 'play':
            cardIndex = playZone.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                playZone.splice(cardIndex, 1);
                updateCascadedHandCardsInAreaCount(); // Update cascade count when removing from play zone
            }
            break;
        case 'graveyard':
            cardIndex = graveyard.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                graveyard.splice(cardIndex, 1);
            }
            break;
        case 'exile':
            cardIndex = exile.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                exile.splice(cardIndex, 1);
            }
            break;
        case 'command':
            cardIndex = command.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                command.splice(cardIndex, 1);
            }
            break;
        case 'library':
            cardIndex = library.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                library.splice(cardIndex, 1);
            }
            break;
    }
}

function updateCounts() {
    if (!gameState || !playerId) return;
    
    // Show counts for the player whose zones are currently being viewed
    const viewedPlayerId = activePlayZonePlayerId || playerId;
    const player = gameState.players[viewedPlayerId];
    
    // Library always shows count
    libraryCountEl.textContent = player?.library?.length || 0;
    
    // Graveyard, exile, and command only show count if not empty
    const graveyardCount = player?.graveyard?.length || 0;
    const exileCount = player?.exile?.length || 0;
    const commandCount = player?.command?.length || 0;
    
    discardCountEl.textContent = graveyardCount > 0 ? graveyardCount : '';
    exileCountEl.textContent = exileCount > 0 ? exileCount : '';
    commandCountEl.textContent = commandCount > 0 ? commandCount : '';
}

document.addEventListener('DOMContentLoaded', () => {
    updateMagnifyStatusUI(); // Set initial status
    initializeCardZones(); // Initialize the card zones
    
    // Check if turn control elements exist
    console.log('Turn control elements:', {
        endTurnBtn: !!endTurnBtn,
        turnIndicator: !!turnIndicator,
        currentPlayerNameEl: !!currentPlayerNameEl
    });
    
    // Turn order functionality event listeners
    pickTurnOrderBtn.addEventListener('click', () => {
        console.log('Sending pickTurnOrder event');
        socket.emit('pickTurnOrder');
        showMessage("Picking random turn order...");
        optionsModal.classList.add('hidden'); // Close options modal
    });

    endTurnBtn.addEventListener('click', () => {
        console.log('End turn button clicked - preventing multiple clicks');
        // Prevent multiple rapid clicks
        endTurnBtn.disabled = true;
        setTimeout(() => {
            endTurnBtn.disabled = false;
        }, 1000); // Re-enable after 1 second
        
        socket.emit('endTurn');
    });
    
    // Other initializations can go here
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && selectedCards.length > 0) {
        e.preventDefault();
        tapUntapCards(selectedCards);
    } else if (e.code === 'KeyF' && selectedCards.length > 0) {
        e.preventDefault();
        // Flip selected cards that have back faces
        selectedCards.forEach(cardEl => {
            import('./cardFactory.js').then(module => {
                const flipped = module.flipCard(cardEl);
                if (flipped) {
                    // Update the game state to track which face is shown
                    const cardId = cardEl.dataset.id;
                    const currentFace = cardEl.dataset.faceShown;
                    
                    // Find and update card in appropriate zone
                    const updateCardFace = (cards) => {
                        const cardIndex = cards.findIndex(c => c.id === cardId);
                        if (cardIndex > -1) {
                            cards[cardIndex].faceShown = currentFace;
                            return true;
                        }
                        return false;
                    };
                    
                    // Update in hand, playZone, or other zones as needed
                    if (!updateCardFace(hand)) {
                        if (!updateCardFace(playZone)) {
                            updateCardFace(graveyard);
                        }
                    }
                    
                    sendMove();
                }
            });
        });
    }
});

// Shared tap/untap functionality
let tapUntapDebounceTimeout = null;

function tapUntapCards(cardElements) {
    if (!cardElements || cardElements.length === 0) return false;
    
    // Debounce rapid tap/untap calls
    if (tapUntapDebounceTimeout) {
        clearTimeout(tapUntapDebounceTimeout);
    }
    
    tapUntapDebounceTimeout = setTimeout(() => {
        const playZoneCards = cardElements.filter(cardEl => cardEl.closest('.play-zone'));
        if (playZoneCards.length === 0) return false;
        
        // If any selected card is untapped, tap all selected. Otherwise, untap all.
        const shouldTap = playZoneCards.some(cardEl => {
            const cardId = cardEl.dataset.id;
            const cardData = playZone.find(c => c.id === cardId);
            return cardData && (cardData.rotation || 0) === 0;
        });
        const newRotation = shouldTap ? 90 : 0;
        
        // Apply state changes and visual changes immediately
        playZoneCards.forEach(cardEl => {
            const cardId = cardEl.dataset.id;
            const cardIndex = playZone.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                playZone[cardIndex].rotation = newRotation;
                // Apply visual rotation immediately for instant feedback
                cardEl.style.transform = `rotate(${newRotation}deg)`;
            }
        });
        
        // Send state to server with debouncing
        debouncedSendMove();
    }, 100); // 100ms debounce to prevent rapid firing
    
    return true;
}

function updateCascadedHandCardsInAreaCount() {
    // Count cards that are still in their original cascade positions
    const cascadeOffset = 15;
    const initialX = 10;
    const initialY = 10;
    const maxCardsPerRow = 5;
    
    let count = 0;
    for (let i = 0; i < playZone.length; i++) {
        const card = playZone[i];
        if (card.fromHandCascade) {
            // Calculate what the position should be for this cascade index
            const row = Math.floor(count / maxCardsPerRow);
            const col = count % maxCardsPerRow;
            const expectedX = initialX + (col * cascadeOffset);
            const expectedY = initialY + (row * cascadeOffset);
            
            // Check if the card is still in its original cascade position
            if (Math.abs(card.x - expectedX) < 5 && Math.abs(card.y - expectedY) < 5) {
                count++;
            }
        }
    }
    
    cascadedHandCardsInAreaCount = count;
}

// Card size controls
function updateCardSize() {
    // Update CSS variable globally for all cards
    document.documentElement.style.setProperty('--card-width', `${currentCardWidth}px`);
    
    // Update CSS variable for hand cards (legacy support)
    handZoneEl.style.setProperty('--hand-card-width', `${currentCardWidth}px`);
    
    // Update CardZone instances
    if (libraryZone) {
        libraryZone.updateCardWidth(currentCardWidth);
    }
    if (graveyardZone) {
        graveyardZone.updateCardWidth(currentCardWidth);
    }
    if (exileZone) {
        exileZone.updateCardWidth(currentCardWidth);
    }
    if (commandZone) {
        commandZone.updateCardWidth(currentCardWidth);
    }
    
    // Re-render to apply new size
    render();
}

function increaseCardSize() {
    if (currentCardWidth < maxCardWidth) {
        currentCardWidth = Math.min(currentCardWidth + cardSizeStep, maxCardWidth);
        updateCardSize();
    }
}

function decreaseCardSize() {
    if (currentCardWidth > minCardWidth) {
        currentCardWidth = Math.max(currentCardWidth - cardSizeStep, minCardWidth);
        updateCardSize();
    }
}

// Add event listeners for card size buttons
increaseSizeBtn.addEventListener('click', increaseCardSize);
decreaseSizeBtn.addEventListener('click', decreaseCardSize);

// Utility function for shuffling arrays
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Context menu functions for selected cards
function showCardContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Only show context menu if we have selected cards
    if (selectedCards.length === 0) return;
    
    // Set flag to prevent immediate click events
    contextMenuJustShown = true;
    setTimeout(() => {
        contextMenuJustShown = false;
    }, 100);
    
    // Hide any existing context menu
    hideCardContextMenu();
    
    // Create context menu
    cardContextMenu = document.createElement('div');
    cardContextMenu.className = 'card-context-menu fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-48';
    cardContextMenu.style.left = `${e.clientX}px`;
    cardContextMenu.style.top = `${e.clientY}px`;
    
    // Header showing selected count
    const header = document.createElement('div');
    header.className = 'px-4 py-2 border-b border-gray-600 text-gray-300 text-sm font-semibold';
    header.textContent = `${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} selected`;
    cardContextMenu.appendChild(header);
    
    // Move to Library option
    const libraryOption = document.createElement('button');
    libraryOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    libraryOption.textContent = 'Send to Library';
    libraryOption.addEventListener('click', () => {
        moveSelectedCardsToZone('library');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(libraryOption);
    
    // Move to Hand option
    const handOption = document.createElement('button');
    handOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    handOption.textContent = 'Send to Hand';
    handOption.addEventListener('click', () => {
        moveSelectedCardsToZone('hand');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(handOption);
    
    // Move to Graveyard option
    const graveyardOption = document.createElement('button');
    graveyardOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    graveyardOption.textContent = 'Send to Graveyard';
    graveyardOption.addEventListener('click', () => {
        moveSelectedCardsToZone('graveyard');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(graveyardOption);
    
    // Move to Exile option
    const exileOption = document.createElement('button');
    exileOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    exileOption.textContent = 'Send to Exile';
    exileOption.addEventListener('click', () => {
        moveSelectedCardsToZone('exile');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(exileOption);
    
    // Move to Command option
    const commandOption = document.createElement('button');
    commandOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    commandOption.textContent = 'Send to Command Zone';
    commandOption.addEventListener('click', () => {
        moveSelectedCardsToZone('command');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(commandOption);
    
    // Ensure context menu stays within viewport
    document.body.appendChild(cardContextMenu);
    const rect = cardContextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        cardContextMenu.style.left = `${e.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        cardContextMenu.style.top = `${e.clientY - rect.height}px`;
    }
}

function hideCardContextMenu() {
    if (cardContextMenu) {
        cardContextMenu.remove();
        cardContextMenu = null;
    }
    contextMenuJustShown = false;
}

function moveSelectedCardsToZone(targetZone) {
    if (selectedCards.length === 0) return;
    
    // Get the card IDs and their source zones
    const cardsToMove = selectedCards.map(cardEl => {
        const cardId = cardEl.dataset.id;
        let sourceZone = null;
        let cardObj = null;
        
        // Determine source zone by checking which array contains the card
        if (hand.find(c => c.id === cardId)) {
            sourceZone = 'hand';
            cardObj = hand.find(c => c.id === cardId);
        } else if (playZone.find(c => c.id === cardId)) {
            sourceZone = 'play';
            cardObj = playZone.find(c => c.id === cardId);
        } else if (graveyard.find(c => c.id === cardId)) {
            sourceZone = 'graveyard';
            cardObj = graveyard.find(c => c.id === cardId);
        } else if (exile.find(c => c.id === cardId)) {
            sourceZone = 'exile';
            cardObj = exile.find(c => c.id === cardId);
        } else if (command.find(c => c.id === cardId)) {
            sourceZone = 'command';
            cardObj = command.find(c => c.id === cardId);
        } else if (library.find(c => c.id === cardId)) {
            sourceZone = 'library';
            cardObj = library.find(c => c.id === cardId);
        }
        
        return { cardId, sourceZone, cardObj };
    }).filter(item => item.sourceZone && item.cardObj); // Only include cards with known source zones and objects
    
    if (cardsToMove.length === 0) return;
    
    // Remove all cards from their source zones first (to avoid issues with array modification)
    cardsToMove.forEach(({ cardId, sourceZone }) => {
        if (sourceZone === 'hand') {
            const index = hand.findIndex(c => c.id === cardId);
            if (index > -1) hand.splice(index, 1);
        } else if (sourceZone === 'play') {
            const index = playZone.findIndex(c => c.id === cardId);
            if (index > -1) playZone.splice(index, 1);
        } else if (sourceZone === 'graveyard') {
            const index = graveyard.findIndex(c => c.id === cardId);
            if (index > -1) graveyard.splice(index, 1);
        } else if (sourceZone === 'exile') {
            const index = exile.findIndex(c => c.id === cardId);
            if (index > -1) exile.splice(index, 1);
        } else if (sourceZone === 'command') {
            const index = command.findIndex(c => c.id === cardId);
            if (index > -1) command.splice(index, 1);
        } else if (sourceZone === 'library') {
            const index = library.findIndex(c => c.id === cardId);
            if (index > -1) library.splice(index, 1);
        }
    });
    
    // Add all cards to the target zone
    cardsToMove.forEach(({ cardObj, sourceZone }) => {
        // Reset rotation (tapped state) when moving from battlefield to any other zone
        if (sourceZone === 'play' && targetZone !== 'play') {
            cardObj.rotation = 0;
        }
        
        // Add to target zone
        if (targetZone === 'hand') {
            hand.push(cardObj);
        } else if (targetZone === 'play') {
            // For play zone, we need to set position if not already set
            if (cardObj.x === undefined || cardObj.y === undefined) {
                cardObj.x = 0;
                cardObj.y = 0;
            }
            playZone.push(cardObj);
        } else if (targetZone === 'library') {
            library.push(cardObj);
        } else if (targetZone === 'graveyard') {
            graveyard.push(cardObj);
        } else if (targetZone === 'exile') {
            exile.push(cardObj);
        } else if (targetZone === 'command') {
            command.push(cardObj);
        }
    });
    
    // Update CardZone displays
    if (libraryZone) {
        libraryZone.updateCards(library);
    }
    if (graveyardZone) {
        graveyardZone.updateCards(graveyard);
    }
    if (exileZone) {
        exileZone.updateCards(exile);
    }
    if (commandZone) {
        commandZone.updateCards(command);
    }
    
    // Clear selection after moving
    selectedCards.forEach(c => c.classList.remove('selected-card'));
    selectedCards = [];
    selectedCardIds = [];
    
    // Send the updated state to server (only once)
    sendMove();
    
    // Re-render the game (only once)
    render();
    
    // Show confirmation message
    const cardCount = cardsToMove.length;
    if (cardCount > 0) {
        showMessage(`Moved ${cardCount} card${cardCount > 1 ? 's' : ''} to ${targetZone}`);
    }
}

function handleCardGroupMove(cardIds, sourceZone, targetZone) {
    if (!cardIds || cardIds.length === 0) return;
    
    // Get all card objects and remove them from source zone
    const cardsToMove = [];
    cardIds.forEach(cardId => {
        let cardObj = null;
        if (sourceZone === 'hand') {
            const index = hand.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = hand.splice(index, 1)[0];
        } else if (sourceZone === 'play') {
            const index = playZone.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = playZone.splice(index, 1)[0];
        } else if (sourceZone === 'library') {
            const index = library.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = library.splice(index, 1)[0];
        } else if (sourceZone === 'graveyard') {
            const index = graveyard.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = graveyard.splice(index, 1)[0];
        } else if (sourceZone === 'exile') {
            const index = exile.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = exile.splice(index, 1)[0];
        } else if (sourceZone === 'command') {
            const index = command.findIndex(c => c.id === cardId);
            if (index > -1) cardObj = command.splice(index, 1)[0];
        }
        
        if (cardObj) {
            // Reset rotation (tapped state) when moving from battlefield to any other zone
            if (sourceZone === 'play' && targetZone !== 'play') {
                cardObj.rotation = 0;
            }
            cardsToMove.push(cardObj);
        }
    });
    
    // Add all cards to target zone
    cardsToMove.forEach(cardObj => {
        if (targetZone === 'hand') {
            hand.push(cardObj);
        } else if (targetZone === 'play') {
            // For play zone, we need to set position if not already set
            if (cardObj.x === undefined || cardObj.y === undefined) {
                cardObj.x = 0;
                cardObj.y = 0;
            }
            playZone.push(cardObj);
        } else if (targetZone === 'library') {
            library.push(cardObj);
        } else if (targetZone === 'graveyard') {
            graveyard.push(cardObj);
        } else if (targetZone === 'exile') {
            exile.push(cardObj);
        } else if (targetZone === 'command') {
            command.push(cardObj);
        }
    });
    
    sendMove();
    selectedCardIds = [];
    
    render();
}


