import ScryfallCache from './scryfallCache.js';
import { createCardElement } from './cardFactory.js';
import { CardZone } from './cardZone.js';

// Cache for heart SVG content
let heartSVGContent = null;

// Load heart SVG content
async function loadHeartSVG() {
    if (heartSVGContent) return heartSVGContent;
    
    try {
        const response = await fetch('heart.svg');
        const text = await response.text();
        heartSVGContent = text;
        return heartSVGContent;
    } catch (error) {
        console.error('Failed to load heart.svg:', error);
        // Fallback inline SVG if heart.svg fails to load
        heartSVGContent = `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
            <path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Zm0-108q96-86 158-147.5t98-107q36-45.5 50-81t14-70.5q0-60-40-100t-100-40q-47 0-87 26.5T518-680h-76q-15-41-55-67.5T300-774q-60 0-100 40t-40 100q0 35 14 70.5t50 81q36 45.5 98 107T480-228Zm0-273Z"/>
        </svg>`;
        return heartSVGContent;
    }
}

// Helper function to create heart icon with specific styling
function createHeartIcon(size = '14px', color = '#ef4444') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(heartSVGContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (svg) {
        svg.setAttribute('height', size);
        svg.setAttribute('width', size);
        svg.setAttribute('fill', color);
        return svg.outerHTML;
    }
    
    // Fallback
    return `<img src="heart.svg" alt="♥" style="width: ${size}; height: ${size}; filter: hue-rotate(0deg) saturate(2) brightness(0.8);">`;
}

const socket = io();
let room = null;
let playerId = null;
let gameState = null;
let activePlayZonePlayerId = null;
let isMagnifyEnabled = false; // New state variable for magnify on hover
let magnifyPreviewWidth = 320; // Default magnify preview width
let magnifyPreviewHeight = 430; // Default magnify preview height (calculated based on card aspect ratio)

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
const createPlaceholderBtn = document.getElementById('create-placeholder-btn'); // Placeholder card button
const placeholderModal = document.getElementById('placeholder-modal'); // Placeholder modal
const placeholderTextInput = document.getElementById('placeholder-text-input'); // Placeholder text input
const confirmPlaceholderBtn = document.getElementById('confirm-placeholder-btn'); // Confirm placeholder button
const cancelPlaceholderBtn = document.getElementById('cancel-placeholder-btn'); // Cancel placeholder button
const magnifySizeSliderContainer = document.getElementById('magnify-size-slider-container'); // Magnify size slider container
const magnifySizeSlider = document.getElementById('magnify-size-slider'); // Magnify size slider
const lifeTotalEl = document.getElementById('life-total'); // Life total display
const increaseLifeBtn = document.getElementById('increase-life-btn'); // Increase life button
const decreaseLifeBtn = document.getElementById('decrease-life-btn'); // Decrease life button


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
    renderTimeout = setTimeout(async () => {
        await render();
    }, 16); // ~60fps max
}

