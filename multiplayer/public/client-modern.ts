// Modern clean client implementation using state classes and CardZone
import { VdClient } from './lib/state/socketclient.js';
import { CommanderSelectionModal } from './lib/ui/commanderSelectionModal.js';
import { JoinGameUI } from './lib/ui/joinGameUI.js';
import { SettingsManager } from './lib/ui/settingsManager.js';
import { DOMCardManager } from './lib/ui/domCardManager.js';
import { Game } from './lib/state/game.js';
import { Player } from './lib/state/player.js';
import { Card } from './lib/state/card.js';
import { Zone } from './lib/state/socketinterface.js';
import { CardZone } from './lib/ui/cardZone.js';
import { io } from 'socket.io-client';

// Global state
const socket = io();
let vdClient = new VdClient(socket);
let commanderModal = new CommanderSelectionModal(vdClient);
let joinGameUI = new JoinGameUI(socket, commanderModal);
let settingsManager = new SettingsManager();
let cardManager = new DOMCardManager();
let room: string | null = null;
let playerId: string | null = null;

// Game state using modern classes
let game: Game | undefined;
let player: Player | undefined;
let activePlayZonePlayerId: string | null = null;
let currentlyViewedPlayerId: string | null = null;

// Modern zone management
let zones: Map<Zone, CardZone> = new Map();

// Declare window interface extensions
declare global {
    interface Window {
        gameState: Game | undefined;
    }
}

// Initialize the application
async function init() {
    console.log('Initializing modern Vizzerdrix client...');
    
    // Set up basic event listeners
    setupSocketHandlers();
    setupUIEventHandlers();
    
    // Initialize settings
    // settingsManager.loadSettings?.();
    
    // Set up emergency modal cleanup (in case something gets stuck)
    setupEmergencyModalCloser();
    
    setInterval(() => {
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal && !loadingModal.classList.contains('hidden')) {
            const messageElements = loadingModal.querySelectorAll('[id*="loading"]');
            const currentText = Array.from(messageElements).map(el => el.textContent).join(' ');
            
            // If loading modal has been showing "Joining" message for more than 30 seconds, hide it
            if (currentText.includes('Joining') && window.performance.now() > 30000) {
                console.warn('⚠️ Force hiding stuck loading modal');
                hideAllModals();
                showMessage('Connection timeout. Please try again.');
            }
        }
    }, 5000); // Check every 5 seconds
    
    console.log('Modern client initialized successfully');
}

function setupSocketHandlers() {
    socket.on('connect', () => {
        playerId = socket.id || null;
        activePlayZonePlayerId = socket.id || null;
        console.log('Client connected. Player ID:', playerId);
    });
    
    // Set up VdClient state update listener
    vdClient.addOnUpdateListener('main', (updatedGame: Game) => {
        console.log('VdClient state update received:', updatedGame);
        handleGameStateUpdate(updatedGame);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        showMessage("Disconnected from Vizzerdrix. You can rejoin by entering the same room name and display name.");
    });
}

function setupUIEventHandlers() {
    // Set up join game UI callbacks
    joinGameUI.setCallbacks({
        onGameJoined: (joinedGame: Game, joinedPlayer: Player) => {
            console.log("✅ Game joined successfully via JoinGameUI");
            game = joinedGame;
            player = joinedPlayer;
            room = game.roomName;
            console.log('Player details:', { 
                name: player.name, 
                handSize: player.getZone(Zone.hand).length,
                librarySize: player.getZone(Zone.library).length
            });
            
            // Hide any remaining modals
            hideAllModals();
            
            // Initialize zones after joining
            initializeZones();
            
            // Initial render
            render();
            
            console.log('✅ Game initialization complete');
        },
        showMessage: showMessage
    });
    
    // Set up settings manager callbacks
    settingsManager.setCallbacks({
        onMagnifyChange: (enabled: boolean) => {
            // Update all zones
            zones.forEach(zone => zone.updateMagnifyEnabled(enabled));
        },
        onCardWidthChange: (width: number) => {
            // Update all zones
            zones.forEach(zone => zone.updateCardWidth(width));
        },
        onSnapToGridChange: (enabled: boolean) => {
            // Update grid visuals
            updateGridVisuals(enabled);
        },
        showBottomBarContextMenu: () => {
            // TODO: Implement context menu
        },
        autoFitSevenCards: () => {
            // TODO: Implement auto-fit
        },
        updateImageQualityCutoffs: () => {
            // TODO: Implement image quality updates
        },
        updateGridVisuals: () => {
            updateGridVisuals(settingsManager.getSetting('isSnapToGridEnabled'));
        },
        debouncedRender: () => {
            render();
        }
    });
}

