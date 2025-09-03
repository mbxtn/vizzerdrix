import ScryfallCache from './scryfallCache.js';
import { createCardElement, updateImageQualityCutoffs } from './cardFactory.js';
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
let currentlyViewedPlayerId = null; // Track which player's zones we're currently viewing
let isMagnifyEnabled = false; // New state variable for magnify on hover
let isAutoFocusEnabled = true; // Auto-focus on turn change (enabled by default)
let isGhostModeEnabled = false; // Ghost mode for showing your cards on other players' battlefields (disabled by default)
let isReverseGhostModeEnabled = false; // Reverse ghost mode for showing active player's cards in your playzone (disabled by default)
let isAutoUntapEnabled = false; // Auto untap all cards when your turn begins (disabled by default)
let isSnapToGridEnabled = false; // Snap to grid for card movement in play zone (disabled by default)
let isTabHoverPreviewEnabled = false; // Tab hover preview for showing player zones on tab hover (disabled by default)
let isEnhancedImageQualityEnabled = false; // Enhanced image quality for better clarity on certain browser/OS combinations (disabled by default)
let magnifyPreviewWidth = 320; // Default magnify preview width

// Load persistent settings from localStorage
function loadPersistentSettings() {
    try {
        const savedSettings = localStorage.getItem('vizzerdrix-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            isMagnifyEnabled = settings.isMagnifyEnabled ?? false;
            isAutoFocusEnabled = settings.isAutoFocusEnabled ?? true;
            isGhostModeEnabled = settings.isGhostModeEnabled ?? false;
            isReverseGhostModeEnabled = settings.isReverseGhostModeEnabled ?? false;
            isAutoUntapEnabled = settings.isAutoUntapEnabled ?? false;
            isSnapToGridEnabled = settings.isSnapToGridEnabled ?? false;
            isTabHoverPreviewEnabled = settings.isTabHoverPreviewEnabled ?? false;
            isEnhancedImageQualityEnabled = settings.isEnhancedImageQualityEnabled ?? false;
            magnifyPreviewWidth = settings.magnifyPreviewWidth ?? 320;
            currentCardSpacing = settings.currentCardSpacing ?? 0;
            currentCardWidth = settings.currentCardWidth ?? 80;
            isSpacingSliderVisible = settings.isSpacingSliderVisible ?? true;
            console.log('Loaded persistent settings:', settings);
        }
    } catch (error) {
        console.error('Error loading persistent settings:', error);
    }
}

// Save persistent settings to localStorage
function savePersistentSettings() {
    try {
        const settings = {
            isMagnifyEnabled,
            isAutoFocusEnabled,
            isGhostModeEnabled,
            isReverseGhostModeEnabled,
            isAutoUntapEnabled,
            isSnapToGridEnabled,
            isTabHoverPreviewEnabled,
            isEnhancedImageQualityEnabled,
            magnifyPreviewWidth,
            currentCardSpacing,
            currentCardWidth,
            isSpacingSliderVisible
        };
        localStorage.setItem('vizzerdrix-settings', JSON.stringify(settings));
        console.log('Saved persistent settings:', settings);
    } catch (error) {
        console.error('Error saving persistent settings:', error);
    }
}
let magnifyPreviewHeight = 430; // Default magnify preview height (calculated based on card aspect ratio)

// UI Elements
const magnifyToggleBtn = document.getElementById('magnify-toggle-btn');
const magnifyStatusEl = document.getElementById('magnify-status');
const autoFocusToggleBtn = document.getElementById('auto-focus-toggle-btn');
const autoFocusStatusEl = document.getElementById('auto-focus-status');
const ghostModeToggleBtn = document.getElementById('ghost-mode-toggle-btn');
const ghostModeStatusEl = document.getElementById('ghost-mode-status');
const reverseGhostModeToggleBtn = document.getElementById('reverse-ghost-mode-toggle-btn');
const reverseGhostModeStatusEl = document.getElementById('reverse-ghost-mode-status');
const autoUntapToggleBtn = document.getElementById('auto-untap-toggle-btn');
const autoUntapStatusEl = document.getElementById('auto-untap-status');
const enhancedImageQualityToggleBtn = document.getElementById('enhanced-image-quality-toggle-btn');
const enhancedImageQualityStatusEl = document.getElementById('enhanced-image-quality-status');
const snapToGridToggleBtn = document.getElementById('snap-to-grid-toggle-btn');
const snapToGridStatusEl = document.getElementById('snap-to-grid-status');
const tabHoverPreviewToggleBtn = document.getElementById('tab-hover-preview-toggle-btn');
const tabHoverPreviewStatusEl = document.getElementById('tab-hover-preview-status');
const joinBtn = document.getElementById('join-btn');
const rejoinBtn = document.getElementById('rejoin-btn');
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
const cardSpacingSlider = document.getElementById('card-spacing-slider'); // Card spacing slider
const createPlaceholderBtn = document.getElementById('create-placeholder-btn'); // Placeholder card button
const placeholderModal = document.getElementById('placeholder-modal'); // Placeholder modal
const placeholderTextInput = document.getElementById('placeholder-text-input'); // Placeholder text input
const confirmPlaceholderBtn = document.getElementById('confirm-placeholder-btn'); // Confirm placeholder button
const cancelPlaceholderBtn = document.getElementById('cancel-placeholder-btn'); // Cancel placeholder button
const commanderSelectionModal = document.getElementById('commander-selection-modal'); // Commander selection modal
const commanderSelectionList = document.getElementById('commander-selection-list'); // Commander selection list
const selectedCommandersCount = document.getElementById('selected-commanders-count'); // Selected commanders count
const confirmCommanderSelectionBtn = document.getElementById('confirm-commander-selection-btn'); // Confirm commander selection button
const cancelCommanderSelectionBtn = document.getElementById('cancel-commander-selection-btn'); // Cancel commander selection button
const magnifySizeSliderContainer = document.getElementById('magnify-size-slider-container'); // Magnify size slider container
const magnifySizeSlider = document.getElementById('magnify-size-slider'); // Magnify size slider
const lifeTotalEl = document.getElementById('life-total'); // Life total display
const increaseLifeBtn = document.getElementById('increase-life-btn'); // Increase life button
const decreaseLifeBtn = document.getElementById('decrease-life-btn'); // Decrease life button
const loadingModal = document.getElementById('loading-modal'); // Loading progress modal
const loadingProgressBar = document.getElementById('loading-progress-bar'); // Progress bar
const loadingProgressText = document.getElementById('loading-progress-text'); // Progress text
const loadingCurrentCard = document.getElementById('loading-current-card'); // Current card text


// Selection state
let selectedCards = [];
let selectedCardIds = [];
let isSelecting = false;
let selectionBox = null;
let startX = 0;
let startY = 0;
let justSelectedByDrag = false;

// Multi-player selection tracking
let allPlayerSelections = {}; // { playerId: [cardIds] }
let playerColors = {}; // { playerId: color }
let selectionUpdateTimeout = null;

// Hover state for keyboard shortcuts
let hoveredCard = null;
let hoveredCardElement = null;

// Global functions for cardFactory.js to set/clear hovered card
window.setHoveredCard = function(card, cardEl) {
    // Only allow hovering for cards that belong to the current player
    // Check if we're viewing our own zones or if this is our card
    if (currentlyViewedPlayerId === playerId || activePlayZonePlayerId === playerId) {
        hoveredCard = card;
        hoveredCardElement = cardEl;
    } else {
        // Don't set hover state for other players' cards
        hoveredCard = null;
        hoveredCardElement = null;
    }
};

window.clearHoveredCard = function() {
    hoveredCard = null;
    hoveredCardElement = null;
};

// Global functions for snap-to-grid functionality
window.snapToGrid = snapToGrid;
window.isSnapToGridEnabled = false; // Will be updated when settings load

let cascadedHandCardsInAreaCount = 0;
const CASCADE_AREA_MAX_X = 300; // Example: Define the max X for the initial cascade area
const CASCADE_AREA_MAX_Y = 300; // Example: Define the max Y for the initial cascade area

// Commander selection state
let pendingDecklistForCommander = [];
let pendingRoomName = '';
let pendingDisplayName = '';
let selectedCommanderIndices = new Set();