// Socket.IO event handlers
joinBtn.addEventListener('click', () => {
    const roomName = roomInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const decklistRaw = decklistInput.value.trim();
    // Parse decklist into arrays of card names, separating commanders from library cards
    const decklist = [];
    const commanders = [];
    
    // Split by lines and handle empty lines to detect commander section
    const lines = decklistRaw.split('\n').map(line => line.trim());
    
    // Find the last empty line to determine if there's a commander section
    let lastEmptyLineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i] === '') {
            lastEmptyLineIndex = i;
            break;
        }
    }
    
    // Determine which lines are commanders vs library cards
    const isCommanderSection = (index) => {
        // Cards marked with (CMDR) are always commanders
        if (/\(CMDR\)/i.test(lines[index])) {
            return true;
        }
        // If there's an empty line and this card is after it (and it's the last section), it's a commander
        if (lastEmptyLineIndex >= 0 && index > lastEmptyLineIndex) {
            return true;
        }
        return false;
    };
    
    lines
        .forEach((line, index) => {
            if (!line) return; // Skip empty lines
            
            const isCommander = isCommanderSection(index);
            
            // Parse count and card name, e.g. "2 Arcane Signet" or "1x Arcane Signet" or "Arcane Signet"
            const countMatch = line.match(/^(\d+)\s*x?\s*(.+)$/);
            let cardName, count;
            
            if (countMatch) {
                count = parseInt(countMatch[1]);
                cardName = countMatch[2];
            } else {
                // No count specified, assume 1 copy
                count = 1;
                cardName = line;
            }
            
            // Remove set codes like "(M21)" and commander marker "(CMDR)"
            cardName = cardName.replace(/\s+\([^)]*\)$/g, '').trim();
            
            // Add the specified number of copies to the appropriate zone
            const targetArray = isCommander ? commanders : decklist;
            for (let i = 0; i < count; i++) {
                targetArray.push(cardName);
            }
        });
    if (roomName && (decklist.length > 0 || commanders.length > 0)) {
        socket.emit('join', { roomName, displayName, decklist, commanders });
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

// Placeholder card event listeners
createPlaceholderBtn.addEventListener('click', () => {
    optionsModal.classList.add('hidden');
    placeholderModal.classList.remove('hidden');
    placeholderTextInput.focus();
});

confirmPlaceholderBtn.addEventListener('click', () => {
    const text = placeholderTextInput.value.trim();
    if (text) {
        createPlaceholderCard(text);
        placeholderModal.classList.add('hidden');
        placeholderTextInput.value = '';
    }
});

cancelPlaceholderBtn.addEventListener('click', () => {
    placeholderModal.classList.add('hidden');
    placeholderTextInput.value = '';
});

// Allow Enter key to confirm placeholder creation
placeholderTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = placeholderTextInput.value.trim();
        if (text) {
            createPlaceholderCard(text);
            placeholderModal.classList.add('hidden');
            placeholderTextInput.value = '';
        }
    }
});

resetBtnModal.addEventListener('click', () => {
    // Collect all non-commander cards from hand, playZone, graveyard, and exile
    let allNonCommanderCards = [];
    let commanderCards = [];

    // Process cards from hand
    hand.forEach(card => {
        if (card.isCommander) {
            commanderCards.push(card);
        } else {
            allNonCommanderCards.push(card);
        }
    });
    hand.length = 0; // Clear hand

    // Process cards from playZone - convert back to basic card objects (excluding placeholder cards)
    let placeholderCardsRemoved = 0;
    playZone.forEach(card => {
        if (card.isPlaceholder) {
            placeholderCardsRemoved++;
        } else if (card.isCommander) {
            // Create a clean commander card object for command zone storage
            commanderCards.push({
                id: card.id,
                name: card.name,
                displayName: card.displayName || card.name,
                isCommander: true
            });
        } else {
            // Create a clean card object for library storage
            allNonCommanderCards.push({
                id: card.id,
                name: card.name,
                displayName: card.displayName || card.name,
            });
        }
    });
    playZone.length = 0; // Clear playZone

    // Process cards from graveyard
    graveyard.forEach(card => {
        if (card.isCommander) {
            commanderCards.push(card);
        } else {
            allNonCommanderCards.push(card);
        }
    });
    graveyard.length = 0; // Clear graveyard
    
    // Process cards from exile
    exile.forEach(card => {
        if (card.isCommander) {
            commanderCards.push(card);
        } else {
            allNonCommanderCards.push(card);
        }
    });
    exile.length = 0; // Clear exile
    
    // Process cards from command zone (these should all be commanders, but check anyway)
    command.forEach(card => {
        commanderCards.push(card);
    });
    command.length = 0; // Clear command zone

    // Shuffle all non-commander cards
    shuffleArray(allNonCommanderCards);

    // Move all shuffled non-commander cards into the library
    library.push(...allNonCommanderCards);
    
    // Move all commander cards back to the command zone
    command.push(...commanderCards);

    // Reset cascadedHandCardsInAreaCount as all cards are now in library or command zone
    cascadedHandCardsInAreaCount = 0;

    // Send the updated state to the server
    sendMove();

    // Re-render the UI
    render();

    let message = "Your cards have been shuffled into your library!";
    if (commanderCards.length > 0) {
        message += ` ${commanderCards.length} commander${commanderCards.length > 1 ? 's' : ''} returned to command zone.`;
    }
    if (placeholderCardsRemoved > 0) {
        message += ` Removed ${placeholderCardsRemoved} placeholder card${placeholderCardsRemoved > 1 ? 's' : ''}.`;
    }
    showMessage(message);
    optionsModal.classList.add('hidden'); // Close options modal after reset
});