function initializeZones() {
    if (!player) return;
    
    console.log('Initializing modern card zones...');
    
    // Clear existing zones
    zones.forEach(zone => zone.destroy());
    zones.clear();
    
    // Initialize library zone
    const libraryEl = document.getElementById('library');
    const libraryCountEl = document.getElementById('library-count');
    if (libraryEl) {
        const libraryZone = new CardZone(libraryEl, 'library', {
            countElement: libraryCountEl,
            enablePeek: true,
            peekHoldTime: 200,
            currentCardWidth: settingsManager.getSetting('currentCardWidth'),
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            showMessage: showMessage,
            onCardDraw: handleCardDraw,
            onStateChange: handleZoneStateChange,
            cardManager: cardManager
        });
        zones.set(Zone.library, libraryZone);
    }
    
    // Initialize graveyard zone
    const graveyardEl = document.getElementById('graveyard-pile');
    const graveyardCountEl = document.getElementById('graveyard-count');
    if (graveyardEl) {
        const graveyardZone = new CardZone(graveyardEl, 'graveyard', {
            countElement: graveyardCountEl,
            enablePeek: true,
            peekHoldTime: 200,
            showShuffle: false,
            showTopCard: true,
            currentCardWidth: settingsManager.getSetting('currentCardWidth'),
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            showMessage: showMessage,
            onCardDraw: handleCardDraw,
            onStateChange: handleZoneStateChange,
            cardManager: cardManager
        });
        zones.set(Zone.graveyard, graveyardZone);
    }
    
    // Initialize exile zone
    const exileEl = document.getElementById('exile-pile');
    const exileCountEl = document.getElementById('exile-count');
    if (exileEl) {
        const exileZone = new CardZone(exileEl, 'exile', {
            countElement: exileCountEl,
            enablePeek: true,
            peekHoldTime: 200,
            showShuffle: false,
            showTopCard: true,
            currentCardWidth: settingsManager.getSetting('currentCardWidth'),
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            showMessage: showMessage,
            onCardDraw: handleCardDraw,
            onStateChange: handleZoneStateChange,
            cardManager: cardManager
        });
        zones.set(Zone.exile, exileZone);
    }
    
    // Initialize command zone
    const commandEl = document.getElementById('command-pile');
    const commandCountEl = document.getElementById('command-count');
    if (commandEl) {
        const commandZone = new CardZone(commandEl, 'command', {
            countElement: commandCountEl,
            enablePeek: true,
            peekHoldTime: 200,
            showShuffle: false,
            showTopCard: true,
            currentCardWidth: settingsManager.getSetting('currentCardWidth'),
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            showMessage: showMessage,
            onCardDraw: handleCardDraw,
            onStateChange: handleZoneStateChange,
            cardManager: cardManager
        });
        zones.set(Zone.command, commandZone);
    }
    
    console.log(`Initialized ${zones.size} card zones`);
}

function handleGameStateUpdate(updatedGame: Game) {
    console.log('Received game state update via VdClient:', updatedGame);
    
    // Update the global game reference
    game = updatedGame;
    player = game.getPlayer(playerId || '');
    
    // Update window reference for backwards compatibility
    window.gameState = game;
    
    console.log('Updated game and player state:', { 
        roomName: game.roomName, 
        playerId: playerId, 
        playerExists: !!player,
        playerName: player?.name 
    });
    
    // Hide any loading modals when we get game state
    hideAllModals();
    
    // Trigger a render
    render();
}

function handleCardDraw(card: any, targetZone: string, options: any = {}) {
    console.log(`Drawing card from zone to ${targetZone}:`, card);
    
    // TODO: Implement card movement using vdClient
    // This would send updates to the server through the state classes
    
    // For now, just re-render
    render();
}