// Player color generation for selection labels
function generatePlayerColor(playerId, playerIndex) {
    // Generate a consistent color for each player based on their index
    const colors = [
        '#ef4444', // red
        '#3b82f6', // blue 
        '#10b981', // green
        '#f59e0b', // yellow
        '#8b5cf6', // purple
        '#f97316', // orange
        '#06b6d4', // cyan
        '#ec4899', // pink
        '#84cc16', // lime
        '#6366f1'  // indigo
    ];
    
    if (playerIndex < colors.length) {
        return colors[playerIndex];
    }
    
    // For more than 10 players, generate a color based on player ID hash
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
        hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

function updatePlayerColors() {
    if (!gameState || !gameState.players) return;
    
    const playerIds = Object.keys(gameState.players);
    playerIds.forEach((pid, index) => {
        if (!playerColors[pid]) {
            playerColors[pid] = generatePlayerColor(pid, index);
        }
    });
}

// Snap to grid configuration
const GRID_SIZE_BASE = 20; // Base grid spacing in pixels for 80px card width

// Utility function to snap coordinates to grid (scales with card width)
function snapToGrid(x, y, playZoneElement = null) {
    if (!isSnapToGridEnabled) {
        return { x, y };
    }
    // Scale grid size based on current card width (80px is the base size)
    const scaledGridSize = Math.round(GRID_SIZE_BASE * (currentCardWidth / 80));
    
    // Get the play zones container and its scroll position
    const playZonesContainer = document.getElementById('play-zones-container');
    if (!playZonesContainer) {
        return { x, y };
    }
    
    // Calculate position in the container's coordinate system
    // The grid background starts at 0,0 within the container
    let containerX = x + playZonesContainer.scrollLeft;
    let containerY = y + playZonesContainer.scrollTop;
    
    // If we have a play zone element, add its offset within the container
    if (playZoneElement) {
        const containerRect = playZonesContainer.getBoundingClientRect();
        const zoneRect = playZoneElement.getBoundingClientRect();
        containerX += (zoneRect.left - containerRect.left);
        containerY += (zoneRect.top - containerRect.top);
    }
    
    // Snap to grid (grid starts at 0,0 in container coordinates)
    const snappedX = Math.round(containerX / scaledGridSize) * scaledGridSize;
    const snappedY = Math.round(containerY / scaledGridSize) * scaledGridSize;
    
    // Convert back to play zone coordinates
    let finalX = snappedX - playZonesContainer.scrollLeft;
    let finalY = snappedY - playZonesContainer.scrollTop;
    
    if (playZoneElement) {
        const containerRect = playZonesContainer.getBoundingClientRect();
        const zoneRect = playZoneElement.getBoundingClientRect();
        finalX -= (zoneRect.left - containerRect.left);
        finalY -= (zoneRect.top - containerRect.top);
    }
    
    return {
        x: finalX,
        y: finalY
    };
}

// Function to get the current scaled grid size for CSS updates
function getScaledGridSize() {
    return Math.round(GRID_SIZE_BASE * (currentCardWidth / 80));
}

// Function to update grid visual size
function updateGridVisuals() {
    const gridSize = getScaledGridSize();
    const majorGridSize = gridSize * 5; // Major grid lines every 5 grid units
    
    // Update CSS custom properties for grid size
    document.documentElement.style.setProperty('--grid-size', `${gridSize}px`);
    document.documentElement.style.setProperty('--major-grid-size', `${majorGridSize}px`);
    
    if (isSnapToGridEnabled) {
        // Force update of play zones container grid
        const playZonesContainer = document.getElementById('play-zones-container');
        if (playZonesContainer && playZonesContainer.classList.contains('snap-grid-enabled')) {
            playZonesContainer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
            // Trigger reflow for the container's pseudo-element
            playZonesContainer.offsetHeight;
        }
    }
}

// Context menu state
let cardContextMenu = null;
let contextMenuJustShown = false;
let bottomBarContextMenu = null;
let bottomBarContextMenuJustShown = false;

// Bottom bar elements
const bottomBarEl = document.getElementById('bottom-bar');
const bottomBarContextMenuEl = document.getElementById('bottom-bar-context-menu');
const toggleSpacingSliderBtn = document.getElementById('toggle-spacing-slider');
const spacingSliderStatusEl = document.getElementById('spacing-slider-status');
const cardSpacingSliderContainer = document.getElementById('card-spacing-slider-container');
const bottomBarSettingsBtn = document.getElementById('bottom-bar-settings-btn');

// Bottom bar state
let isSpacingSliderVisible = true; // Default to visible

// Tab hover preview state
let isHoveringTab = false;
let originalActivePlayZonePlayerId = null;
let hoverTimeoutId = null;

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

// Function to attempt rejoining a game
function attemptRejoin(roomName, displayName) {
    if (roomName && displayName) {
        console.log('Attempting rejoin with:', { roomName, displayName });
        // Set rejoin flag early
        isRejoinState = true;
        socket.emit('rejoin', { roomName, displayName });
        showMessage("Attempting to rejoin Vizzerdrix game...");
    } else {
        console.error('Cannot rejoin: missing room name or display name');
        showMessage("Please enter both room name and display name to rejoin.");
    }
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
        const line = lines[index];
        
        // Cards marked with (CMDR) are always commanders
        if (/\(CMDR\)/i.test(line)) {
            console.log(`Found (CMDR) marker in line: "${line}"`);
            return true;
        }
        
        // Cards marked with *CMDR* are also commanders (some formats use this)
        if (/\*CMDR\*/i.test(line)) {
            console.log(`Found *CMDR* marker in line: "${line}"`);
            return true;
        }
        
        // Cards in sections labeled "Commander" or "Commanders" (check previous lines for section headers)
        for (let i = index - 1; i >= 0; i--) {
            const prevLine = lines[i].toLowerCase().trim();
            if (prevLine === '' && i < index - 1) break; // Stop at empty line that's not immediately before
            if (/^commanders?:?\s*$/i.test(prevLine)) {
                console.log(`Found commander section header "${lines[i]}" for line: "${line}"`);
                return true;
            }
        }
        
        // If there's an empty line and this card is after it (and it's the last section), it's a commander
        if (lastEmptyLineIndex >= 0 && index > lastEmptyLineIndex) {
            console.log(`Line "${line}" is after last empty line at index ${lastEmptyLineIndex}, treating as commander`);
            return true;
        }
        
        return false;
    };
    
    lines.forEach((line, index) => {
        if (!line) return; // Skip empty lines
        
        const isCommander = isCommanderSection(index);
        
        // Enhanced parsing to handle various formats:
        // Standard: "2 Lightning Bolt" or "1x Lightning Bolt" or "Lightning Bolt"
        // Moxfield: "1 Snow-Covered Wastes (MH3) 309 *F*"
        // Archidekt: "1x Burning Inquiry (m10) 128 [Consistent Shared Draw,Draw]"
        // MTGO/Arena: "4 Lightning Bolt"
        // EDHRec: "1 Sol Ring (C14)"
        
        let cardName, count;
        
        // First, try to match count at the beginning
        const countMatch = line.match(/^(\d+)\s*x?\s*(.+)$/);
        
        if (countMatch) {
            count = parseInt(countMatch[1]);
            cardName = countMatch[2];
        } else {
            // No count specified, assume 1 copy
            count = 1;
            cardName = line;
        }
        cardName = cardName.replace(/[^\sa-zA-Z0-9,'-].*$/, ""); // Remove any trailing set codes or tags
        
        // Remove any trailing/leading whitespace
        cardName = cardName.trim();
        
        // Skip if card name is empty after cleaning
        if (!cardName) {
            console.warn('Empty card name after parsing:', line);
            return;
        }
        
        // Log parsing for debugging (only for first few cards to avoid spam)
        if (index < 10) {
            console.log(`Parsed line "${line}" -> Count: ${count}, Name: "${cardName}", Commander: ${isCommander}`);
        }
        
        // Add the specified number of copies to the appropriate zone
        const targetArray = isCommander ? commanders : decklist;
        for (let i = 0; i < count; i++) {
            targetArray.push(cardName);
        }
    });
    
    // Log parsing summary
    console.log(`Decklist parsing complete: ${decklist.length} library cards, ${commanders.length} commanders`);
    if (commanders.length > 0) {
        console.log('Commanders found:', commanders);
    }
    
    if (roomName && displayName && (decklist.length > 0 || commanders.length > 0)) {
        console.log('Final check before join:', { commanders: commanders.length, decklist: decklist.length });
        // Check if commanders were detected automatically
        if (commanders.length === 0 && decklist.length > 0) {
            // No commanders found - show selection modal
            console.log('No commanders detected automatically, showing selection modal');
            showCommanderSelectionModal([...decklist], roomName, displayName);
        } else {
            // Commanders found or no cards at all - proceed normally
            console.log('Commanders detected or no cards, proceeding with join');
            // Save game info for potential future rejoins
            localStorage.setItem('vizzerdrix-game-info', JSON.stringify({
                roomName,
                displayName,
                timestamp: Date.now()
            }));
            
            // Emit join event for new players
            socket.emit('join', { roomName, displayName, decklist, commanders });
            showMessage("Joining Vizzerdrix game...");
        }
    } else {
        showMessage("Please enter a room name, display name, and at least one card in your decklist.");
    }
});

// Separate rejoin button handler
rejoinBtn.addEventListener('click', () => {
    const roomName = roomInput.value.trim();
    const displayName = displayNameInput.value.trim();
    attemptRejoin(roomName, displayName);
});

// Commander selection functions
function showCommanderSelectionModal(allCardNames, roomName, displayName) {
    console.log('showCommanderSelectionModal called with:', { cardCount: allCardNames.length, roomName, displayName });
    console.log('Modal elements check:', {
        commanderSelectionModal: !!commanderSelectionModal,
        commanderSelectionList: !!commanderSelectionList,
        selectedCommandersCount: !!selectedCommandersCount,
        confirmCommanderSelectionBtn: !!confirmCommanderSelectionBtn
    });
    
    if (!commanderSelectionModal) {
        console.error('Commander selection modal element not found!');
        return;
    }
    
    pendingDecklistForCommander = [...allCardNames];
    pendingRoomName = roomName;
    pendingDisplayName = displayName;
    selectedCommanderIndices.clear();
    
    // Populate the selection list
    commanderSelectionList.innerHTML = '';
    
    // Group identical card names and show counts while preserving order
    const cardCounts = {};
    const uniqueCardOrder = []; // Track the order cards first appear
    allCardNames.forEach(cardName => {
        if (!cardCounts[cardName]) {
            cardCounts[cardName] = 0;
            uniqueCardOrder.push(cardName); // Add to order list when first encountered
        }
        cardCounts[cardName]++;
    });
    
    // Use the original order instead of alphabetical
    const uniqueCards = uniqueCardOrder;
    console.log('Creating selection for', uniqueCards.length, 'unique cards');
    
    uniqueCards.forEach((cardName, index) => {
        const count = cardCounts[cardName];
        const cardItem = document.createElement('div');
        cardItem.className = 'flex items-center justify-between p-3 border border-gray-600 rounded-md mb-2 cursor-pointer hover:bg-gray-600 transition-colors';
        cardItem.dataset.cardIndex = index;
        cardItem.dataset.cardName = cardName;
        
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'flex items-center flex-1';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'mr-3 pointer-events-none'; // Disable direct checkbox interaction
        checkbox.id = `commander-checkbox-${index}`;
        
        const label = document.createElement('label');
        label.htmlFor = `commander-checkbox-${index}`;
        label.className = 'flex-1 cursor-pointer select-none'; // Prevent text selection
        label.textContent = count > 1 ? `${cardName} (${count}x)` : cardName;
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        cardItem.appendChild(checkboxContainer);
        
        // Add click handler to the entire row
        cardItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle the checkbox state
            checkbox.checked = !checkbox.checked;
            
            // Update visual state
            if (checkbox.checked) {
                cardItem.classList.add('bg-blue-600', 'border-blue-400');
                cardItem.classList.remove('hover:bg-gray-600');
            } else {
                cardItem.classList.remove('bg-blue-600', 'border-blue-400');
                cardItem.classList.add('hover:bg-gray-600');
            }
            
            // Update selection
            toggleCommanderSelection(index, cardName, checkbox.checked);
        });
        
        commanderSelectionList.appendChild(cardItem);
    });
    
    updateSelectedCommandersCount();
    
    // Show the modal
    commanderSelectionModal.classList.remove('hidden');
}

function toggleCommanderSelection(index, cardName, isSelected) {
    if (isSelected) {
        selectedCommanderIndices.add(index);
    } else {
        selectedCommanderIndices.delete(index);
    }
    updateSelectedCommandersCount();
}

function updateSelectedCommandersCount() {
    selectedCommandersCount.textContent = selectedCommanderIndices.size;
    
    // Enable/disable the confirm button based on selection
    if (selectedCommanderIndices.size > 0) {
        confirmCommanderSelectionBtn.disabled = false;
        confirmCommanderSelectionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        confirmCommanderSelectionBtn.disabled = true;
        confirmCommanderSelectionBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function processCommanderSelection() {
    const decklist = [];
    const commanders = [];
    
    // Group identical card names and show counts while preserving order
    const cardCounts = {};
    const uniqueCardOrder = []; // Track the order cards first appear
    pendingDecklistForCommander.forEach(cardName => {
        if (!cardCounts[cardName]) {
            cardCounts[cardName] = 0;
            uniqueCardOrder.push(cardName); // Add to order list when first encountered
        }
        cardCounts[cardName]++;
    });
    
    const uniqueCards = uniqueCardOrder;
    
    selectedCommanderIndices.forEach(index => {
        const cardName = uniqueCards[index];
        const count = cardCounts[cardName];
        
        // Add all copies of this card as commanders
        for (let i = 0; i < count; i++) {
            commanders.push(cardName);
        }
        
        // Remove from potential decklist
        delete cardCounts[cardName];
    });
    
    // Add remaining cards to decklist
    Object.entries(cardCounts).forEach(([cardName, count]) => {
        for (let i = 0; i < count; i++) {
            decklist.push(cardName);
        }
    });
    
    console.log(`Commander selection complete: ${decklist.length} library cards, ${commanders.length} commanders`);
    if (commanders.length > 0) {
        console.log('Selected commanders:', commanders);
    }
    
    // Save game info for potential future rejoins
    localStorage.setItem('vizzerdrix-game-info', JSON.stringify({
        roomName: pendingRoomName,
        displayName: pendingDisplayName,
        timestamp: Date.now()
    }));
    
    // Emit join event
    socket.emit('join', { 
        roomName: pendingRoomName, 
        displayName: pendingDisplayName, 
        decklist, 
        commanders 
    });
    showMessage("Joining Vizzerdrix game...");
    
    // Hide the modal
    commanderSelectionModal.classList.add('hidden');
}

socket.on('connect', () => {
    playerId = socket.id;
    window.playerId = playerId; // Expose playerId to window for cardFactory access
    activePlayZonePlayerId = socket.id;
    console.log('Client connected. Player ID:', playerId);
    
    // Clear ALL stale local state from previous sessions
    gameState = null;
    hand = [];
    library = [];
    graveyard = [];
    exile = [];
    command = [];
    playZone = [];
    selectedCards = [];
    selectedCardIds = [];
    isRejoinState = false;
    
    // Clear optimistic update state
    lastClientAction = null;
    if (clientActionTimeout) {
        clearTimeout(clientActionTimeout);
        clientActionTimeout = null;
    }
    
    // Clear any cached shuffled libraries
    if (typeof shuffledLibraryCache !== 'undefined') {
        shuffledLibraryCache.clear();
    }
    
    // Reset card zones to ensure they don't hold stale state
    libraryZone = null;
    graveyardZone = null;
    exileZone = null;
    commandZone = null;
    
    // Auto-fill form with saved game info if available (for convenience)
    const savedGameInfo = localStorage.getItem('vizzerdrix-game-info');
    if (savedGameInfo) {
        try {
            const gameInfo = JSON.parse(savedGameInfo);
            // Only auto-fill if the save is recent (within 24 hours)
            if (Date.now() - gameInfo.timestamp < 24 * 60 * 60 * 1000) {
                roomInput.value = gameInfo.roomName;
                displayNameInput.value = gameInfo.displayName;
            } else {
                // Remove old saved info
                localStorage.removeItem('vizzerdrix-game-info');
            }
        } catch (error) {
            console.error('Error parsing saved game info:', error);
            localStorage.removeItem('vizzerdrix-game-info');
        }
    }
});

// Handle successful join
socket.on('joinSuccess', (data) => {
    console.log('Successfully joined game:', data);
    room = data.roomName; // Store the room name
    showMessage(`Welcome to Vizzerdrix! Joined room: ${data.roomName}`);
});

// Handle successful rejoin
socket.on('rejoinSuccess', (data) => {
    console.log('Successfully rejoined game:', data);
    
    // Set rejoin flag FIRST
    isRejoinState = true;
    
    // Store the room name
    room = data.roomName;
    
    // Clear ALL existing client state to ensure we use server state completely
    lastClientAction = null;
    if (clientActionTimeout) {
        clearTimeout(clientActionTimeout);
        clientActionTimeout = null;
    }
    
    // Clear all local game state arrays and values
    gameState = null;
    hand = [];
    library = [];
    graveyard = [];
    exile = [];
    command = [];
    playZone = [];
    selectedCards = [];
    selectedCardIds = [];
    currentLife = 40; // Reset to default, will be overridden by server state
    
    // Clear any cached shuffled libraries
    if (typeof shuffledLibraryCache !== 'undefined') {
        shuffledLibraryCache.clear();
    }
    
    // Reset card zones to force reinitialization with fresh state
    libraryZone = null;
    graveyardZone = null;
    exileZone = null;
    commandZone = null;
    
    console.log('Cleared all local state for rejoin');
    
    showMessage(`Welcome back to Vizzerdrix! Rejoined room: ${data.roomName}`);
});

// Handle join/rejoin errors
socket.on('joinError', (error) => {
    console.error('Join error:', error);
    showMessage(`Error joining game: ${error.message}`);
});

socket.on('rejoinError', (error) => {
    console.error('Rejoin error:', error);
    // Reset rejoin flag on error
    isRejoinState = false;
    showMessage(`Error rejoining game: ${error.message}. You may need to create a new game.`);
});

// Handle disconnection
socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    if (gameState && playerId) {
        // Keep the saved game info for potential rejoin
        const savedGameInfo = localStorage.getItem('vizzerdrix-game-info');
        if (savedGameInfo) {
            try {
                const gameInfo = JSON.parse(savedGameInfo);
                gameInfo.lastDisconnect = Date.now();
                localStorage.setItem('vizzerdrix-game-info', JSON.stringify(gameInfo));
            } catch (error) {
                console.error('Error updating saved game info:', error);
            }
        }
        showMessage("Disconnected from Vizzerdrix. You can rejoin by entering the same room name and display name.");
    }
});