function updateMagnifyStatusUI() {
    if (isMagnifyEnabled) {
        magnifyStatusEl.textContent = 'On';
        magnifyStatusEl.classList.remove('bg-red-600');
        magnifyStatusEl.classList.add('bg-green-600');
        // Show the magnify size slider
        magnifySizeSliderContainer.classList.remove('hidden');
    } else {
        magnifyStatusEl.textContent = 'Off';
        magnifyStatusEl.classList.remove('bg-green-600');
        magnifyStatusEl.classList.add('bg-red-600');
        // Hide the magnify size slider
        magnifySizeSliderContainer.classList.add('hidden');
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

// Magnify size slider event listeners
magnifySizeSlider.addEventListener('input', (e) => {
    const width = parseInt(e.target.value);
    magnifyPreviewWidth = width;
    // Calculate height maintaining card aspect ratio (80:107, which is standard Magic card ratio)
    magnifyPreviewHeight = Math.round(width * (107 / 80));
});

magnifySizeSlider.addEventListener('change', (e) => {
    // Update the global variable that cardFactory.js will use
    window.magnifyPreviewSize = {
        width: magnifyPreviewWidth,
        height: magnifyPreviewHeight
    };
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
        playZone,
        life: currentLife
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
    
    // If it's a placeholder card being moved out of play zone, remove it entirely
    if (sourceZone === 'play' && targetZone !== 'play' && cardObj.isPlaceholder) {
        sendMove();
        selectedCardIds = [];
        render();
        return;
    }
    
    // Reset rotation (tapped state) when moving from battlefield to any other zone
    if (sourceZone === 'play' && targetZone !== 'play') {
        cardObj.rotation = 0;
    }
    
    // Reset counters when moving out of the play zone
    if (sourceZone === 'play' && targetZone !== 'play') {
        if (cardObj.counters) {
            delete cardObj.counters;
        }
    }
    
    // Turn cards face up when moving out of the play zone
    if (sourceZone === 'play' && targetZone !== 'play') {
        cardObj.faceShown = 'front';
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
            // If it's a placeholder card being moved out of play zone, skip adding it to cardsToMove (it will be removed)
            if (sourceZone === 'play' && targetZone !== 'play' && cardObj.isPlaceholder) {
                return; // Skip this card, it will be removed entirely
            }
            
            // Reset rotation (tapped state) when moving from battlefield to any other zone
            if (sourceZone === 'play' && targetZone !== 'play') {
                cardObj.rotation = 0;
            }
            
            // Reset counters when moving out of the play zone
            if (sourceZone === 'play' && targetZone !== 'play') {
                if (cardObj.counters) {
                    delete cardObj.counters;
                }
            }
            
            // Turn cards face up when moving out of the play zone
            if (sourceZone === 'play' && targetZone !== 'play') {
                cardObj.faceShown = 'front';
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

async function render() {
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
    
    // Load heart SVG if not already loaded
    await loadHeartSVG();
    
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
            
            // Update life total from server for current player
            if (gameState.players[playerId]?.life !== undefined) {
                currentLife = gameState.players[playerId].life;
                lifeTotalEl.textContent = currentLife;
            }
            
            if (viewedPlayerId === playerId) {
                // Viewing our own zones
                library = serverLibrary;
                graveyard = serverGraveyard;
                exile = serverExile;
                command = serverCommand || []; // Ensure command is always an array
                playZone = serverPlayZone;
            } else {
                // Viewing another player's zones - use their data for zones but keep our hand
                // Shuffle the library to randomize the order when viewing other players
                library = [...serverLibrary]; // Create a copy to avoid modifying server data
                shuffleArray(library); // Randomize the order
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
                onCounterClick: handleCounterClick,
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
                onCounterClick: isInteractable ? handleCounterClick : null,
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
        tabEl.className = 'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2';
        
        // Use display name for all players (including yourself)
        const playerName = gameState.players[pid].displayName;
        const isCurrentPlayer = pid === playerId;
        const displayName = isCurrentPlayer ? `${playerName} (you)` : playerName;
        const handCount = gameState.players[pid].hand?.length || 0;
        const lifeTotal = gameState.players[pid].life || 20;
        
        // Create the tab content with name, life (heart icon), and hand count
        tabEl.innerHTML = `
            <span>${displayName}</span>
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                    <img src="heart.svg" alt="♥" class="w-3.5 h-3.5" style="filter: hue-rotate(0deg) saturate(2) brightness(0.8);">
                    <span class="text-xs font-bold">${lifeTotal}</span>
                </div>
                <div class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                        <path d="m608-368 46-166-142-98-46 166 142 98ZM160-207l-33-16q-31-13-42-44.5t3-62.5l72-156v279Zm160 87q-33 0-56.5-24T240-201v-239l107 294q3 7 5 13.5t7 12.5h-39Zm206-5q-31 11-62-3t-42-45L245-662q-11-31 3-61.5t45-41.5l301-110q31-11 61.5 3t41.5 45l178 489q11 31-3 61.5T827-235L526-125Zm-28-75 302-110-179-490-301 110 178 490Zm62-300Z"/>
                    </svg>
                    <span class="text-xs">${handCount}</span>
                </div>
            </div>
        `;
        
        // Highlight current turn player if turn order is set
        if (gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined && gameState.turnOrder[gameState.currentTurn] === pid) {
            tabEl.classList.add('ring-2', 'ring-yellow-400');
        }
        
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
                        
                        // Reset counters when moving from non-play zones to play zone
                        if (groupData.sourceZone !== 'play' && cardCopy.counters) {
                            delete cardCopy.counters;
                        }
                        
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
                        
                        // If it's a placeholder card being moved out of play zone, remove it entirely
                        if (groupData.sourceZone === 'play' && cardObj.isPlaceholder) {
                            removeCardFromSource(cardId, groupData.sourceZone);
                            showMessage(`Removed placeholder card: "${cardObj.displayName || cardObj.name}"`);
                            return;
                        }
                        
                        removeCardFromSource(cardId, groupData.sourceZone);
                        // Create a copy to avoid reference issues
                        const cardCopy = { ...cardObj };
                        
                        // Reset counters when moving out of the play zone
                        if (groupData.sourceZone === 'play' && cardCopy.counters) {
                            delete cardCopy.counters;
                        }
                        
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
                    
                    // Reset counters when moving out of the play zone (but not when moving within play zone)
                    if (sourceZone === 'play') {
                        // Cards moving within play zone keep their counters
                        cardObj.x = x;
                        cardObj.y = y;
                    } else {
                        // Cards coming from other zones start with no counters
                        if (cardObj.counters) {
                            delete cardObj.counters;
                        }
                        cardObj.x = x;
                        cardObj.y = y;
                    }
                    
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

// Create a temporary placeholder card
async function createPlaceholderCard(text) {
    const placeholderCard = {
        id: generateCardId(),
        name: text,
        displayName: text,
        isPlaceholder: true, // Mark this as a placeholder card
        x: 50, // Default position
        y: 50,
        rotation: 0
    };
    
    // Add to play zone immediately (shows as placeholder initially)
    playZone.push(placeholderCard);
    
    // Re-render to show the placeholder card
    render();
    
    // Try to load Scryfall data for this card in the background
    try {
        await ScryfallCache.load([text]);
        const scryfallData = ScryfallCache.get(text);
        if (scryfallData) {
            // Re-render to show the actual card image
            render();
        } 
    } catch (error) {
        console.error('Error loading Scryfall data for placeholder:', error);
    }
    
    // Send update to server
    sendMove();
}

// Create copies of selected cards
async function createCopiesOfSelectedCards() {
    if (selectedCards.length === 0) return;
    
    let copiesCreated = 0;
    const cascadeOffset = 15;
    
    for (let index = 0; index < selectedCards.length; index++) {
        const cardEl = selectedCards[index];
        const cardId = cardEl.dataset.id;
        const originalCard = findCardObjectById(cardId);
        
        if (originalCard) {
            // Create a copy with the same visual properties but marked as a copy
            const copyCard = {
                id: generateCardId(),
                name: originalCard.name,
                displayName: originalCard.displayName || originalCard.name,
                isPlaceholder: true, // Mark as placeholder so it disappears when moved out of play
                isCopy: true, // Mark as a copy
                faceShown: originalCard.faceShown || 'front', // Preserve which face is shown
                x: (originalCard.x || 50) + cascadeOffset + (index * 10), // Offset position slightly
                y: (originalCard.y || 50) + cascadeOffset + (index * 10),
                rotation: 0 // Copies start untapped
            };
            
            // If the original card has counters, don't copy them (copies start fresh)
            
            // Add to play zone
            playZone.push(copyCard);
            copiesCreated++;
            
            // Try to load Scryfall data for this card in the background if not already cached
            try {
                if (!ScryfallCache.get(originalCard.name)) {
                    await ScryfallCache.load([originalCard.name]);
                }
            } catch (error) {
                console.error('Error loading Scryfall data for copy:', error);
            }
        }
    }
    
    if (copiesCreated > 0) {
        // Clear selection after creating copies
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards = [];
        selectedCardIds = [];
        
        // Send update to server
        sendMove();
        
        // Re-render to show the new copies
        render();        
    }
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
let currentLife = 40; // Track current life total
let currentCardWidth = 80;
const minCardWidth = 60;
const maxCardWidth = 200; // Increased from 120 to allow much larger cards
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
    
    // Initialize magnify size slider and global variable
    window.magnifyPreviewSize = {
        width: magnifyPreviewWidth,
        height: magnifyPreviewHeight
    };
    
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
    } else if (e.code === 'KeyX' && selectedCards.length > 0) {
        e.preventDefault();
        // Create copies asynchronously to allow for Scryfall image loading
        createCopiesOfSelectedCards().catch(error => {
            console.error('Error creating copies:', error);
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

// Life tracker event listeners
increaseLifeBtn.addEventListener('click', () => {
    currentLife++;
    lifeTotalEl.textContent = currentLife;
    sendMove();
});

decreaseLifeBtn.addEventListener('click', () => {
    currentLife--;
    lifeTotalEl.textContent = currentLife;
    sendMove();
});

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
    libraryOption.textContent = 'Send to Library (Top)';
    libraryOption.addEventListener('click', () => {
        moveSelectedCardsToZone('library');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(libraryOption);
    
    // Move to Bottom of Library option
    const libraryBottomOption = document.createElement('button');
    libraryBottomOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    libraryBottomOption.textContent = 'Send to Library (Bottom)';
    libraryBottomOption.addEventListener('click', () => {
        moveSelectedCardsToZone('library-bottom');
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(libraryBottomOption);
    
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
    
    // Add separator
    const separator = document.createElement('div');
    separator.className = 'border-t border-gray-600 my-1';
    cardContextMenu.appendChild(separator);
    
    // Add Counter option
    const addCounterOption = document.createElement('button');
    addCounterOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    addCounterOption.textContent = 'Add Counter';
    addCounterOption.addEventListener('click', () => {
        addCounterToSelectedCards();
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(addCounterOption);
    
    // Remove Counter option (only show if any selected card has counters)
    const hasCounters = selectedCards.some(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        return cardObj && cardObj.counters && cardObj.counters > 0;
    });
    
    if (hasCounters) {
        const removeCounterOption = document.createElement('button');
        removeCounterOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
        removeCounterOption.textContent = 'Remove Counter';
        removeCounterOption.addEventListener('click', () => {
            removeCounterFromSelectedCards();
            hideCardContextMenu();
        });
        cardContextMenu.appendChild(removeCounterOption);
    }
    
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

// Helper function to find card object by ID across all zones
function findCardObjectById(cardId) {
    // Check all zones for the card
    const zones = [hand, playZone, graveyard, exile, command, library];
    
    for (const zone of zones) {
        const card = zone.find(c => c.id === cardId);
        if (card) return card;
    }
    
    return null;
}

// Counter click handler
function handleCounterClick(e, card, isDecrement) {
    e.preventDefault();
    e.stopPropagation();
    
    const cardObj = findCardObjectById(card.id);
    if (!cardObj) return;
    
    if (isDecrement) {
        // Decrement counter (Shift+click)
        if (cardObj.counters && cardObj.counters > 0) {
            cardObj.counters -= 1;
            if (cardObj.counters === 0) {
                delete cardObj.counters;
            }
        }
    } else {
        // Increment counter (normal click)
        if (typeof cardObj.counters !== 'number') {
            cardObj.counters = 0;
        }
        cardObj.counters += 1;
    }
    
    // Send the updated state to server
    sendMove();
    
    // Re-render to show the counter change
    render();
}

// Counter management functions for context menu
function addCounterToSelectedCards() {
    if (selectedCards.length === 0) return;
    
    let cardsUpdated = 0;
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        
        if (cardObj) {
            // Initialize counters property if it doesn't exist
            if (typeof cardObj.counters !== 'number') {
                cardObj.counters = 0;
            }
            cardObj.counters += 1;
            cardsUpdated++;
        }
    });
    
    if (cardsUpdated > 0) {
        // Clear selection after adding counters
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards = [];
        selectedCardIds = [];
        
        // Send the updated state to server
        sendMove();
        
        // Re-render the game to show the counters
        render();
    }
}

function removeCounterFromSelectedCards() {
    if (selectedCards.length === 0) return;
    
    let cardsUpdated = 0;
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        
        if (cardObj && cardObj.counters && cardObj.counters > 0) {
            cardObj.counters -= 1;
            
            // Remove counters property if it reaches 0
            if (cardObj.counters === 0) {
                delete cardObj.counters;
            }
            cardsUpdated++;
        }
    });
    
    if (cardsUpdated > 0) {
        // Clear selection after removing counters
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards = [];
        selectedCardIds = [];
        
        // Send the updated state to server
        sendMove();
        
        // Re-render the game to show the counters
        render();
        
        // Show confirmation message
        showMessage(`Removed counters from ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}`);
    }
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
    
    // Filter out placeholder cards that are being moved out of play zone and count them
    let placeholderCardsRemoved = 0;
    let placeholderNames = [];
    
    const validCardsToMove = cardsToMove.filter(({ cardObj, sourceZone }) => {
        if (sourceZone === 'play' && targetZone !== 'play' && cardObj.isPlaceholder) {
            placeholderCardsRemoved++;
            placeholderNames.push(cardObj.displayName || cardObj.name);
            return false; // Don't move placeholder cards, just remove them
        }
        return true;
    });
    
    // Add all valid cards to the target zone
    validCardsToMove.forEach(({ cardObj, sourceZone }) => {
        // Reset rotation (tapped state) when moving from battlefield to any other zone
        if (sourceZone === 'play' && targetZone !== 'play') {
            cardObj.rotation = 0;
        }
        
        // Reset counters when moving out of the play zone
        if (sourceZone === 'play' && targetZone !== 'play') {
            if (cardObj.counters) {
                delete cardObj.counters;
            }
        }
        
        // Turn cards face up when moving out of the play zone
        if (sourceZone === 'play' && targetZone !== 'play') {
            cardObj.faceShown = 'front';
        }
        
        if (targetZone === 'hand') {
            hand.push(cardObj);
        } else if (targetZone === 'play') {
            // For play zone, ensure position is set
            if (cardObj.x === undefined || cardObj.y === undefined) {
                cardObj.x = 0;
                cardObj.y = 0;
            }
            playZone.push(cardObj);
        } else if (targetZone === 'library') {
            library.push(cardObj);
        } else if (targetZone === 'library-bottom') {
            library.unshift(cardObj); // Add to the beginning of array (bottom of library)
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
    const validCardCount = validCardsToMove.length;
    let message = '';
    
    if (validCardCount > 0) {
        const zoneName = targetZone === 'hand' ? 'hand' : 
                         targetZone === 'library' ? 'top of library' :
                         targetZone === 'library-bottom' ? 'bottom of library' :
                         targetZone === 'graveyard' ? 'graveyard' :
                         targetZone === 'exile' ? 'exile' :
                         targetZone === 'command' ? 'command zone' :
                         targetZone === 'play' ? 'battlefield' : targetZone;
        message = `Moved ${validCardCount} card${validCardCount > 1 ? 's' : ''} to ${zoneName}`;
    }
    
    if (placeholderCardsRemoved > 0) {
        const placeholderMessage = `Removed ${placeholderCardsRemoved} placeholder card${placeholderCardsRemoved > 1 ? 's' : ''}`;
        message = message ? `${message}. ${placeholderMessage}` : placeholderMessage;
    }
    
    if (message) {
        showMessage(message);
    }
}


