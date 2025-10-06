// Modern clean client implementation using state classes and CardZone
import { VdClient } from './lib/state/socketclient.js';
import { CommanderSelectionModal } from './lib/ui/commanderSelectionModal.js';
import { JoinGameUI } from './lib/ui/joinGameUI.js';
import { SettingsManager } from './lib/ui/settingsManager.js';
import { DOMCardManager } from './lib/ui/domCardManager.js';
import { InteractionManager } from './lib/ui/interactionManager.js';
import { ZoneManager } from './lib/ui/zoneManager.js';
import { Game } from './lib/state/game.js';
import { Player } from './lib/state/player.js';
import { Card } from './lib/state/card.js';
import { Zone } from './lib/state/socketinterface.js';
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

// Managers
let interactionManager: InteractionManager;
let zoneManager: ZoneManager;

// Declare window interface extensions
declare global {
    interface Window {
        gameState: Game | undefined;
    }
}

// Initialize the application
async function init() {
    console.log('Initializing modern Vizzerdrix client...');
    
    // Initialize managers
    initializeManagers();
    
    // Set up basic event listeners
    setupSocketHandlers();
    setupUIEventHandlers();
    setupSettingsCallbacks();
    
    // Initialize settings
    console.log('Initializing settings manager...');
    console.log('Default card width:', settingsManager.getSetting('currentCardWidth'));
    console.log('Magnify enabled:', settingsManager.getSetting('isMagnifyEnabled'));
    
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

function initializeManagers() {
    // Create interaction manager
    interactionManager = new InteractionManager(vdClient, cardManager, {
        render: render,
        showMessage: showMessage,
        getCurrentPlayer: () => player,
        getCurrentGame: () => game,
        getActivePlayZonePlayerId: () => activePlayZonePlayerId,
        getCurrentlyViewedPlayerId: () => currentlyViewedPlayerId,
        getPlayerId: () => playerId
    });
    
    // Create zone manager
    zoneManager = new ZoneManager(interactionManager, cardManager, settingsManager, {
        showMessage: showMessage
    });
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
    console.log('Setting up UI event handlers...');
    
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
            zoneManager.initializeZones();
            
            // Set up drop zones
            zoneManager.setupDropZones();
            
            // Initial render
            render();
            
            console.log('✅ Game initialization complete');
        },
        showMessage: showMessage
    });
    
    // Set up main menu/modal event handlers
    setupModalEventHandlers();
}

function setupModalEventHandlers() {
    console.log('Setting up modal event handlers...');
    
    // Get DOM elements
    const optionsBtn = document.getElementById('options-btn');
    const optionsModal = document.getElementById('options-modal');
    const closeOptionsBtn = document.getElementById('close-options-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const messageModal = document.getElementById('message-modal');
    const createPlaceholderBtn = document.getElementById('create-placeholder-btn');
    const placeholderModal = document.getElementById('placeholder-modal');
    const confirmPlaceholderBtn = document.getElementById('confirm-placeholder-btn');
    const cancelPlaceholderBtn = document.getElementById('cancel-placeholder-btn');
    const placeholderTextInput = document.getElementById('placeholder-text-input') as HTMLInputElement;
    const resetBtnModal = document.getElementById('reset-btn-modal');
    const pickTurnOrderBtn = document.getElementById('pick-turn-order-btn');
    
    // Options menu button
    optionsBtn?.addEventListener('click', () => {
        console.log('Options menu clicked');
        optionsModal?.classList.remove('hidden');
    });
    
    // Close options modal
    closeOptionsBtn?.addEventListener('click', () => {
        console.log('Close options clicked');
        optionsModal?.classList.add('hidden');
    });
    
    // Close message modal
    closeModalBtn?.addEventListener('click', () => {
        console.log('Close message modal clicked');
        messageModal?.classList.add('hidden');
    });
    
    // Create placeholder card
    createPlaceholderBtn?.addEventListener('click', () => {
        console.log('Create placeholder clicked');
        
        // Switch back to viewing our own playzone before starting placeholder creation
        if (activePlayZonePlayerId !== playerId) {
            activePlayZonePlayerId = playerId;
            currentlyViewedPlayerId = playerId;
            // Re-render to switch the view immediately
            render();
        }
        
        optionsModal?.classList.add('hidden');
        placeholderModal?.classList.remove('hidden');
        placeholderTextInput?.focus();
    });
    
    // Confirm placeholder creation
    confirmPlaceholderBtn?.addEventListener('click', () => {
        console.log('Confirm placeholder clicked');
        
        if (placeholderTextInput?.value && player) {
            const placeholderText = placeholderTextInput.value.trim();
            console.log('Creating placeholder card:', placeholderText);
            
            // TODO: Implement placeholder card creation
            showMessage(`Placeholder card "${placeholderText}" created (TODO: implement)`);
            
            placeholderTextInput.value = '';
            placeholderModal?.classList.add('hidden');
        }
    });
    
    // Cancel placeholder creation
    cancelPlaceholderBtn?.addEventListener('click', () => {
        console.log('Cancel placeholder clicked');
        placeholderTextInput && (placeholderTextInput.value = '');
        placeholderModal?.classList.add('hidden');
    });
    
    // Handle Enter key in placeholder input
    placeholderTextInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmPlaceholderBtn?.click();
        }
    });
    
    // Reset game button
    resetBtnModal?.addEventListener('click', () => {
        console.log('Reset game clicked');
        
        if (confirm('Are you sure you want to reset the game? This cannot be undone.')) {
            // TODO: Implement game reset
            showMessage('Game reset (TODO: implement)');
            optionsModal?.classList.add('hidden');
        }
    });
    
    // Pick turn order button
    pickTurnOrderBtn?.addEventListener('click', () => {
        console.log('Pick turn order clicked');
        
        // TODO: Implement turn order picker
        showMessage('Turn order randomized (TODO: implement)');
        optionsModal?.classList.add('hidden');
    });
    
    console.log('Modal event handlers set up successfully');
}