socket.on('state', async (state) => {
    console.log('RAW STATE RECEIVED:', new Date().toISOString(), {
        currentTurn: state.currentTurn,
        turnOrderSet: state.turnOrderSet,
        turnOrder: state.turnOrder,
        turnCounter: state.turnCounter,
        isRejoin: isRejoinState // Use the global flag
    });
    
    // Check if state has actually changed
    const stateChanged = !gameState || JSON.stringify(gameState) !== JSON.stringify(state);
    
    // Check for turn order changes before updating gameState
    const turnOrderChanged = !gameState || 
        gameState.currentTurn !== state.currentTurn ||
        gameState.turnOrderSet !== state.turnOrderSet ||
        gameState.turnCounter !== state.turnCounter ||
        JSON.stringify(gameState.turnOrder) !== JSON.stringify(state.turnOrder);
    
    // Handle auto-focus on turn change
    const currentTurnChanged = gameState && (gameState.currentTurn !== state.currentTurn|| gameState.turnCounter !== state.turnCounter);

    if (currentTurnChanged && isAutoFocusEnabled && state.turnOrderSet && state.turnOrder && state.currentTurn !== undefined) {
        const newCurrentTurnPlayerId = state.turnOrder[state.currentTurn];
        if (newCurrentTurnPlayerId && state.players[newCurrentTurnPlayerId]) {
            console.log('Turn changed - auto-focusing on player:', newCurrentTurnPlayerId);
            activePlayZonePlayerId = newCurrentTurnPlayerId;
        }
    }
    
    console.log('Received state update:', {
        turnOrderSet: state.turnOrderSet,
        turnOrder: state.turnOrder,
        currentTurn: state.currentTurn,
        turnCounter: state.turnCounter,
        stateChanged,
        turnOrderChanged,
        isRejoin: isRejoinState,
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

    // If this is a rejoin, force a complete state sync from server
    if (isRejoinState && state.players[playerId]) {
        console.log('Rejoin detected - forcing complete state sync from server');
        const serverPlayer = state.players[playerId];
        
        // Completely replace local state with server state (no merging)
        hand = [...(serverPlayer.hand || [])];
        library = [...(serverPlayer.library || [])];
        graveyard = [...(serverPlayer.graveyard || [])];
        exile = [...(serverPlayer.exile || [])];
        command = [...(serverPlayer.command || [])];
        
        // Also sync the play zone for the current player
        if (state.playZones[playerId]) {
            playZone = [...state.playZones[playerId]];
        } else {
            playZone = [];
        }
        
        // Update life total from server
        if (serverPlayer.life !== undefined) {
            currentLife = serverPlayer.life;
        }
        
        console.log('State sync complete. Local arrays updated:', {
            handCount: hand.length,
            libraryCount: library.length,
            graveyardCount: graveyard.length,
            exileCount: exile.length,
            commandCount: command.length,
            playZoneCount: playZone.length,
            life: currentLife
        });
        
        // Clear the rejoin flag after successful sync
        isRejoinState = false;
        console.log('Rejoin state reset after successful sync');
        console.log('Final client state after rejoin sync:', {
            playerId: playerId,
            gameState: {
                players: Object.keys(gameState.players),
                turnOrder: gameState.turnOrder,
                turnOrderSet: gameState.turnOrderSet,
                myPlayerInPlayers: !!gameState.players[playerId],
                myPlayerInTurnOrder: gameState.turnOrder?.includes(playerId)
            }
        });
    }

    gameState = state;
    window.gameState = gameState; // Expose gameState to window for cardFactory access
    
    // Handle auto-untap when it becomes the player's turn (after gameState is updated)
    if (currentTurnChanged && isAutoUntapEnabled && gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined) {
        const newCurrentTurnPlayerId = gameState.turnOrder[gameState.currentTurn];
        console.log('Auto-untap check:', {
            currentTurnChanged,
            isAutoUntapEnabled,
            newCurrentTurnPlayerId,
            playerId,
            isMyTurn: newCurrentTurnPlayerId === playerId
        });
        if (newCurrentTurnPlayerId === playerId) {
            console.log('Turn changed to yours - auto-untapping all cards');
            autoUntapAllPlayerCards();
        }
    }
    
    console.log('activePlayZonePlayerId management:', {
        currentActivePlayZonePlayerId: activePlayZonePlayerId,
        playerId: playerId,
        playerExistsInState: !!(activePlayZonePlayerId && gameState.players[activePlayZonePlayerId]),
        isRejoin: isRejoinState
    });
    
    if (!activePlayZonePlayerId || !gameState.players[activePlayZonePlayerId]) {
        console.log(`Setting activePlayZonePlayerId from ${activePlayZonePlayerId} to ${playerId}`);
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
        
        // Check how many cards are actually uncached
        const cardNamesArray = Array.from(allCardNames);
        
        // Initialize cache and get stats
        const cacheStats = ScryfallCache.getCacheStats();
        console.log('Cache stats before loading:', cacheStats);
        
        const uncachedCards = cardNamesArray.filter(name => !ScryfallCache.get(name));
        const cachedCards = cardNamesArray.length - uncachedCards.length;
        
        console.log(`Cards status: ${cachedCards} cached, ${uncachedCards.length} need loading`);
        
        // Only show loading progress for loads with 3+ uncached cards that will take time
        const showProgress = uncachedCards.length >= 3;
        
        if (showProgress) {
            showLoadingProgress();
        }
        
        try {
            await ScryfallCache.load(cardNamesArray, showProgress ? (loaded, total, currentCard) => {
                updateLoadingProgress(loaded, total, currentCard);
                
                // If all cards were cached, hide the progress quickly
                if (currentCard && currentCard.includes('already loaded from cache')) {
                    setTimeout(() => {
                        hideLoadingProgress();
                    }, 500); // Show briefly then hide
                }
            } : null);
            console.log('Finished loading card images');
        } catch (error) {
            console.error('Error loading card images:', error);
            showMessage('Some card images failed to load. The game will continue with placeholders.');
        } finally {
            // Hide loading progress modal
            if (showProgress) {
                hideLoadingProgress();
            }
        }
    }
    
    // Handle player selections if they exist in the state
    if (state.playerSelections) {
        allPlayerSelections = state.playerSelections;
        updatePlayerColors();
    }
    
    // Only render if state actually changed, or if this is a turn order update
    // TEMPORARY: Force render on any state update to debug
    console.log('Forcing render for debugging');
    debouncedRender();
    updateCascadedHandCardsInAreaCount(); // Call it here to update after server state
});

// Handle real-time selection updates
socket.on('selectionUpdate', (data) => {
    if (data.playerSelections) {
        const previousSelections = allPlayerSelections;
        allPlayerSelections = data.playerSelections;
        updatePlayerColors();
        
        // Check if this is just our own selection echoing back from the server
        const ourSelection = data.playerSelections[playerId] || [];
        const ourCurrentSelection = selectedCardIds.sort().join(',');
        const receivedOurSelection = ourSelection.sort().join(',');
        
        // Check if any OTHER player's selection has changed
        let otherPlayerSelectionChanged = false;
        if (previousSelections) {
            for (const pid in data.playerSelections) {
                if (pid !== playerId) {
                    const oldSelection = (previousSelections[pid] || []).sort().join(',');
                    const newSelection = (data.playerSelections[pid] || []).sort().join(',');
                    if (oldSelection !== newSelection) {
                        otherPlayerSelectionChanged = true;
                        break;
                    }
                }
            }
        } else {
            // If this is the first selection update, check if any other player has selections
            for (const pid in data.playerSelections) {
                if (pid !== playerId && data.playerSelections[pid] && data.playerSelections[pid].length > 0) {
                    otherPlayerSelectionChanged = true;
                    break;
                }
            }
        }
        
        // Re-render if:
        // 1. Another player's selection changed, OR
        // 2. Our own selection from server doesn't match our current state (sync issues)
        if (otherPlayerSelectionChanged || receivedOurSelection !== ourCurrentSelection) {
            debouncedRender();
        }
    }
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
    // Switch back to viewing our own playzone before starting placeholder creation
    if (activePlayZonePlayerId !== playerId) {
        activePlayZonePlayerId = playerId;
        currentlyViewedPlayerId = playerId;
        // Re-render to switch the view immediately
        debouncedRender();
    }
    
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

// Commander selection modal event listeners
confirmCommanderSelectionBtn.addEventListener('click', () => {
    if (selectedCommanderIndices.size > 0) {
        processCommanderSelection();
    }
});

cancelCommanderSelectionBtn.addEventListener('click', () => {
    commanderSelectionModal.classList.add('hidden');
    selectedCommanderIndices.clear();
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
    
    // Process cards from library (these should be non-commanders, but check anyway)
    library.forEach(card => {
        if (card.isCommander) {
            commanderCards.push(card);
        } else {
            allNonCommanderCards.push(card);
        }
    });
    library.length = 0; // Clear library

    // Shuffle all non-commander cards
    shuffleArray(allNonCommanderCards);

    // Move all shuffled non-commander cards into the library
    library.push(...allNonCommanderCards);
    
    // Move all commander cards back to the command zone
    command.push(...commanderCards);

    // Reset cascadedHandCardsInAreaCount as all cards are now in library or command zone
    cascadedHandCardsInAreaCount = 0;

    // Update CardZone instances immediately with the new data
    if (libraryZone) {
        libraryZone.updateCards([...library]); // Pass a copy to ensure change detection works
    }
    if (commandZone) {
        commandZone.updateCards([...command]); // Pass a copy to ensure change detection works
    }
    if (graveyardZone) {
        graveyardZone.updateCards([]); // Clear graveyard
    }
    if (exileZone) {
        exileZone.updateCards([]); // Clear exile
    }

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
        magnifyToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        magnifyToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        // Show the magnify size slider
        magnifySizeSliderContainer.classList.remove('hidden');
    } else {
        magnifyStatusEl.textContent = 'Off';
        magnifyStatusEl.classList.remove('bg-green-600');
        magnifyStatusEl.classList.add('bg-red-600');
        magnifyToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        magnifyToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        // Hide the magnify size slider
        magnifySizeSliderContainer.classList.add('hidden');
    }
}

function updateAutoFocusStatusUI() {
    if (isAutoFocusEnabled) {
        autoFocusStatusEl.textContent = 'On';
        autoFocusStatusEl.classList.remove('bg-red-600');
        autoFocusStatusEl.classList.add('bg-green-600');
        autoFocusToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        autoFocusToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        autoFocusStatusEl.textContent = 'Off';
        autoFocusStatusEl.classList.remove('bg-green-600');
        autoFocusStatusEl.classList.add('bg-red-600');
        autoFocusToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        autoFocusToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

function updateGhostModeStatusUI() {
    if (isGhostModeEnabled) {
        ghostModeStatusEl.textContent = 'On';
        ghostModeStatusEl.classList.remove('bg-red-600');
        ghostModeStatusEl.classList.add('bg-green-600');
        ghostModeToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        ghostModeToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        ghostModeStatusEl.textContent = 'Off';
        ghostModeStatusEl.classList.remove('bg-green-600');
        ghostModeStatusEl.classList.add('bg-red-600');
        ghostModeToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        ghostModeToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

function updateReverseGhostModeStatusUI() {
    if (isReverseGhostModeEnabled) {
        reverseGhostModeStatusEl.textContent = 'On';
        reverseGhostModeStatusEl.classList.remove('bg-red-600');
        reverseGhostModeStatusEl.classList.add('bg-green-600');
        reverseGhostModeToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        reverseGhostModeToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        reverseGhostModeStatusEl.textContent = 'Off';
        reverseGhostModeStatusEl.classList.remove('bg-green-600');
        reverseGhostModeStatusEl.classList.add('bg-red-600');
        reverseGhostModeToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        reverseGhostModeToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

function updateAutoUntapStatusUI() {
    if (isAutoUntapEnabled) {
        autoUntapStatusEl.textContent = 'On';
        autoUntapStatusEl.classList.remove('bg-red-600');
        autoUntapStatusEl.classList.add('bg-green-600');
        autoUntapToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        autoUntapToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        autoUntapStatusEl.textContent = 'Off';
        autoUntapStatusEl.classList.remove('bg-green-600');
        autoUntapStatusEl.classList.add('bg-red-600');
        autoUntapToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        autoUntapToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

function updateEnhancedImageQualityStatusUI() {
    if (isEnhancedImageQualityEnabled) {
        enhancedImageQualityStatusEl.textContent = 'On';
        enhancedImageQualityStatusEl.classList.remove('bg-red-600');
        enhancedImageQualityStatusEl.classList.add('bg-green-600');
        enhancedImageQualityToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        enhancedImageQualityToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        enhancedImageQualityStatusEl.textContent = 'Off';
        enhancedImageQualityStatusEl.classList.remove('bg-green-600');
        enhancedImageQualityStatusEl.classList.add('bg-red-600');
        enhancedImageQualityToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        enhancedImageQualityToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

function updateSnapToGridStatusUI() {
    if (isSnapToGridEnabled) {
        snapToGridStatusEl.textContent = 'On';
        snapToGridStatusEl.classList.remove('bg-red-600');
        snapToGridStatusEl.classList.add('bg-green-600');
        snapToGridToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        snapToGridToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        snapToGridStatusEl.textContent = 'Off';
        snapToGridStatusEl.classList.remove('bg-green-600');
        snapToGridStatusEl.classList.add('bg-red-600');
        snapToGridToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        snapToGridToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
    
    // Update play zones container grid class
    const playZonesContainer = document.getElementById('play-zones-container');
    if (playZonesContainer) {
        if (isSnapToGridEnabled) {
            playZonesContainer.classList.add('snap-grid-enabled');
        } else {
            playZonesContainer.classList.remove('snap-grid-enabled');
        }
    }
}

function updateTabHoverPreviewStatusUI() {
    if (isTabHoverPreviewEnabled) {
        tabHoverPreviewStatusEl.textContent = 'On';
        tabHoverPreviewStatusEl.classList.remove('bg-red-600');
        tabHoverPreviewStatusEl.classList.add('bg-green-600');
        tabHoverPreviewToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        tabHoverPreviewToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    } else {
        tabHoverPreviewStatusEl.textContent = 'Off';
        tabHoverPreviewStatusEl.classList.remove('bg-green-600');
        tabHoverPreviewStatusEl.classList.add('bg-red-600');
        tabHoverPreviewToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        tabHoverPreviewToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

function updateSpacingSliderVisibilityUI() {
    if (isSpacingSliderVisible) {
        cardSpacingSliderContainer.classList.remove('hidden');
        spacingSliderStatusEl.textContent = 'On';
        spacingSliderStatusEl.classList.remove('bg-red-600');
        spacingSliderStatusEl.classList.add('bg-green-600');
    } else {
        cardSpacingSliderContainer.classList.add('hidden');
        spacingSliderStatusEl.textContent = 'Off';
        spacingSliderStatusEl.classList.remove('bg-green-600');
        spacingSliderStatusEl.classList.add('bg-red-600');
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
    savePersistentSettings(); // Save settings when changed
    hideBottomBarContextMenu(); // Hide context menu after selection
});

autoFocusToggleBtn.addEventListener('click', () => {
    isAutoFocusEnabled = !isAutoFocusEnabled;
    updateAutoFocusStatusUI();
    savePersistentSettings(); // Save settings when changed
});

ghostModeToggleBtn.addEventListener('click', () => {
    isGhostModeEnabled = !isGhostModeEnabled;
    updateGhostModeStatusUI();
    // Re-render to apply ghost mode changes
    debouncedRender();
    savePersistentSettings(); // Save settings when changed
    hideBottomBarContextMenu(); // Hide context menu after selection
});

reverseGhostModeToggleBtn.addEventListener('click', () => {
    isReverseGhostModeEnabled = !isReverseGhostModeEnabled;
    updateReverseGhostModeStatusUI();
    // Re-render to apply reverse ghost mode changes
    debouncedRender();
    savePersistentSettings(); // Save settings when changed
    hideBottomBarContextMenu(); // Hide context menu after selection
});

autoUntapToggleBtn.addEventListener('click', () => {
    isAutoUntapEnabled = !isAutoUntapEnabled;
    updateAutoUntapStatusUI();
    savePersistentSettings(); // Save settings when changed
});

enhancedImageQualityToggleBtn.addEventListener('click', () => {
    isEnhancedImageQualityEnabled = !isEnhancedImageQualityEnabled;
    updateEnhancedImageQualityStatusUI();
    
    // Update the cutoffs in cardFactory
    updateImageQualityCutoffs(isEnhancedImageQualityEnabled);
    
    savePersistentSettings(); // Save settings when changed
});

snapToGridToggleBtn.addEventListener('click', () => {
    isSnapToGridEnabled = !isSnapToGridEnabled;
    window.isSnapToGridEnabled = isSnapToGridEnabled; // Update global reference
    updateSnapToGridStatusUI();
    
    // Update play zones container with grid class for broader coverage
    const playZonesContainer = document.getElementById('play-zones-container');
    if (playZonesContainer) {
        if (isSnapToGridEnabled) {
            playZonesContainer.classList.add('snap-grid-enabled');
        } else {
            playZonesContainer.classList.remove('snap-grid-enabled');
        }
    }
    
    // Update grid visuals with current card size
    updateGridVisuals();
    
    savePersistentSettings(); // Save settings when changed
    hideBottomBarContextMenu(); // Hide context menu after selection
});

// Tab hover preview toggle
tabHoverPreviewToggleBtn.addEventListener('click', () => {
    isTabHoverPreviewEnabled = !isTabHoverPreviewEnabled;
    updateTabHoverPreviewStatusUI();
    savePersistentSettings(); // Save settings when changed
    hideBottomBarContextMenu(); // Hide context menu after selection
});

// Toggle spacing slider visibility
toggleSpacingSliderBtn.addEventListener('click', () => {
    isSpacingSliderVisible = !isSpacingSliderVisible;
    updateSpacingSliderVisibilityUI();
    savePersistentSettings(); // Save settings when changed
    hideBottomBarContextMenu(); // Hide context menu after selection
});

// Bottom bar settings gear button
bottomBarSettingsBtn.addEventListener('click', (e) => {
    // Create a fake context menu event at the gear button's position
    const rect = bottomBarSettingsBtn.getBoundingClientRect();
    const fakeEvent = {
        clientX: rect.left,
        clientY: rect.bottom + 5, // Position slightly below the button
        preventDefault: () => {}
    };
    showBottomBarContextMenu(fakeEvent);
});

// Magnify size slider event listeners
magnifySizeSlider.addEventListener('input', (e) => {
    const width = parseInt(e.target.value);
    magnifyPreviewWidth = width;
    // Calculate height maintaining card aspect ratio (80:107, which is standard Magic card ratio)
    magnifyPreviewHeight = Math.round(width * (107 / 80));
    // Update the global variable that cardFactory.js will use immediately
    window.magnifyPreviewSize = {
        width: magnifyPreviewWidth,
        height: magnifyPreviewHeight
    };
});

magnifySizeSlider.addEventListener('change', (e) => {
    // Update the global variable that cardFactory.js will use
    window.magnifyPreviewSize = {
        width: magnifyPreviewWidth,
        height: magnifyPreviewHeight
    };
    savePersistentSettings(); // Save settings when magnify size changes
});

function showMessage(message) {
    messageText.textContent = message;
    messageModal.classList.remove('hidden');
}

// Loading progress functions
let loadingModalTimeout = null;

function showLoadingProgress() {
    // Only show the modal if we have the elements and loading will take a moment
    if (loadingModal) {
        // Clear any existing timeout
        if (loadingModalTimeout) {
            clearTimeout(loadingModalTimeout);
        }
        
        // Show modal after a short delay to avoid flashing for quick loads
        loadingModalTimeout = setTimeout(() => {
            loadingModal.classList.remove('hidden');
            loadingProgressBar.style.width = '0%';
            loadingProgressText.textContent = 'Preparing to load cards...';
            loadingCurrentCard.textContent = '';
        }, 200); // 200ms delay
    }
}

function updateLoadingProgress(loaded, total, currentCard) {
    // Clear the delay timeout since we're definitely loading
    if (loadingModalTimeout) {
        clearTimeout(loadingModalTimeout);
        loadingModalTimeout = null;
    }
    
    // Show modal immediately if not already shown
    if (loadingModal && loadingModal.classList.contains('hidden')) {
        loadingModal.classList.remove('hidden');
        loadingProgressBar.style.width = '0%';
        loadingProgressText.textContent = 'Preparing to load cards...';
        loadingCurrentCard.textContent = '';
    }
    
    if (loadingModal && !loadingModal.classList.contains('hidden')) {
        const percentage = Math.round((loaded / total) * 100);
        loadingProgressBar.style.width = `${percentage}%`;
        
        if (total === 0) {
            loadingProgressText.textContent = 'All cards already loaded!';
            loadingCurrentCard.textContent = '';
        } else {
            loadingProgressText.textContent = `Loading ${loaded} of ${total} new cards (${percentage}%)`;
            if (currentCard && currentCard !== 'Starting...' && !currentCard.includes('from cache')) {
                // Truncate long card names
                const displayName = currentCard.length > 30 ? currentCard.substring(0, 27) + '...' : currentCard;
                loadingCurrentCard.textContent = `Current: ${displayName}`;
            } else if (currentCard && currentCard.includes('from cache')) {
                // Show cache completion message
                loadingCurrentCard.textContent = currentCard;
            } else {
                loadingCurrentCard.textContent = currentCard || '';
            }
        }
    }
}

function hideLoadingProgress() {
    // Clear any pending timeout
    if (loadingModalTimeout) {
        clearTimeout(loadingModalTimeout);
        loadingModalTimeout = null;
    }
    
    if (loadingModal) {
        loadingModal.classList.add('hidden');
    }
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

// Selection update functions
function sendSelectionUpdate() {
    if (!playerId || !gameState) return;
    socket.emit('updateSelection', {
        selectedCardIds: selectedCardIds
    });
}

function debouncedSendSelectionUpdate() {
    if (selectionUpdateTimeout) {
        clearTimeout(selectionUpdateTimeout);
    }
    selectionUpdateTimeout = setTimeout(sendSelectionUpdate, 100); // 100ms debounce
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
                // Library was shuffled, sync the shuffled order back to the main library array
                if (libraryZone && libraryZone.cards) {
                    library = [...libraryZone.cards];
                    // Mark this as a client action to preserve the shuffle order temporarily
                    markClientAction('shuffle', null);
                }
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
                // Graveyard was shuffled, sync the shuffled order back to the main graveyard array
                if (graveyardZone && graveyardZone.cards) {
                    graveyard = [...graveyardZone.cards];
                    // Mark this as a client action to preserve the shuffle order temporarily
                    markClientAction('shuffle', null);
                }
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
                // Exile was shuffled, sync the shuffled order back to the main exile array
                if (exileZone && exileZone.cards) {
                    exile = [...exileZone.cards];
                    // Mark this as a client action to preserve the shuffle order temporarily
                    markClientAction('shuffle', null);
                }
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
let isRejoinState = false; // Track if we're in a rejoin state

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
        
        // Get current player's actual game state (for sendMove())
        const ourLibrary = gameState.players[playerId]?.library || [];
        const ourGraveyard = gameState.players[playerId]?.graveyard || [];
        const ourExile = gameState.players[playerId]?.exile || [];
        const ourCommand = gameState.players[playerId]?.command || [];
        const ourPlayZone = gameState.playZones[playerId] || [];
        
        // Other zones show data for the player whose play zone is currently being viewed
        const viewedPlayerId = activePlayZonePlayerId || playerId;
        currentlyViewedPlayerId = viewedPlayerId; // Update the global tracking variable
        const serverLibrary = gameState.players[viewedPlayerId]?.library || [];
        const serverGraveyard = gameState.players[viewedPlayerId]?.graveyard || [];
        const serverExile = gameState.players[viewedPlayerId]?.exile || [];
        const serverCommand = gameState.players[viewedPlayerId]?.command || [];
        const serverPlayZone = gameState.playZones[viewedPlayerId] || [];
        
        // If we have a recent client action, preserve local state for a short time
        // BUT if this is a rejoin, always use server state
        const hasRecentClientAction = lastClientAction && (Date.now() - lastClientAction.timestamp < 1000) && !isRejoinState;
        
        if (hasRecentClientAction && viewedPlayerId === playerId) {
            // Only preserve local state if we're viewing our own zones AND not rejoining
            console.log('Preserving local state due to recent client action:', lastClientAction.action);
            // Keep local state for recent actions, but merge other players' changes
            // Only merge playZone from server if it has more cards (other players added cards)
            if (ourPlayZone.length > playZone.length) {
                // Merge server cards that aren't in our local state
                ourPlayZone.forEach(serverCard => {
                    if (!playZone.find(localCard => localCard.id === serverCard.id)) {
                        playZone.push(serverCard);
                    }
                });
            }
        } else {
            // No recent client action, viewing another player, or rejoining - use server state as source of truth
            console.log('Using server state as source of truth', { 
                isRejoin: isRejoinState, 
                hasRecentClientAction, 
                viewedPlayerId, 
                playerId,
                serverHandCount: serverHand.length,
                ourLibraryCount: ourLibrary.length,
                ourGraveyardCount: ourGraveyard.length,
                ourExileCount: ourExile.length,
                ourCommandCount: ourCommand.length,
                ourPlayZoneCount: ourPlayZone.length
            });
            hand = serverHand; // Hand is always current player
            
            // Update life total from server for current player
            if (gameState.players[playerId]?.life !== undefined) {
                currentLife = gameState.players[playerId].life;
                lifeTotalEl.textContent = currentLife;
            }
            
            if (viewedPlayerId === playerId) {
                // Viewing our own zones - use our data
                library = ourLibrary;
                graveyard = ourGraveyard;
                exile = ourExile;
                command = ourCommand;
                playZone = ourPlayZone;
            } else {
                // Viewing another player's zones - still use OUR data for local state!
                // This ensures sendMove() always sends our actual game state, not opponent's
                library = ourLibrary;
                graveyard = ourGraveyard;
                exile = ourExile;
                command = ourCommand;
                playZone = ourPlayZone;
            }
        }

        // Update CardZone instances (these now have change detection)
        // Only allow interactions if we're viewing our own zones
        const allowInteractions = viewedPlayerId === playerId;
        
        // Initialize card zones if they don't exist (e.g., after rejoin)
        if (!libraryZone || !graveyardZone || !exileZone || !commandZone) {
            console.log('Initializing card zones (missing after rejoin)');
            initializeCardZones();
        }
        
        if (libraryZone) {
            // Always use the correct data for display: our data when viewing ourselves, opponent's when viewing them
            const displayLibrary = viewedPlayerId === playerId ? library : (() => {
                // For opponent's library, use cached shuffled version
                const cacheKey = `${viewedPlayerId}-${serverLibrary.length}-${JSON.stringify(serverLibrary.slice(0, 3))}`;
                if (!shuffledLibraryCache.has(cacheKey)) {
                    const shuffledCopy = [...serverLibrary];
                    shuffleArray(shuffledCopy);
                    shuffledLibraryCache.set(cacheKey, shuffledCopy);
                    
                    // Clear old cache entries to prevent memory leaks (keep only last 10)
                    if (shuffledLibraryCache.size > 10) {
                        const firstKey = shuffledLibraryCache.keys().next().value;
                        shuffledLibraryCache.delete(firstKey);
                    }
                }
                return shuffledLibraryCache.get(cacheKey);
            })();
            libraryZone.updateCards(displayLibrary);
            libraryZone.setInteractionEnabled(allowInteractions);
        }
        if (graveyardZone) {
            graveyardZone.updateCards(viewedPlayerId === playerId ? graveyard : serverGraveyard);
            graveyardZone.setInteractionEnabled(allowInteractions);
        }
        if (exileZone) {
            exileZone.updateCards(viewedPlayerId === playerId ? exile : serverExile);
            exileZone.setInteractionEnabled(allowInteractions);
        }
        if (commandZone) {
            commandZone.updateCards(viewedPlayerId === playerId ? command : serverCommand);
            commandZone.setInteractionEnabled(allowInteractions);
        }

        // Render hand
        handZoneEl.innerHTML = '';
        hand.forEach(card => {
            handZoneEl.appendChild(createCardElement(card, 'hand', {
                isMagnifyEnabled: isMagnifyEnabled,
                isInteractable: allowInteractions, // Only allow full interactability when viewing your own zones
                onCardClick: handleCardClick, // Always allow clicking for selection
                onCardDblClick: allowInteractions ? handleCardDoubleClick : null, // Only allow double-click on own cards
                onCardDragStart: allowInteractions ? handleCardDragStart : null, // Only allow dragging own cards
                onCounterClick: allowInteractions ? handleCounterClick : null, // Only allow counter interactions on own cards
                showBack: card.faceShown === 'back',
                playerSelections: allPlayerSelections,
                playerColors: playerColors
            }));
        });
        
        // Apply card spacing after rendering hand cards
        updateCardSpacing();

    // Render play zones and tabs
    playZonesContainer.innerHTML = '';
    
    // Create or update battlefield label overlay
    let battlefieldLabelEl = document.getElementById('battlefield-label-overlay');
    if (!battlefieldLabelEl) {
        battlefieldLabelEl = document.createElement('div');
        battlefieldLabelEl.id = 'battlefield-label-overlay';
        battlefieldLabelEl.className = 'battlefield-label-overlay';
        playZonesContainer.appendChild(battlefieldLabelEl);
    }
    
    // Update battlefield label for active player
    if (gameState.players[activePlayZonePlayerId]) {
        const playerDisplayName = gameState.players[activePlayZonePlayerId]?.displayName || 'Unknown Player';
        battlefieldLabelEl.textContent = `${playerDisplayName}'s Battlefield`;
        battlefieldLabelEl.style.display = 'block';
    } else {
        battlefieldLabelEl.style.display = 'none';
    }
    
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
        playerZoneEl.className = 'play-zone relative';
        
        const playerZoneData = gameState.playZones[pid] || [];
        
        // Calculate the minimum size needed to contain all cards
        let minWidth = 100; // Very minimal default
        let minHeight = 100;
        
        if (playerZoneData.length > 0) {
            let maxX = 0;
            let maxY = 0;
            
            playerZoneData.forEach(cardData => {
                const cardRight = (cardData.x || 0) + currentCardWidth;
                const cardBottom = (cardData.y || 0) + (currentCardWidth * 120/90); // Card height
                maxX = Math.max(maxX, cardRight);
                maxY = Math.max(maxY, cardBottom);
            });
            
            // Add minimal padding beyond the furthest cards
            const padding = 50;
            minWidth = Math.max(minWidth, maxX + padding);
            minHeight = Math.max(minHeight, maxY + padding);
        }
        
        playerZoneEl.style.width = `${minWidth}px`;
        playerZoneEl.style.height = `${minHeight}px`;
        playerZoneEl.style.minWidth = '100%';
        playerZoneEl.style.minHeight = '100%';
        
        if (pid !== activePlayZonePlayerId) {
            playerZoneEl.style.display = 'none';
        }
        
        playerZoneData.forEach(cardData => {
            const isOwnCard = (pid === activePlayZonePlayerId && pid === playerId);
            const cardEl = createCardElement(cardData, 'play', {
                isMagnifyEnabled: isMagnifyEnabled,
                isInteractable: isOwnCard, // Only allow full interactability for own cards
                onCardClick: handleCardClick, // Always allow clicking for selection
                onCardDblClick: isOwnCard ? handleCardDoubleClick : null, // Only allow double-click on own cards
                onCardDragStart: isOwnCard ? handleCardDragStart : null, // Only allow dragging own cards
                onCounterClick: isOwnCard ? handleCounterClick : null, // Only allow counter interactions on own cards
                showBack: cardData.faceShown === 'back',
                playerSelections: allPlayerSelections,
                playerColors: playerColors
            });
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${cardData.x}px`;
            cardEl.style.top = `${cardData.y}px`;
            cardEl.style.transform = `rotate(${cardData.rotation || 0}deg)`;
            cardEl.style.zIndex = '10'; // Ensure regular cards appear above ghost cards
            playerZoneEl.appendChild(cardEl);
        });
        
        // Add ghost cards if ghost mode is enabled and we're viewing another player's battlefield
        if (isGhostModeEnabled && pid !== playerId && pid === activePlayZonePlayerId) {
            const myPlayZoneData = gameState.playZones[playerId] || [];
            myPlayZoneData.forEach(cardData => {
                const ghostCardEl = createCardElement(cardData, 'play', {
                    isMagnifyEnabled: isMagnifyEnabled, // Enable magnify for ghost cards
                    isInteractable: false, // Ghost cards are not draggable
                    onCardClick: handleCardClick, // Allow clicking for selection
                    onCardDblClick: null, // No double-click for ghost cards
                    onCardDragStart: null, // No dragging for ghost cards
                    onCounterClick: null, // No counter interactions for ghost cards
                    showBack: cardData.faceShown === 'back',
                    isGhost: true, // Special flag to indicate this is a ghost card
                    playerSelections: allPlayerSelections,
                    playerColors: playerColors
                });
                
                // Style ghost cards with reduced opacity and different border
                ghostCardEl.style.position = 'absolute';
                ghostCardEl.style.left = `${cardData.x}px`;
                ghostCardEl.style.top = `${cardData.y}px`;
                ghostCardEl.style.transform = `rotate(${cardData.rotation || 0}deg)`;
                ghostCardEl.style.opacity = '0.4';
                ghostCardEl.style.border = '2px dashed #48bb78'; // Green dashed border for your cards
                ghostCardEl.style.borderRadius = '8px';
                ghostCardEl.style.filter = 'brightness(0.7) saturate(0.5)';
                ghostCardEl.style.cursor = 'default'; // Change cursor to indicate non-interactable
                ghostCardEl.style.zIndex = '1'; // Put ghost cards behind other player's cards
                
                // Add a subtle glow effect
                ghostCardEl.style.boxShadow = '0 0 8px rgba(72, 187, 120, 0.3)';
                
                // Prevent drag and drop events but allow hover events for magnify
                ghostCardEl.addEventListener('dragstart', (e) => e.preventDefault());
                ghostCardEl.addEventListener('drop', (e) => e.preventDefault());
                ghostCardEl.addEventListener('dragover', (e) => e.preventDefault());
                
                // Add a small indicator that this is your card
                const ghostIndicator = document.createElement('div');
                ghostIndicator.style.position = 'absolute';
                ghostIndicator.style.top = '-8px';
                ghostIndicator.style.right = '-8px';
                ghostIndicator.style.width = '16px';
                ghostIndicator.style.height = '16px';
                ghostIndicator.style.backgroundColor = '#48bb78';
                ghostIndicator.style.borderRadius = '50%';
                ghostIndicator.style.border = '2px solid #fff';
                ghostIndicator.style.fontSize = '10px';
                ghostIndicator.style.color = 'white';
                ghostIndicator.style.display = 'flex';
                ghostIndicator.style.alignItems = 'center';
                ghostIndicator.style.justifyContent = 'center';
                ghostIndicator.style.fontWeight = 'bold';
                ghostIndicator.style.pointerEvents = 'none'; // Indicator shouldn't interfere with hover
                ghostIndicator.textContent = '👤'; // User icon to indicate it's your card
                ghostIndicator.title = 'Your card (ghost view)';
                
                ghostCardEl.appendChild(ghostIndicator);
                playerZoneEl.appendChild(ghostCardEl);
            });
        }
        
        // Add reverse ghost cards if reverse ghost mode is enabled and we're viewing our own battlefield
        if (isReverseGhostModeEnabled && pid === playerId && pid === activePlayZonePlayerId) {
            // Show ghost cards of the current turn player (if different from us)
            if (gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined) {
                const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurn];
                if (currentTurnPlayerId && currentTurnPlayerId !== playerId && gameState.playZones[currentTurnPlayerId]) {
                    const activePlayerZoneData = gameState.playZones[currentTurnPlayerId] || [];
                    activePlayerZoneData.forEach(cardData => {
                        const reverseGhostCardEl = createCardElement(cardData, 'play', {
                            isMagnifyEnabled: isMagnifyEnabled, // Enable magnify for reverse ghost cards
                            isInteractable: false, // Reverse ghost cards are not draggable
                            onCardClick: handleCardClick, // Allow clicking for selection
                            onCardDblClick: null, // No double-click for reverse ghost cards
                            onCardDragStart: null, // No dragging for reverse ghost cards
                            onCounterClick: null, // No counter interactions for reverse ghost cards
                            showBack: cardData.faceShown === 'back',
                            isReverseGhost: true, // Special flag to indicate this is a reverse ghost card
                            playerSelections: allPlayerSelections,
                            playerColors: playerColors
                        });
                        
                        // Style reverse ghost cards with reduced opacity and different border (orange theme)
                        reverseGhostCardEl.style.position = 'absolute';
                        reverseGhostCardEl.style.left = `${cardData.x}px`;
                        reverseGhostCardEl.style.top = `${cardData.y}px`;
                        reverseGhostCardEl.style.transform = `rotate(${cardData.rotation || 0}deg)`;
                        reverseGhostCardEl.style.opacity = '0.3';
                        reverseGhostCardEl.style.border = '2px dashed #f59e0b'; // Orange dashed border for active player's cards
                        reverseGhostCardEl.style.borderRadius = '8px';
                        reverseGhostCardEl.style.filter = 'brightness(0.6) saturate(0.4) hue-rotate(30deg)';
                        reverseGhostCardEl.style.cursor = 'default'; // Change cursor to indicate non-interactable
                        reverseGhostCardEl.style.zIndex = '2'; // Put reverse ghost cards between normal ghosts and regular cards
                        
                        // Add a subtle orange glow effect
                        reverseGhostCardEl.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.4)';
                        
                        // Prevent drag and drop events but allow hover events for magnify
                        reverseGhostCardEl.addEventListener('dragstart', (e) => e.preventDefault());
                        reverseGhostCardEl.addEventListener('drop', (e) => e.preventDefault());
                        reverseGhostCardEl.addEventListener('dragover', (e) => e.preventDefault());
                        
                        // Add a small indicator that this is the active player's card
                        const reverseGhostIndicator = document.createElement('div');
                        reverseGhostIndicator.style.position = 'absolute';
                        reverseGhostIndicator.style.top = '-8px';
                        reverseGhostIndicator.style.right = '-8px';
                        reverseGhostIndicator.style.width = '16px';
                        reverseGhostIndicator.style.height = '16px';
                        reverseGhostIndicator.style.backgroundColor = '#f59e0b';
                        reverseGhostIndicator.style.borderRadius = '50%';
                        reverseGhostIndicator.style.border = '2px solid #fff';
                        reverseGhostIndicator.style.fontSize = '10px';
                        reverseGhostIndicator.style.color = 'white';
                        reverseGhostIndicator.style.display = 'flex';
                        reverseGhostIndicator.style.alignItems = 'center';
                        reverseGhostIndicator.style.justifyContent = 'center';
                        reverseGhostIndicator.style.fontWeight = 'bold';
                        reverseGhostIndicator.style.pointerEvents = 'none'; // Indicator shouldn't interfere with hover
                        reverseGhostIndicator.textContent = '⚡'; // Lightning icon to indicate active player's card
                        reverseGhostIndicator.title = `${gameState.players[currentTurnPlayerId]?.displayName || 'Active player'}'s card (reverse ghost view)`;
                        
                        reverseGhostCardEl.appendChild(reverseGhostIndicator);
                        playerZoneEl.appendChild(reverseGhostCardEl);
                    });
                }
            }
        }
        playZonesContainer.appendChild(playerZoneEl);
        
        // Set room name as data attribute for CSS background display
        if (room) {
            playerZoneEl.setAttribute('data-room-name', room);
        }

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
            // Reset any hover state when clicking on a tab
            resetTabHoverState();
            activePlayZonePlayerId = pid;
            render();
        });
        
        // Add hover functionality for tab preview
        tabEl.addEventListener('mouseenter', () => {
            if (isTabHoverPreviewEnabled && pid !== activePlayZonePlayerId) {
                // Clear any existing hover timeout
                if (hoverTimeoutId) {
                    clearTimeout(hoverTimeoutId);
                }
                
                // Store the original active player if we haven't already
                if (!isHoveringTab) {
                    originalActivePlayZonePlayerId = activePlayZonePlayerId;
                    isHoveringTab = true;
                }
                
                // Switch to the hovered player's zone after a short delay
                hoverTimeoutId = setTimeout(() => {
                    activePlayZonePlayerId = pid;
                    render();
                }, 150); // Small delay to prevent accidental triggers
            }
        });
        
        tabEl.addEventListener('mouseleave', () => {
            if (isTabHoverPreviewEnabled && isHoveringTab) {
                // Clear the hover timeout
                if (hoverTimeoutId) {
                    clearTimeout(hoverTimeoutId);
                    hoverTimeoutId = null;
                }
                
                // Restore the original active player zone after a delay
                setTimeout(() => {
                    if (isHoveringTab && originalActivePlayZonePlayerId !== null) {
                        activePlayZonePlayerId = originalActivePlayZonePlayerId;
                        isHoveringTab = false;
                        originalActivePlayZonePlayerId = null;
                        render();
                    }
                }, 100); // Small delay to allow moving to another tab
            }
        });
        
        playerTabsEl.appendChild(tabEl);
    });
    
    // Update turn control UI
    console.log('Updating turn control UI:', {
        turnOrderSet: gameState.turnOrderSet,
        turnOrder: gameState.turnOrder,
        currentTurn: gameState.currentTurn,
        turnCounter: gameState.turnCounter
    });
    
    if (gameState.turnOrderSet && gameState.turnOrder && gameState.currentTurn !== undefined) {
        const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurn];
        const currentPlayer = gameState.players[currentTurnPlayerId];
        const turnCounter = gameState.turnCounter || 1; // Default to 1 if not set
        
        console.log('Turn control - current player:', currentTurnPlayerId, 'my player ID:', playerId, 'is my turn:', currentTurnPlayerId === playerId, 'turn:', turnCounter);
        
        if (currentPlayer) {
            // Player exists and is connected
            turnIndicator.style.display = 'block';
            
            // Display current player and turn counter
            const playerText = currentTurnPlayerId === playerId ? 'You' : currentPlayer.displayName;
            currentPlayerNameEl.textContent = `${playerText} (Turn ${turnCounter})`;
            
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
            // Current turn player is disconnected - this shouldn't happen with server-side skipping
            // but handle it gracefully
            console.log('Current turn player is disconnected, hiding turn indicator');
            turnIndicator.style.display = 'none';
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
            
            // For hand zone, don't show active state if we're viewing another player's zones
            // (This provides visual feedback that the drop won't be allowed)
            if (zone.id === 'hand-zone' && currentlyViewedPlayerId !== playerId) {
                // Check if the drag types suggest this is from a card zone (rather than from play area)
                const types = Array.from(e.dataTransfer.types);
                if (types.includes('text/plain') && types.includes('sourceZone')) {
                    return; // Don't show active state
                }
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
                    
                    // Calculate base position and snap it to grid first
                    const rect = zone.getBoundingClientRect();
                    let baseX = e.clientX - rect.left - (currentCardWidth / 2);
                    let baseY = e.clientY - rect.top - ((currentCardWidth * 120/90) / 2);
                    
                    // Apply snap to grid to the base position only
                    const snappedBasePos = snapToGrid(baseX, baseY, zone);
                    
                    groupData.cardIds.forEach((cardId, index) => {
                        // Apply cascade offset to the snapped base position
                        let x = snappedBasePos.x + (index * cascadeOffset);
                        let y = snappedBasePos.y + (index * cascadeOffset);
                        
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
                    // Check if drag is coming from another player's zone by checking source zone type and current viewed player
                    const sourceZone = groupData.sourceZone;
                    const isViewingOtherPlayer = currentlyViewedPlayerId !== playerId;
                    
                    // Prevent moving cards from other players' zones to our hand
                    if (isViewingOtherPlayer && (sourceZone === 'library' || sourceZone === 'graveyard' || sourceZone === 'exile' || sourceZone === 'command')) {
                        console.log('Cannot move cards from another player\'s zone to your hand');
                        return;
                    }
                    
                    groupData.cardIds.forEach(cardId => {
                        let cardObj = hand.find(c => c.id === cardId) || playZone.find(c => c.id === cardId) || graveyard.find(c => c.id === cardId) || exile.find(c => c.id === cardId) || command.find(c => c.id === cardId) || library.find(c => c.id === cardId);
                        if (!cardObj) {
                            console.error('Card not found for hand move:', cardId);
                            return;
                        }
                        
                        // If it's a placeholder card being moved out of play zone, remove it entirely
                        if (groupData.sourceZone === 'play' && cardObj.isPlaceholder) {
                            removeCardFromSource(cardId, groupData.sourceZone);
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
                const isViewingOtherPlayer = currentlyViewedPlayerId !== playerId;
                
                // Check if drag is coming from another player's zone and target is hand
                if (zone.id === 'hand-zone' && isViewingOtherPlayer && (sourceZone === 'library' || sourceZone === 'graveyard' || sourceZone === 'exile' || sourceZone === 'command')) {
                    console.log('Cannot move cards from another player\'s zone to your hand');
                    return;
                }
                
                // Handle cards from any source zone
                let cardObj = hand.find(c => c.id === cardId) || playZone.find(c => c.id === cardId) || graveyard.find(c => c.id === cardId) || exile.find(c => c.id === cardId) || command.find(c => c.id === cardId) || library.find(c => c.id === cardId);
                if (!cardObj) return;
                
                // For play zone drops, we need to handle positioning manually
                if (zone.id.startsWith('play-zone')) {
                    const rect = zone.getBoundingClientRect();
                    let x = e.clientX - rect.left - (currentCardWidth / 2);
                    let y = e.clientY - rect.top - ((currentCardWidth * 120/90) / 2);
                    
                    // Apply snap to grid if enabled
                    const snappedPos = snapToGrid(x, y, zone);
                    x = snappedPos.x;
                    y = snappedPos.y;
                    
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
            debouncedSendSelectionUpdate();
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
        
        // Send selection update to server
        debouncedSendSelectionUpdate();
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
        debouncedSendSelectionUpdate();
    }
    // Hide context menus on any click (unless they were just shown)
    if (!contextMenuJustShown) {
        hideCardContextMenu();
    }
    if (!bottomBarContextMenuJustShown) {
        hideBottomBarContextMenu();
    }
});

// Context menu event handlers
document.addEventListener('contextmenu', (e) => {
    // Check if right-clicking on specific card areas first (higher priority)
    const isOnCard = e.target.closest('.card');
    const isOnHandZone = e.target.closest('#hand-zone');
    const isOnPlayZone = e.target.closest('.play-zone');
    const isOnLibrary = e.target.closest('#library');
    const isOnCardPile = e.target.closest('#graveyard-pile') || e.target.closest('#exile-pile') || e.target.closest('#command-pile');
    
    // If right-clicking on card-related areas, handle card context menu
    if (isOnCard || isOnHandZone || isOnPlayZone || isOnLibrary || isOnCardPile) {
        // Only show card context menu if we have selected cards, right-clicking in a valid area, AND viewing our own zones
        const isViewingOwnZones = currentlyViewedPlayerId === playerId;
        const isInOwnPlayZone = activePlayZonePlayerId === playerId;
        
        if (selectedCards.length > 0 && 
            (isOnPlayZone || isOnHandZone || isOnCard) &&
            (isViewingOwnZones || isInOwnPlayZone)) {
            showCardContextMenu(e);
        }
        return; // Don't show bottom bar context menu
    }
    
    // Check if right-clicking on the bottom bar (but not on card areas)
    if (e.target.closest('#bottom-bar')) {
        showBottomBarContextMenu(e);
        return;
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
    console.log('=== CREATING PLACEHOLDER CARD ===');
    console.log('Card name:', text);
    console.log('activePlayZonePlayerId:', activePlayZonePlayerId);
    console.log('playerId:', playerId);
    
    // Get the current player's play zone for snapping
    const currentPlayZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    console.log('Current play zone element:', currentPlayZone);
    
    // Apply snap to grid for default position if enabled
    const defaultPos = snapToGrid(50, 50, currentPlayZone);
    console.log('Default position after snap:', defaultPos);
    
    const placeholderCard = {
        id: generateCardId(),
        name: text,
        displayName: text,
        isPlaceholder: true, // Mark this as a placeholder card
        x: defaultPos.x, // Use snapped position
        y: defaultPos.y,
        rotation: 0
    };
    
    console.log('Created placeholder card:', placeholderCard);
    console.log('playZone before adding:', playZone.length, 'cards');
    
    // Mark this as a client action to preserve optimistic updates
    markClientAction('createPlaceholder', placeholderCard.id);
    
    // Add to play zone immediately (shows as placeholder initially)
    playZone.push(placeholderCard);
    
    console.log('playZone after adding:', playZone.length, 'cards');
    console.log('Last card in playZone:', playZone[playZone.length - 1]);
    
    // Re-render to show the placeholder card
    render();
    
    // Send update to server
    sendMove();
    
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
    
    console.log('=== END PLACEHOLDER CARD CREATION ===');
}

// Create copies of selected cards
async function createCopiesOfTargetCards() {
    // Switch to our own playzone before creating copies
    if (activePlayZonePlayerId !== playerId) {
        activePlayZonePlayerId = playerId;
        currentlyViewedPlayerId = playerId;
        // Re-render to switch the view immediately
        render();
    }
    
    // Determine which cards to copy: selected cards take priority, fallback to hovered card
    let targetCards = [];
    let targetCardElements = [];
    
    if (selectedCards.length > 0) {
        targetCards = selectedCards.map(cardEl => {
            const cardId = cardEl.dataset.id;
            const result = findCardObjectByIdGlobal(cardId);
            return result ? result.card : null;
        }).filter(card => card !== null);
        targetCardElements = selectedCards;
    } else if (hoveredCard && hoveredCardElement) {
        targetCards = [hoveredCard];
        targetCardElements = [hoveredCardElement];
    }
    
    if (targetCardElements.length === 0) return;
    
    let copiesCreated = 0;
    const cascadeOffset = 15;
    
    for (let index = 0; index < targetCardElements.length; index++) {
        const cardEl = targetCardElements[index];
        const cardId = cardEl.dataset.id;
        const result = findCardObjectByIdGlobal(cardId);
        const originalCard = result ? result.card : null;
        
        console.log(`=== COPY CREATION DEBUG ===`);
        console.log(`Card ID: ${cardId}`);
        console.log(`Original card found:`, originalCard);
        console.log(`Card belongs to player:`, result ? result.playerId : 'none');
        console.log(`Current user ID:`, playerId);
        
        if (originalCard) {
            // Determine which play zone the original card is in
            const originalCardElement = targetCardElements[index];
            const originalPlayZone = originalCardElement.closest('[id^="play-zone-"]');
            
            // Calculate base position and apply snap to grid first
            let baseX = (originalCard.x || 50) + cascadeOffset;
            let baseY = (originalCard.y || 50) + cascadeOffset;
            
            // Apply snap to grid to the base position
            const snappedBasePos = snapToGrid(baseX, baseY, originalPlayZone);
            
            // Apply cascade offset to the snapped base position
            let x = snappedBasePos.x + (index * 10);
            let y = snappedBasePos.y + (index * 10);
            
            // Create a copy with the same visual properties but marked as a copy
            const copyCard = {
                id: generateCardId(),
                name: originalCard.name,
                displayName: originalCard.displayName || originalCard.name,
                isPlaceholder: true, // Mark as placeholder so it disappears when moved out of play
                isCopy: true, // Mark as a copy
                faceShown: originalCard.faceShown || 'front', // Preserve which face is shown
                x: x, // Use snapped position
                y: y, // Use snapped position
                rotation: 0 // Copies start untapped
            };
            
            // If the original card has counters, don't copy them (copies start fresh)
            
            // Add to play zone
            playZone.push(copyCard);
            copiesCreated++;
            
            console.log(`Copy card created and added to playZone:`, copyCard);
            console.log(`Total cards in playZone now:`, playZone.length);
            console.log(`=== END COPY CREATION DEBUG ===`);
            
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
        // Clear selection after creating copies (only if we used selected cards)
        if (selectedCards.length > 0) {
            selectedCards.forEach(c => c.classList.remove('selected-card'));
            selectedCards = [];
            selectedCardIds = [];
        }
        
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
let currentCardSpacing = 0; // Default spacing (0 = no gap, negative = overlap)

// Cache for shuffled other players' libraries to avoid re-shuffling on every render
let shuffledLibraryCache = new Map();

// Card interaction callbacks for the cardFactory
function handleCardClick(e, card, cardEl, location) {
    e.stopPropagation();
    
    // Allow selection of any card, but only allow full interaction with own cards
    const isOwnCard = (location === 'hand') || (location === 'play' && activePlayZonePlayerId === playerId);
    
    const cardId = cardEl.dataset.id;
    const isSelected = selectedCardIds.includes(cardId);
    
    if (!e.ctrlKey && !e.metaKey) {
        // For single clicks without modifiers, if the card is already selected (and it's the only selected card),
        // deselect it. Otherwise, clear all selections and select only this card.
        if (isSelected && selectedCardIds.length === 1) {
            // Deselect the single selected card
            selectedCards.forEach(c => c.classList.remove('selected-card'));
            selectedCards = [];
            selectedCardIds = [];
        } else {
            // Clear all selections and select only this card
            selectedCards.forEach(c => c.classList.remove('selected-card'));
            selectedCards = [];
            selectedCardIds = [];
            
            // Add this card to selection
            selectedCardIds.push(cardId);
            selectedCards.push(cardEl);
            cardEl.classList.add('selected-card');
        }
    } else {
        // With modifier keys, toggle the selection of this specific card
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
    
    // Send selection update to server
    debouncedSendSelectionUpdate();
}

function handleCardDoubleClick(e, card, location) {
    e.stopPropagation();
    
    // Only allow double-click interactions on own cards
    const isOwnCard = (location === 'hand') || (location === 'play' && activePlayZonePlayerId === playerId);
    if (!isOwnCard) return; // Don't allow double-click interactions on other players' cards
    
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
            
            // Calculate cascade offset - ensure it's at least as large as grid size to prevent overlap when snap-to-grid is enabled
            const gridSize = isSnapToGridEnabled ? getScaledGridSize() : 15;
            const cascadeOffset = Math.max(15, gridSize);
            const initialX = 10;
            const initialY = 10;
            const maxCardsPerRow = 5;
            const row = Math.floor(cascadedHandCardsInAreaCount / maxCardsPerRow);
            const col = cascadedHandCardsInAreaCount % maxCardsPerRow;
            
            // Calculate base position
            let baseX = initialX + (col * cascadeOffset);
            let baseY = initialY + (row * cascadeOffset);
            
            // Get the current player's play zone for snapping
            const currentPlayZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
            
            // Apply snap to grid to the base position
            const snappedPos = snapToGrid(baseX, baseY, currentPlayZone);
            let x = snappedPos.x;
            let y = snappedPos.y;
            
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
    // Only allow dragging own cards
    const isOwnCard = (location === 'hand') || (location === 'play' && activePlayZonePlayerId === playerId);
    if (!isOwnCard) {
        e.preventDefault(); // Prevent dragging other players' cards
        return;
    }
    
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
    // Load persistent settings first
    loadPersistentSettings();
    
    // Apply loaded card width
    updateCardSize();
    updateCardSpacing();
    
    // Apply loaded image quality settings to cardFactory
    updateImageQualityCutoffs(isEnhancedImageQualityEnabled);
    
    // Initialize Scryfall cache from localStorage
    console.log('Initializing Scryfall cache...');
    const cacheStats = ScryfallCache.getCacheStats();
    console.log('Initial cache stats:', cacheStats);
    
    updateMagnifyStatusUI(); // Set initial status
    updateAutoFocusStatusUI(); // Set initial auto-focus status
    updateGhostModeStatusUI(); // Set initial ghost mode status
    updateReverseGhostModeStatusUI(); // Set initial reverse ghost mode status
    updateAutoUntapStatusUI(); // Set initial auto-untap status
    updateEnhancedImageQualityStatusUI(); // Set initial enhanced image quality status
    updateSnapToGridStatusUI(); // Set initial snap to grid status
    updateTabHoverPreviewStatusUI(); // Set initial tab hover preview status
    updateSpacingSliderVisibilityUI(); // Set initial spacing slider visibility
    
    // Initialize card spacing slider with loaded settings
    if (cardSpacingSlider) {
        cardSpacingSlider.value = currentCardSpacing;
        updateCardSpacing(); // Apply the loaded spacing immediately
    }
    
    // Initialize commander selection modal button state
    if (confirmCommanderSelectionBtn) {
        confirmCommanderSelectionBtn.disabled = true;
        confirmCommanderSelectionBtn.classList.add('opacity-50', 'cursor-not-allowed');
        console.log('Commander selection modal elements initialized successfully');
    } else {
        console.error('Commander selection modal elements not found during initialization!');
        console.log('Available modal elements:', {
            commanderSelectionModal: !!document.getElementById('commander-selection-modal'),
            commanderSelectionList: !!document.getElementById('commander-selection-list'),
            selectedCommandersCount: !!document.getElementById('selected-commanders-count'),
            confirmCommanderSelectionBtn: !!document.getElementById('confirm-commander-selection-btn'),
            cancelCommanderSelectionBtn: !!document.getElementById('cancel-commander-selection-btn')
        });
    }
    
    // Update global variables for other modules
    window.isSnapToGridEnabled = isSnapToGridEnabled;
    
    // Initialize grid visuals with current card size
    updateGridVisuals();
    
    initializeCardZones(); // Initialize the card zones
    
    // Initialize magnify size slider and global variable with loaded settings
    magnifySizeSlider.value = magnifyPreviewWidth; // Set slider to saved value
    magnifyPreviewHeight = Math.round(magnifyPreviewWidth * (107 / 80)); // Recalculate height based on loaded width
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
    // Determine which cards to operate on: selected cards take priority, fallback to hovered card
    let targetCards = [];
    let targetCardElements = [];
    
    if (selectedCards.length > 0) {
        // Filter selected cards to only include cards that belong to the current player
        const ownedSelectedCards = selectedCards.filter(cardEl => {
            const cardParent = cardEl.closest('#hand-zone') || cardEl.closest(`#play-zone-${playerId}`);
            return cardParent !== null;
        });
        
        if (ownedSelectedCards.length > 0) {
            targetCards = ownedSelectedCards.map(cardEl => {
                const cardId = cardEl.dataset.id;
                return findCardObjectById(cardId);
            }).filter(card => card !== null);
            targetCardElements = ownedSelectedCards;
        }
    } else if (hoveredCard && hoveredCardElement) {
        // Use hovered card (already filtered by setHoveredCard)
        targetCards = [hoveredCard];
        targetCardElements = [hoveredCardElement];
    }
    
    if (e.code === 'Space' && targetCardElements.length > 0) {
        e.preventDefault();
        tapUntapCards(targetCardElements);
    } else if (e.code === 'KeyF' && targetCardElements.length > 0) {
        e.preventDefault();
        // Flip selected/hovered cards that have back faces
        targetCardElements.forEach(cardEl => {
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
    } else if (e.code === 'KeyX') {
        e.preventDefault();
        
        // Check if we have our own selected/hovered cards first
        if (targetCards.length > 0) {
            // Create copies of our own selected/hovered cards
            createCopiesOfTargetCards().catch(error => {
                console.error('Error creating copies:', error);
            });
        } else {
            // Check if any opponents have selected cards
            let opponentCardNames = [];
            
            console.log('=== DEBUGGING X KEY PRESS ===');
            console.log('Checking for opponent selections:', allPlayerSelections);
            console.log('Current local selections:', selectedCardIds);
            console.log('Current selectedCards elements:', selectedCards.length);
            
            // First check locally selected cards for opponent cards
            if (selectedCardIds && selectedCardIds.length > 0) {
                console.log('Checking locally selected cards for opponent cards...');
                for (const cardId of selectedCardIds) {
                    try {
                        const result = findCardObjectByIdGlobal(cardId);
                        console.log(`Card ${cardId} lookup result:`, result);
                        if (result && result.card && result.card.name && result.playerId !== playerId) {
                            console.log(`✓ Found locally selected opponent card: ${result.card.name} (${cardId}) from player ${result.playerId}`);
                            opponentCardNames.push(result.card.name);
                        } else if (result && result.playerId === playerId) {
                            console.log(`- Card ${cardId} belongs to current player, skipping`);
                        }
                    } catch (error) {
                        console.error('Error finding locally selected card:', cardId, error);
                    }
                }
            } else {
                console.log('No locally selected cards found');
            }
            
            // If no opponent cards found locally, check server-synced selections
            if (opponentCardNames.length === 0 && allPlayerSelections && Object.keys(allPlayerSelections).length > 0) {
                console.log('No opponent cards found locally, checking server selections...');
                for (const pid of Object.keys(allPlayerSelections)) {
                    if (pid === playerId) continue; // Skip our own selections
                    
                    const opponentSelectedCardIds = allPlayerSelections[pid] || [];
                    console.log(`Player ${pid} has ${opponentSelectedCardIds.length} selected cards:`, opponentSelectedCardIds);
                    
                    for (const cardId of opponentSelectedCardIds) {
                        try {
                            const result = findCardObjectByIdGlobal(cardId);
                            if (result && result.card && result.card.name) {
                                console.log(`✓ Found opponent card: ${result.card.name} (${cardId}) from player ${result.playerId}`);
                                opponentCardNames.push(result.card.name);
                            } else {
                                console.log(`Could not find card for ID: ${cardId}`);
                            }
                        } catch (error) {
                            console.error('Error finding opponent card:', cardId, error);
                        }
                    }
                }
            } else {
                console.log(`Found ${opponentCardNames.length} opponent cards locally, skipping server check`);
            }
            
            console.log('Final opponent card names:', opponentCardNames);
            console.log('=== END DEBUGGING ===');
            
            if (opponentCardNames.length > 0) {
                // Switch to our own playzone before creating placeholders
                if (activePlayZonePlayerId !== playerId) {
                    activePlayZonePlayerId = playerId;
                    currentlyViewedPlayerId = playerId;
                    // Re-render to switch the view immediately
                    debouncedRender();
                }
                
                // Create placeholders for each unique opponent card name
                const uniqueCardNames = [...new Set(opponentCardNames)];
                console.log(`Creating placeholders for opponent cards: ${uniqueCardNames.join(', ')}`);
                
                try {
                    // Create placeholders sequentially to avoid race conditions
                    const placeholderPromises = uniqueCardNames.map(cardName => createPlaceholderCard(cardName));
                    Promise.all(placeholderPromises).then(() => {
                        // Clear selection after creating placeholders
                        selectedCards.forEach(c => c.classList.remove('selected-card'));
                        selectedCards = [];
                        selectedCardIds = [];
                        debouncedSendSelectionUpdate();
                        
                    }).catch(error => {
                        console.error('Error creating placeholders:', error);
                    });
                } catch (error) {
                    console.error('Error creating placeholders:', error);
                }
            } else {
                // No cards selected by anyone
            }
        }
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

// Auto-untap functionality for when it becomes the player's turn
function autoUntapAllPlayerCards() {
    // Work directly with gameState.playZones instead of local playZone array
    if (!gameState || !gameState.playZones || !gameState.playZones[playerId]) {
        console.log('No play zone found for player:', playerId);
        return;
    }
    
    const playerPlayZone = gameState.playZones[playerId];
    if (!Array.isArray(playerPlayZone) || playerPlayZone.length === 0) {
        console.log('Player play zone is empty or invalid');
        return;
    }
    
    let cardsUntapped = 0;
    
    // Untap all tapped cards in the game state play zone
    playerPlayZone.forEach(cardData => {
        if (cardData.rotation && cardData.rotation !== 0) {
            cardData.rotation = 0;
            cardsUntapped++;
        }
    });
    
    // IMPORTANT: Sync the changes back to the local playZone array that gets sent to server
    if (playZone && Array.isArray(playZone)) {
        playZone.forEach(cardData => {
            if (cardData.rotation && cardData.rotation !== 0) {
                cardData.rotation = 0;
            }
        });
        
        // Also make sure local playZone matches the gameState data completely
        // This ensures the server gets the correct state
        playZone.length = 0; // Clear the array
        playZone.push(...playerPlayZone); // Copy all data from gameState
    }
    
    if (cardsUntapped > 0) {
        console.log(`Auto-untapped ${cardsUntapped} cards`);
        // Send the updated state to server immediately (no debouncing for auto-untap)
        sendMove();
        // Re-render to show the visual changes
        debouncedRender();
    } else {
        console.log('No tapped cards found to untap');
    }
}

function updateCascadedHandCardsInAreaCount() {
    // Count cards that are still in their original cascade positions
    // Use the same cascade offset calculation as in the double-click handler
    const gridSize = isSnapToGridEnabled ? getScaledGridSize() : 15;
    const cascadeOffset = Math.max(15, gridSize);
    const initialX = 10;
    const initialY = 10;
    const maxCardsPerRow = 5;
    
    // Get the current player's play zone for snapping calculations
    const currentPlayZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    
    let count = 0;
    for (let i = 0; i < playZone.length; i++) {
        const card = playZone[i];
        if (card.fromHandCascade) {
            // Calculate what the position should be for this cascade index
            const row = Math.floor(count / maxCardsPerRow);
            const col = count % maxCardsPerRow;
            let expectedX = initialX + (col * cascadeOffset);
            let expectedY = initialY + (row * cascadeOffset);
            
            // If snap to grid is enabled, snap the expected position to match what would be generated
            if (isSnapToGridEnabled) {
                const snappedExpected = snapToGrid(expectedX, expectedY, currentPlayZone);
                expectedX = snappedExpected.x;
                expectedY = snappedExpected.y;
            }
            
            // Check if the card is still in its original cascade position (with tolerance for grid snapping)
            const tolerance = isSnapToGridEnabled ? gridSize / 2 : 5;
            if (Math.abs(card.x - expectedX) < tolerance && Math.abs(card.y - expectedY) < tolerance) {
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
    
    // Update grid visuals to match new card size
    updateGridVisuals();
    
    // Save the new card width to persistent settings
    savePersistentSettings();
    
    // Re-render to apply new size
    render();
}

function updateCardSpacing() {
    // Update hand zone spacing to allow for card overlapping
    const handZone = document.getElementById('hand-zone');
    if (handZone) {
        const cards = handZone.querySelectorAll('.card');
        
        if (currentCardSpacing >= 0) {
            // Positive spacing: use gap property
            handZone.style.gap = `${currentCardSpacing * 0.25}rem`;
            // Reset any negative margins and z-index
            cards.forEach((card, index) => {
                card.style.marginLeft = '';
                card.style.zIndex = '';
            });
        } else {
            // Negative spacing: use negative margins for overlapping
            handZone.style.gap = '0';
            cards.forEach((card, index) => {
                if (index > 0) {
                    // Convert negative spacing to negative margin for overlap
                    const overlapAmount = Math.abs(currentCardSpacing) * 0.75; // Increased multiplier for more overlap
                    card.style.marginLeft = `-${overlapAmount}rem`;
                }
                // Set z-index so later cards appear on top
                card.style.zIndex = index.toString();
            });
        }
    }
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

// Add event listener for card spacing slider
cardSpacingSlider.addEventListener('input', (e) => {
    currentCardSpacing = parseFloat(e.target.value);
    updateCardSpacing();
    savePersistentSettings();
});

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
    
    // Double-check that we're viewing our own zones or operating on our own cards
    const isViewingOwnZones = currentlyViewedPlayerId === playerId;
    const isInOwnPlayZone = activePlayZonePlayerId === playerId;
    
    // Filter selected cards to only include cards from our own zones
    const ownedSelectedCards = selectedCards.filter(cardEl => {
        const cardParent = cardEl.closest('#hand-zone') || cardEl.closest(`#play-zone-${playerId}`);
        return cardParent !== null;
    });
    
    // Exit if no owned cards are selected or if we're not in our own zones
    if (ownedSelectedCards.length === 0 || (!isViewingOwnZones && !isInOwnPlayZone)) {
        return;
    }
    
    // Set flag to prevent immediate click events
    contextMenuJustShown = true;
    setTimeout(() => {
        contextMenuJustShown = false;
    }, 100);
    
    // Hide any existing context menu
    hideCardContextMenu();
    
    // Create context menu
    cardContextMenu = document.createElement('div');
    cardContextMenu.className = 'card-context-menu fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1';
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
    
    // Set Counters option
    const setCountersOption = document.createElement('button');
    setCountersOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
    setCountersOption.textContent = 'Set Counters...';
    setCountersOption.addEventListener('click', () => {
        setCountersForSelectedCards();
        hideCardContextMenu();
    });
    cardContextMenu.appendChild(setCountersOption);
    
    // Remove Counter option (only show if any selected card has counters)
    const hasCounters = selectedCards.some(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        return cardObj && cardObj.counters !== undefined && cardObj.counters !== 0;
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
    
    // Check if any selected card has related cards
    const relatedCards = getRelatedCardsFromSelection();
    if (relatedCards.length > 0) {
        // Add separator before related cards section
        const relatedSeparator = document.createElement('div');
        relatedSeparator.className = 'border-t border-gray-600 my-1';
        cardContextMenu.appendChild(relatedSeparator);
        
        // Add header for related cards section
        const relatedHeader = document.createElement('div');
        relatedHeader.className = 'px-4 py-1 text-gray-400 text-xs font-semibold uppercase';
        relatedHeader.textContent = `Create Related Cards (${relatedCards.length})`;
        cardContextMenu.appendChild(relatedHeader);
        
        // Create a scrollable container for related cards if there are more than 3
        if (relatedCards.length > 3) {
            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'max-h-32 overflow-y-auto border border-gray-600 rounded mx-2 mb-1';
            scrollContainer.style.maxHeight = '8rem'; // Roughly 3 items worth of height
            
            // Add option for each related card inside the scroll container
            relatedCards.forEach(relatedCard => {
                const relatedOption = document.createElement('button');
                relatedOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors text-sm border-b border-gray-700 last:border-b-0';
                
                // Format the display text based on card type
                let displayText = `Create "${relatedCard.name}"`;
                if (relatedCard.type && relatedCard.type !== 'related') {
                    const typeLabel = relatedCard.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    displayText += ` (${typeLabel})`;
                }
                
                relatedOption.textContent = displayText;
                relatedOption.addEventListener('click', () => {
                    createRelatedCardPlaceholder(relatedCard);
                    hideCardContextMenu();
                });
                scrollContainer.appendChild(relatedOption);
            });
            
            cardContextMenu.appendChild(scrollContainer);
        } else {
            // For 3 or fewer cards, show them normally without scroll container
            relatedCards.forEach(relatedCard => {
                const relatedOption = document.createElement('button');
                relatedOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors text-sm';
                
                // Format the display text based on card type
                let displayText = `Create "${relatedCard.name}"`;
                if (relatedCard.type && relatedCard.type !== 'related') {
                    const typeLabel = relatedCard.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    displayText += ` (${typeLabel})`;
                }
                
                relatedOption.textContent = displayText;
                relatedOption.addEventListener('click', () => {
                    createRelatedCardPlaceholder(relatedCard);
                    hideCardContextMenu();
                });
                cardContextMenu.appendChild(relatedOption);
            });
        }
    }
    
    // Ensure context menu stays within viewport
    document.body.appendChild(cardContextMenu);
    
    // Force a layout calculation to get accurate dimensions
    cardContextMenu.style.visibility = 'hidden';
    cardContextMenu.style.display = 'block';
    const rect = cardContextMenu.getBoundingClientRect();
    cardContextMenu.style.visibility = 'visible';
    
    // Adjust horizontal position if needed
    if (rect.right > window.innerWidth) {
        cardContextMenu.style.left = `${e.clientX - rect.width}px`;
    }
    
    // Adjust vertical position if needed
    if (rect.bottom > window.innerHeight) {
        // First try moving it up
        const newTop = e.clientY - rect.height;
        if (newTop >= 0) {
            cardContextMenu.style.top = `${newTop}px`;
        } else {
            // If it still doesn't fit, position it at the top of the viewport
            cardContextMenu.style.top = '10px';
            // Also ensure we don't exceed viewport height
            const maxHeight = window.innerHeight - 20; // 10px margin on top and bottom
            if (rect.height > maxHeight) {
                cardContextMenu.style.maxHeight = `${maxHeight}px`;
                cardContextMenu.style.overflowY = 'auto';
            }
        }
    }
}

// Helper function to get related cards from selected cards
function getRelatedCardsFromSelection() {
    const allRelatedCards = []; // Use array instead of Set for objects
    const seenCardIds = new Set(); // Use Set to track unique card IDs
    
    console.log('=== SEARCHING FOR RELATED CARDS ===');
    console.log('Selected cards:', selectedCards.length);
    
    // Go through each selected card and find its related cards
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        if (!cardObj) return;
        
        console.log(`Checking card: ${cardObj.name}`);
        
        // Get Scryfall data for this card
        const scryfallData = ScryfallCache.get(cardObj.name);
        if (!scryfallData) {
            console.log(`No Scryfall data found for: ${cardObj.name}`);
            return;
        }
        
        console.log(`Scryfall data found for: ${cardObj.name}`);
        console.log('All parts:', scryfallData.all_parts);
        
        if (!scryfallData.all_parts) {
            console.log(`No all_parts field for: ${cardObj.name}`);
            return;
        }
        
        // Process each related card
        scryfallData.all_parts.forEach(part => {
            // Skip the card itself
            if (part.name === scryfallData.name) {
                console.log(`Skipping self: ${part.name}`);
                return;
            }
            
            console.log(`Found related card: ${part.name} (${part.component || 'no component'}) URI: ${part.uri}`);
            
            // Extract card ID from URI for unique identification
            const cardId = part.uri.split('/').pop();
            
            // Skip if we've already seen this card ID
            if (seenCardIds.has(cardId)) {
                console.log(`Already found this card ID: ${cardId}`);
                return;
            }
            
            seenCardIds.add(cardId);
            
            // Show all related cards (tokens, meld results, combo pieces, etc.)
            // Common component types: 'token', 'meld_result', 'meld_part', 'combo_piece'
            // Some cards might not have a component field, so we'll include them too
            allRelatedCards.push({
                name: part.name,
                type: part.component || 'related',
                uri: part.uri,
                cardId: cardId // Store the unique card ID
            });
        });
    });
    
    console.log('Final related cards found:', allRelatedCards);
    console.log('=== END RELATED CARDS SEARCH ===');
    
    return allRelatedCards;
}

// Helper function to create a placeholder for a related card
async function createRelatedCardPlaceholder(relatedCard) {
    console.log('=== CREATING RELATED CARD PLACEHOLDER ===');
    console.log('Related card:', relatedCard);
    
    // Switch to our own playzone before creating the placeholder
    if (activePlayZonePlayerId !== playerId) {
        activePlayZonePlayerId = playerId;
        currentlyViewedPlayerId = playerId;
        // Re-render to switch the view immediately
        render();
    }
    
    // Get the current player's play zone for snapping
    const currentPlayZone = document.getElementById(`play-zone-${activePlayZonePlayerId}`);
    
    // Apply snap to grid for default position if enabled
    const defaultPos = snapToGrid(50, 50, currentPlayZone);
    
    const placeholderCard = {
        id: generateCardId(),
        name: relatedCard.name,
        displayName: relatedCard.name,
        isPlaceholder: true, // Mark this as a placeholder card
        isRelatedCard: true, // Mark this as a related card
        scryfallId: relatedCard.cardId, // Store the Scryfall ID for precise loading
        x: defaultPos.x, // Use snapped position
        y: defaultPos.y,
        rotation: 0
    };
    
    console.log('Created related card placeholder:', placeholderCard);
    
    // Mark this as a client action to preserve optimistic updates
    markClientAction('createRelatedPlaceholder', placeholderCard.id);
    
    // Add to play zone immediately
    playZone.push(placeholderCard);
    
    // Re-render to show the placeholder card
    render();
    
    // Send update to server
    sendMove();
    
    // Try to load Scryfall data for this specific card using its ID
    try {
        console.log(`Loading specific card by ID: ${relatedCard.cardId} for ${relatedCard.name}`);
        const scryfallData = await ScryfallCache.loadById(relatedCard.uri, relatedCard.name);
        if (scryfallData) {
            console.log(`Successfully loaded card data for ${relatedCard.name}:`, scryfallData);
            // Re-render to show the actual card image
            render();
        } else {
            console.warn(`Failed to load card data for ${relatedCard.name} (ID: ${relatedCard.cardId})`);
        }
    } catch (error) {
        console.error('Error loading Scryfall data for related card:', error);
    }
    
    console.log('=== END RELATED CARD PLACEHOLDER CREATION ===');
}

function hideCardContextMenu() {
    if (cardContextMenu) {
        cardContextMenu.remove();
        cardContextMenu = null;
    }
    contextMenuJustShown = false;
}

// Bottom bar context menu functions
function showBottomBarContextMenu(e) {
    e.preventDefault();
    
    hideBottomBarContextMenu();
    
    bottomBarContextMenuJustShown = true;
    setTimeout(() => {
        bottomBarContextMenuJustShown = false;
    }, 10);
    
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
}

function hideBottomBarContextMenu() {
    if (bottomBarContextMenuEl) {
        bottomBarContextMenuEl.classList.add('hidden');
    }
    bottomBarContextMenuJustShown = false;
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

// Helper function to reset tab hover preview state
function resetTabHoverState() {
    if (hoverTimeoutId) {
        clearTimeout(hoverTimeoutId);
        hoverTimeoutId = null;
    }
    
    if (isHoveringTab && originalActivePlayZonePlayerId !== null) {
        activePlayZonePlayerId = originalActivePlayZonePlayerId;
        isHoveringTab = false;
        originalActivePlayZonePlayerId = null;
        render();
    }
}

// Helper function to find card object by ID across ALL players' zones
function findCardObjectByIdGlobal(cardId) {
    // If we're viewing another player's battlefield and have selected cards,
    // prioritize searching in the viewed player's zones first
    if (currentlyViewedPlayerId && currentlyViewedPlayerId !== playerId && gameState && gameState.players) {
        const viewedPlayer = gameState.players[currentlyViewedPlayerId];
        if (viewedPlayer) {
            // Check the viewed player's play zone first (most likely location for selections)
            if (gameState.playZones && gameState.playZones[currentlyViewedPlayerId]) {
                const card = gameState.playZones[currentlyViewedPlayerId].find(c => c.id === cardId);
                if (card) return { card, playerId: currentlyViewedPlayerId };
            }
            
            // Then check their other zones
            const zones = [
                viewedPlayer.hand || [],
                viewedPlayer.library || [],
                viewedPlayer.graveyard || [],
                viewedPlayer.exile || [],
                viewedPlayer.command || []
            ];
            
            for (const zone of zones) {
                const card = zone.find(c => c.id === cardId);
                if (card) return { card, playerId: currentlyViewedPlayerId };
            }
        }
    }
    
    // Then check our own zones
    const localCard = findCardObjectById(cardId);
    if (localCard) return { card: localCard, playerId: playerId };
    
    // Finally check all other players' zones
    if (gameState && gameState.players) {
        for (const pid of Object.keys(gameState.players)) {
            if (pid === playerId || pid === currentlyViewedPlayerId) continue; // Already checked these
            
            const player = gameState.players[pid];
            const zones = [
                player.hand || [],
                player.library || [],
                player.graveyard || [],
                player.exile || [],
                player.command || []
            ];
            
            for (const zone of zones) {
                const card = zone.find(c => c.id === cardId);
                if (card) return { card, playerId: pid };
            }
            
            // Also check their play zone
            if (gameState.playZones && gameState.playZones[pid]) {
                const card = gameState.playZones[pid].find(c => c.id === cardId);
                if (card) return { card, playerId: pid };
            }
        }
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
        if (cardObj.counters !== undefined && cardObj.counters !== 0) {
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
        
        if (cardObj && cardObj.counters !== undefined && cardObj.counters !== 0) {
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
        
    }
}

function setCountersForSelectedCards() {
    if (selectedCards.length === 0) return;
    
    // Get the range of current counter values for context
    const counterValues = selectedCards.map(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        return cardObj && cardObj.counters ? cardObj.counters : 0;
    });
    
    const currentMin = Math.min(...counterValues);
    const currentMax = Math.max(...counterValues);
    const defaultValue = currentMax !== currentMin ? currentMax : (currentMax || 0);
    
    const rangeText = currentMin === currentMax ? `Current: ${currentMax}` : `Range: ${currentMin} to ${currentMax}`;
    const input = prompt(`Set counters for ${selectedCards.length} selected card${selectedCards.length > 1 ? 's' : ''}:\n(${rangeText})\n\nEnter number (negative values allowed, 0 removes counters):`, defaultValue.toString());
    
    if (input === null) return; // User cancelled
    
    const counterValue = parseInt(input);
    if (isNaN(counterValue)) {
        showMessage("Please enter a valid number (negative values allowed, 0 removes counters).");
        return;
    }
    
    let cardsUpdated = 0;
    selectedCards.forEach(cardEl => {
        const cardId = cardEl.dataset.id;
        const cardObj = findCardObjectById(cardId);
        
        if (cardObj) {
            if (counterValue === 0) {
                // Remove counters property if setting to 0
                if (cardObj.counters) {
                    delete cardObj.counters;
                    cardsUpdated++;
                }
            } else {
                // Set the counter value (positive or negative)
                cardObj.counters = counterValue;
                cardsUpdated++;
            }
        }
    });
    
    if (cardsUpdated > 0) {
        // Clear selection after setting counters
        selectedCards.forEach(c => c.classList.remove('selected-card'));
        selectedCards = [];
        selectedCardIds = [];
        
        // Send the updated state to server
        sendMove();
        
        // Re-render the game to show the counters
        render();
        
        // Show feedback message
        if (counterValue === 0) {
            showMessage(`Removed counters from ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}.`);
        } else {
            const counterType = counterValue > 0 ? `+${counterValue}` : counterValue.toString();
            showMessage(`Set counters to ${counterType} on ${cardsUpdated} card${cardsUpdated > 1 ? 's' : ''}.`);
        }
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

// Add global event listeners for tab hover preview functionality
if (playerTabsEl) {
    playerTabsEl.addEventListener('mouseleave', () => {
        if (isTabHoverPreviewEnabled && isHoveringTab) {
            // Clear any pending hover timeout
            if (hoverTimeoutId) {
                clearTimeout(hoverTimeoutId);
                hoverTimeoutId = null;
            }
            
            // Restore the original active player zone
            setTimeout(() => {
                if (isHoveringTab && originalActivePlayZonePlayerId !== null) {
                    activePlayZonePlayerId = originalActivePlayZonePlayerId;
                    isHoveringTab = false;
                    originalActivePlayZonePlayerId = null;
                    render();
                }
            }, 100);
        }
    });
}