function handleZoneStateChange(action: string, cardIdOrIds: string | string[], sourceZone: string, targetZone: string) {
    console.log(`Zone state change: ${action} from ${sourceZone} to ${targetZone}`, cardIdOrIds);
    
    // TODO: Implement zone state changes using vdClient
    // This would update the state classes and send to server
    
    // For now, just re-render
    render();
}

async function render() {
    if (!game || !player) {
        console.log('Render skipped: missing game or player');
        return;
    }
    
    console.log('Rendering with modern system...');
    
    try {
        // Update all zones with current data
        updateZones();
        
        // Render hand
        renderHand();
        
        // Render battlefield
        renderBattlefield();
        
        // Update player UI
        updatePlayerUI();
        
        console.log('Modern render complete');
        
    } catch (error) {
        console.error('Render error:', error);
    }
}

function updateZones() {
    if (!player) return;
    
    const viewedPlayerId = currentlyViewedPlayerId || playerId;
    const viewedPlayer = viewedPlayerId ? game?.getPlayer(viewedPlayerId) : null;
    if (!viewedPlayer) return;
    
    // Update each zone with cards from the state classes
    for (const [zoneType, cardZone] of zones) {
        const cards = viewedPlayer.getZone(zoneType);
        
        // Convert Card objects to legacy format for CardZone compatibility
        const legacyCards = cards.map(card => ({
            id: card.id,
            name: card.cardName,
            displayName: card.cardName,
            x: card.location.x,
            y: card.location.y,
            rotation: card.tapped ? 90 : 0,
            counters: card.counters,
            faceShown: card.flipped ? 'back' : 'front',
            zone: card.zone,
            isCommander: card.commander,
            isTemporary: card.isTemporary
        }));
        
        cardZone.updateCards(legacyCards);
        cardZone.setInteractionEnabled(viewedPlayerId === playerId);
        
        console.log(`Updated ${zoneType} with ${legacyCards.length} cards`);
    }
}

function renderHand() {
    if (!player) return;
    
    const handZoneEl = document.getElementById('hand-zone');
    if (!handZoneEl) return;
    
    const handCards = player.getZone(Zone.hand);
    console.log(`Rendering hand with ${handCards.length} cards`);
    
    // Clear and rebuild hand
    handZoneEl.innerHTML = '';
    
    // Add hand guideline
    const handGuideline = document.createElement('div');
    handGuideline.className = 'hand-guideline';
    handZoneEl.appendChild(handGuideline);
    
    // Render each card in hand using cardManager
    cardManager.renderCardsToContainer(
        handCards,
        handZoneEl,
        Zone.hand,
        {
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            isInteractable: true,
            onCardClick: handleCardClick,
            onCardDblClick: handleCardDoubleClick,
            onCardDragStart: handleCardDragStart,
            showBack: false,
            playerSelections: {},
            playerColors: {}
        }
    );
}

function renderBattlefield() {
    if (!game || !activePlayZonePlayerId) return;
    
    const playZonesContainer = document.getElementById('play-zones-container');
    if (!playZonesContainer) return;
    
    const activePlayer = game.getPlayer(activePlayZonePlayerId);
    if (!activePlayer) return;
    
    const battlefieldCards = activePlayer.getZone(Zone.battlefield);
    console.log(`Rendering battlefield with ${battlefieldCards.length} cards for ${activePlayZonePlayerId}`);
    
    // Create or find player zone
    let playerZoneEl = document.getElementById(`player-zone-${activePlayZonePlayerId}`);
    if (!playerZoneEl) {
        playerZoneEl = document.createElement('div');
        playerZoneEl.id = `player-zone-${activePlayZonePlayerId}`;
        playerZoneEl.className = 'player-zone';
        playerZoneEl.style.position = 'relative';
        playerZoneEl.style.width = '100%';
        playerZoneEl.style.height = '100vh';
        
        playZonesContainer.innerHTML = '';
        playZonesContainer.appendChild(playerZoneEl);
    }
    
    // Render battlefield cards
    cardManager.renderCardsToContainer(
        battlefieldCards,
        playerZoneEl,
        Zone.battlefield,
        {
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            isInteractable: activePlayZonePlayerId === playerId,
            onCardClick: handleCardClick,
            onCardDblClick: handleCardDoubleClick,
            onCardDragStart: handleCardDragStart,
            showBack: false,
            playerSelections: {},
            playerColors: {}
        }
    );
}