function showBottomBarContextMenu(e: any) {
    console.log('Showing bottom bar context menu');
    e.preventDefault();
    
    hideBottomBarContextMenu();
    
    const bottomBarContextMenuEl = document.getElementById('bottom-bar-context-menu');
    if (!bottomBarContextMenuEl) {
        console.error('Bottom bar context menu element not found');
        return;
    }
    
    // Position the context menu
    bottomBarContextMenuEl.style.left = `${e.clientX}px`;
    bottomBarContextMenuEl.style.top = `${e.clientY}px`;
    bottomBarContextMenuEl.classList.remove('hidden');
    
    // Ensure context menu stays within viewport
    const rect = bottomBarContextMenuEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        bottomBarContextMenuEl.style.left = `${e.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        bottomBarContextMenuEl.style.top = `${e.clientY - rect.height}px`;
    }
    
    // Set a flag to prevent immediate hiding
    setTimeout(() => {
        // Add click listener to hide menu when clicking outside
        const hideOnClickOutside = (event: MouseEvent) => {
            if (!bottomBarContextMenuEl.contains(event.target as Node)) {
                hideBottomBarContextMenu();
                document.removeEventListener('click', hideOnClickOutside);
            }
        };
        document.addEventListener('click', hideOnClickOutside);
    }, 10);
}

function hideBottomBarContextMenu() {
    const bottomBarContextMenuEl = document.getElementById('bottom-bar-context-menu');
    if (bottomBarContextMenuEl) {
        bottomBarContextMenuEl.classList.add('hidden');
    }
}

function setupSettingsCallbacks() {
    // Set up settings manager callbacks
    settingsManager.setCallbacks({
        onMagnifyChange: (enabled: boolean) => {
            // Update all zones
            zoneManager.updateSettings();
        },
        onCardWidthChange: (width: number) => {
            // Update all zones
            zoneManager.updateSettings();
            // Update hand card spacing since width affects spacing calculations
            updateCardSpacing();
        },
        onCardSpacingChange: (spacing: number) => {
            // Update hand card spacing
            updateCardSpacing();
        },
        onSnapToGridChange: (enabled: boolean) => {
            // Update grid visuals
            updateGridVisuals(enabled);
        },
        showBottomBarContextMenu: (event: any) => {
            showBottomBarContextMenu(event);
        },
        autoFitSevenCards: (showNotification: boolean = false) => {
            autoFitSevenCards(showNotification);
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
    
    // Use zone manager to update zones
    zoneManager.updateZones(player, viewedPlayer, playerId);
}

function renderHand() {
    if (!player) return;
    
    const handZoneEl = document.getElementById('hand-zone');
    if (!handZoneEl) return;
    
    const handCards = player.getZone(Zone.hand);
    console.log(`Rendering hand with ${handCards.length} cards`);
    
    // Render each card in hand using cardManager (this will clear the container)
    cardManager.renderCardsToContainer(
        handCards,
        handZoneEl,
        Zone.hand,
        {
            isMagnifyEnabled: settingsManager.getSetting('isMagnifyEnabled'),
            isInteractable: true,
            onCardClick: interactionManager.handleCardClick,
            onCardDblClick: interactionManager.handleCardDoubleClick,
            onCardDragStart: interactionManager.handleCardDragStart,
            showBack: false,
            playerSelections: {},
            playerColors: {}
        }
    );
    
    // Add hand guideline after cards are rendered
    const handGuideline = document.createElement('div');
    handGuideline.className = 'hand-guideline';
    handZoneEl.appendChild(handGuideline);
    
    // Update hand card spacing after rendering - use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        updateCardSpacing();
    });
}

function updateCardSpacing() {
    // Update hand zone spacing to allow for card overlapping
    const handZone = document.getElementById('hand-zone');
    if (!handZone) return;
    
    const newCardSpacing = settingsManager.getSetting('currentCardSpacing');
    const currentCardWidth = settingsManager.getSetting('currentCardWidth');

    console.log(`Updating card spacing: ${newCardSpacing}, card width: ${currentCardWidth}`);

    // Calculate the actual width that 7 cards would occupy
    let sevenCardWidth;
    if (newCardSpacing >= 0) {
        // Positive spacing: 7 cards + 6 gaps
        sevenCardWidth = (7 * currentCardWidth) + (6 * newCardSpacing * 4); // Convert rem to px (0.25rem * 16px/rem = 4px)
    } else {
        // Negative spacing (overlap): 7 cards - total overlap amount
        const overlapPerGap = Math.abs(newCardSpacing) * 0.75 * 16; // Convert to pixels (0.75rem * 16px/rem)
        const totalOverlap = 6 * overlapPerGap; // 6 gaps between 7 cards
        sevenCardWidth = (7 * currentCardWidth) - totalOverlap;
    }
    
    // Get the actual available width of the hand zone
    const handZoneRect = handZone.getBoundingClientRect();
    
    // Check if we have valid dimensions
    if (handZoneRect.width <= 0) {
        console.warn('Hand zone has no width, cannot calculate auto-fit');
        return;
    }
    
    const handZoneStyles = window.getComputedStyle(handZone);
    const paddingLeft = parseFloat(handZoneStyles.paddingLeft) || 0;
    const paddingRight = parseFloat(handZoneStyles.paddingRight) || 0;
    const borderLeft = parseFloat(handZoneStyles.borderLeftWidth) || 0;
    const borderRight = parseFloat(handZoneStyles.borderRightWidth) || 0;
    
    // Calculate the actual usable width
    const handZoneWidth = handZoneRect.width - paddingLeft - paddingRight - borderLeft - borderRight;
    if(Math.abs(sevenCardWidth - handZoneWidth) < 10) {
        console.log('Hand limit guide shown');
        const handLimitGuide = document.getElementById('hand-limit-guide');
        if(handLimitGuide) {
            console.log('Hand limit guide 1');
            handLimitGuide.style.visibility = 'hidden';
        }
    } else {
        const handLimitGuide = document.getElementById('hand-limit-guide');
        if(handLimitGuide) {
            handLimitGuide.style.visibility = 'visible';
        }
    }
    document.documentElement.style.setProperty('--seven-card-width', `${sevenCardWidth + 12}px`);

    const cards = handZone.querySelectorAll('.card');
    console.log(`Found ${cards.length} cards in hand zone for spacing`);
    
    if (newCardSpacing >= 0) {
        // Positive spacing: use gap property
        handZone.style.gap = `${newCardSpacing * 0.25}rem`;
        console.log(`Applied positive spacing: ${newCardSpacing * 0.25}rem`);
        // Reset any negative margins and z-index
        cards.forEach((card, index) => {
            (card as HTMLElement).style.marginLeft = '';
            (card as HTMLElement).style.zIndex = '';
        });
    } else {
        // Negative spacing: use negative margins for overlapping
        handZone.style.gap = '0';
        cards.forEach((card, index) => {
            if (index > 0) {
                // Convert negative spacing to negative margin for overlap
                const overlapAmount = Math.abs(newCardSpacing) * 0.75; // Increased multiplier for more overlap
                (card as HTMLElement).style.marginLeft = `-${overlapAmount}rem`;
                console.log(`Applied negative margin to card ${index}: -${overlapAmount}rem`);
            } else {
                // First card has no margin
                (card as HTMLElement).style.marginLeft = '';
            }
            // Set z-index so later cards appear on top
            (card as HTMLElement).style.zIndex = index.toString();
        });
    }
}

function autoFitSevenCards(showNotification: boolean = false) {
    if (!player) return;
    
    const handCards = player.getZone(Zone.hand);
    let numCards = Math.max(handCards.length, 7);
    const handZone = document.getElementById('hand-zone');
    if (!handZone) return;
    
    // Force a layout update to ensure we get accurate measurements
    handZone.style.display = 'flex'; // Ensure it's displayed
    
    // Get the actual available width of the hand zone
    const handZoneRect = handZone.getBoundingClientRect();
    
    // Check if we have valid dimensions
    if (handZoneRect.width <= 0) {
        console.warn('Hand zone has no width, cannot calculate auto-fit');
        return;
    }
    
    const handZoneStyles = window.getComputedStyle(handZone);
    const paddingLeft = parseFloat(handZoneStyles.paddingLeft) || 0;
    const paddingRight = parseFloat(handZoneStyles.paddingRight) || 0;
    const borderLeft = parseFloat(handZoneStyles.borderLeftWidth) || 0;
    const borderRight = parseFloat(handZoneStyles.borderRightWidth) || 0;
    
    // Calculate the actual usable width
    const handZoneWidth = handZoneRect.width - paddingLeft - paddingRight - borderLeft - borderRight;
    
    // Additional check for valid usable width
    if (handZoneWidth <= 0) {
        console.warn('Hand zone has no usable width after accounting for padding/borders');
        return;
    }
    
    console.log('Hand zone measurements:', {
        totalWidth: handZoneRect.width,
        paddingLeft,
        paddingRight,
        borderLeft,
        borderRight,
        usableWidth: handZoneWidth
    });
    
    // Calculate the width needed for cards
    const cardWidth = settingsManager.getSetting('currentCardWidth'); // Current card width in pixels
    const totalCardWidth = numCards * cardWidth;
    
    console.log('Card calculations:', {
        cardWidth,
        totalCardWidth,
        handZoneWidth,
        needsOverlap: totalCardWidth > handZoneWidth
    });
    
    if (totalCardWidth <= handZoneWidth) {
        // Cards fit without overlapping, set spacing to 0 (no gaps, no overlap)
        settingsManager.setSetting('currentCardSpacing', 0);
        // Also add a guide line for 7 cards so player can see if they're at hand-size
        console.log('Cards fit without overlap, setting spacing to 0');
    } else {
        // Cards need to overlap, calculate negative spacing
        const overlapNeeded = totalCardWidth - handZoneWidth;
        const overlapPerGap = overlapNeeded / (numCards - 1); // Gaps between cards
        
        // Convert to spacing slider value 
        // The overlap amount in CSS is calculated as: Math.abs(currentCardSpacing) * 0.75 rem
        // So we need: overlapPerGap (in px) = Math.abs(currentCardSpacing) * 0.75 * 16 (px per rem)
        // Therefore: currentCardSpacing = -(overlapPerGap / (0.75 * 16))
        const calculatedSpacing = -(overlapPerGap / (0.75 * 16));
        
        // Allow much more overlap by increasing the minimum value from -6 to -15
        const spacingValue = Math.max(-15, calculatedSpacing);
        settingsManager.setSetting('currentCardSpacing', spacingValue);
        
        console.log('Overlap calculations:', {
            overlapNeeded,
            overlapPerGap,
            calculatedSpacing,
            finalSpacingValue: spacingValue,
            hitMinimumLimit: calculatedSpacing < -15
        });
        
        // If we hit the minimum limit, warn the user
        if (calculatedSpacing < -15) {
            console.warn('Maximum overlap reached - cards may not fit perfectly');
        }
    }
    
    // Update the slider to reflect the new value (if it exists)
    const cardSpacingSlider = document.getElementById('card-spacing-slider') as HTMLInputElement;
    if (cardSpacingSlider) {
        cardSpacingSlider.value = settingsManager.getSetting('currentCardSpacing').toString();
    }
    
    // Apply the new spacing
    updateCardSpacing();
    
    // Settings are automatically saved by SettingsManager
    
    // Show a message to the user if requested
    if (showNotification) {
        const currentCardSpacing = settingsManager.getSetting('currentCardSpacing');
        const fitMessage = currentCardSpacing === 0 ? 
            'Hand spacing set to fit 7 cards without overlap' :
            `Hand spacing adjusted to fit 7 cards (overlap: ${Math.abs(currentCardSpacing).toFixed(1)})`;
        
        console.log(fitMessage);
        // TODO: Show actual notification UI if needed
    }
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
            onCardClick: interactionManager.handleCardClick.bind(interactionManager),
            onCardDblClick: interactionManager.handleCardDoubleClick.bind(interactionManager),
            onCardDragStart: interactionManager.handleCardDragStart.bind(interactionManager),
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

// Export for debugging (only set managers if they exist)
(window as any).modernClient = {
    game,
    player,
    vdClient,
    render,
    get zoneManager() { return zoneManager; },
    get interactionManager() { return interactionManager; }
};