function updatePlayerUI() {
    if (!game) return;
    
    const playerTabsEl = document.getElementById('player-tabs');
    if (!playerTabsEl) return;
    
    playerTabsEl.innerHTML = '';
    
    // Get player order
    let playerOrder: string[] = [];
    if (game.turnOrder.length > 0) {
        playerOrder = game.turnOrder.map(p => p.id);
    } else {
        playerOrder = Object.keys(game.players);
    }
    
    // Create player tabs
    for (const pid of playerOrder) {
        const gamePlayer = game.getPlayer(pid);
        if (!gamePlayer) continue;
        
        const playerTab = document.createElement('button');
        playerTab.className = 'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2';
        playerTab.setAttribute('data-player-id', pid);
        
        const playerName = gamePlayer.name;
        const isCurrentPlayer = pid === playerId;
        const displayName = isCurrentPlayer ? `${playerName} (you)` : playerName;
        const handCount = gamePlayer.getZone(Zone.hand).length;
        const lifeTotal = gamePlayer.lifeTotal;
        
        playerTab.innerHTML = `
            <span>${displayName}</span>
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                    <span style="color: #ef4444;">♥</span>
                    <span class="text-xs font-bold">${lifeTotal}</span>
                </div>
                <div class="flex items-center gap-1">
                    <span style="color: #3b82f6;">🖐️</span>
                    <span class="text-xs">${handCount}</span>
                </div>
            </div>
        `;
        
        // Set active/inactive styling
        if (pid === activePlayZonePlayerId) {
            playerTab.classList.add('bg-blue-600', 'text-white');
        } else {
            playerTab.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
        
        // Click handler to switch active player
        playerTab.addEventListener('click', () => {
            if (activePlayZonePlayerId !== pid) {
                activePlayZonePlayerId = pid;
                currentlyViewedPlayerId = pid;
                render();
            }
        });
        
        playerTabsEl.appendChild(playerTab);
    }
}

// Event handlers
function handleCardClick(card: Card, element: HTMLElement, event: MouseEvent) {
    console.log('Card clicked:', card.cardName);
    // TODO: Implement card selection
}

function handleCardDoubleClick(card: Card, element: HTMLElement, event: MouseEvent) {
    console.log('Card double-clicked:', card.cardName);
    // TODO: Implement card action (e.g., play from hand)
}

function handleCardDragStart(card: Card, element: HTMLElement, event: DragEvent) {
    console.log('Card drag started:', card.cardName);
    // TODO: Implement drag handling
}

// Utility functions
function showMessage(message: string) {
    const messageModal = document.getElementById('message-modal');
    const messageText = document.getElementById('message-text');
    
    if (messageModal && messageText) {
        messageText.textContent = message;
        messageModal.classList.remove('hidden');
    } else {
        // Fallback to console if modal not available
        console.log('Message:', message);
    }
}

function hideAllModals() {
    // Hide loading modal
    const loadingModal = document.getElementById('loading-modal');
    if (loadingModal) {
        loadingModal.classList.add('hidden');
    }
    
    // Hide commander selection modal
    const commanderModal = document.getElementById('commander-selection-modal');
    if (commanderModal) {
        commanderModal.classList.add('hidden');
    }
    
    // Hide message modal
    const messageModal = document.getElementById('message-modal');
    if (messageModal) {
        messageModal.classList.add('hidden');
    }
    
    console.log('All modals hidden');
}

// Emergency modal closer - click anywhere on loading modal to close it
function setupEmergencyModalCloser() {
    const loadingModal = document.getElementById('loading-modal');
    if (loadingModal) {
        loadingModal.addEventListener('click', (e) => {
            // Only close if clicking the modal background, not its content
            if (e.target === loadingModal) {
                console.warn('⚠️ Emergency close: User clicked to close loading modal');
                hideAllModals();
                showMessage('Join process cancelled. Please try again.');
            }
        });
    }
}

function updateGridVisuals(enabled: boolean) {
    const playZonesContainer = document.getElementById('play-zones-container');
    if (playZonesContainer) {
        if (enabled) {
            playZonesContainer.classList.add('snap-grid-enabled');
        } else {
            playZonesContainer.classList.remove('snap-grid-enabled');
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
(window as any).modernClient = {
    game,
    player,
    zones,
    vdClient,
    render
};