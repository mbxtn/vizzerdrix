import ScryfallCache from './scryfallCache.js';
import { createCardElement } from './cardFactory.js';

export class CardZone {
    constructor(element, zoneType, options = {}) {
        this.element = element;
        this.zoneType = zoneType; // 'library' or 'graveyard'
        this.cards = [];
        this.countElement = options.countElement;
        this.onCardDraw = options.onCardDraw;
        this.onStateChange = options.onStateChange;
        this.showMessage = options.showMessage;
        
        this.currentCardWidth = options.currentCardWidth || 90;
        this.isMagnifyEnabled = options.isMagnifyEnabled || false;
        
        // Library-specific options
        this.enablePeek = options.enablePeek || false;
        this.peekHoldTime = options.peekHoldTime || 200;
        
        // Context menu options
        this.showShuffle = options.showShuffle !== false; // Default to true unless explicitly false
        
        // Internal state for peek functionality
        this.isPopping = false;
        this.popTimer = null;
        this.poppedCardEl = null;
        this.poppedCardObj = null;
        
        // Bind event handlers for proper cleanup
        this.boundMouseMove = this.handleGlobalMouseMove.bind(this);
        this.boundMouseUp = this.handleGlobalMouseUp.bind(this);
        this.boundContextMenu = this.handleContextMenu.bind(this);
        this.boundHideContextMenu = this.hideContextMenu.bind(this);
        
        // Context menu state
        this.contextMenu = null;
        this.contextMenuJustShown = false;
        this.rightClickInProgress = false;
        this.currentModal = null;
        
        this.initializeEventHandlers();
    }
    
    initializeEventHandlers() {
        if (this.enablePeek) {
            this.setupPeekHandlers();
        } else {
            this.setupSimpleClickHandler();
        }
        
        this.setupDropHandlers();
        this.setupContextMenu();
    }
    
    setupSimpleClickHandler() {
        this.element.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                // Right mouse button pressed
                this.rightClickInProgress = true;
                return;
            }
            this.rightClickInProgress = false;
        });
        
        this.element.addEventListener('click', (e) => {
            // Prevent click action if context menu was just shown OR if right-click is in progress
            if (this.contextMenuJustShown || this.rightClickInProgress) {
                this.contextMenuJustShown = false;
                this.rightClickInProgress = false;
                return;
            }
            this.drawCard();
        });
    }
    
    setupPeekHandlers() {
        this.element.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                // Right mouse button pressed
                this.rightClickInProgress = true;
                return;
            }
            if (e.button !== 0) return; // Only left click for peek
            
            this.rightClickInProgress = false;
            
            if (this.cards.length === 0) {
                this.showMessage?.("Library is empty!");
                return;
            }
            
            this.popTimer = setTimeout(() => {
                this.startPeek(e);
            }, this.peekHoldTime);
        });
        
        this.element.addEventListener('mouseup', (e) => {
            clearTimeout(this.popTimer);
            
            // If this was a right-click, don't do anything
            if (e.button === 2 || this.rightClickInProgress) {
                this.rightClickInProgress = false;
                return;
            }
            
            if (!this.isPopping) {
                // Prevent click action if context menu was just shown
                if (this.contextMenuJustShown) {
                    this.contextMenuJustShown = false;
                    return;
                }
                // If not popping, it's a regular click, so draw a card
                this.drawCard();
            }
            this.element.classList.remove('touch-pop-active');
        });
        
        // Global mouse handlers for peek functionality
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }
    
    handleGlobalMouseMove(e) {
        if (this.isPopping && this.poppedCardEl) {
            // Update the position of the ghost card to follow the cursor
            this.poppedCardEl.style.left = `${e.clientX - (this.currentCardWidth / 2)}px`;
            this.poppedCardEl.style.top = `${e.clientY - ((this.currentCardWidth * 120/90) / 2)}px`;
        }
    }
    
    handleGlobalMouseUp(e) {
        if (this.isPopping) {
            this.endPeek(e);
        }
    }
    
    startPeek(e) {
        this.isPopping = true;
        this.poppedCardObj = this.cards[this.cards.length - 1]; // Get top card object
        this.element.classList.add('touch-pop-active');
        
        // Create the visual popped card element
        // For library cards, always show card back (like cards in sleeves)
        const shouldShowBack = this.zoneType === 'library' || this.poppedCardObj.faceShown === 'back';
        this.poppedCardEl = createCardElement(this.poppedCardObj, 'popped', {
            isMagnifyEnabled: false,
            isInteractable: false,
            onCardClick: null,
            onCardDblClick: null,
            onCardDragStart: null,
            showBack: shouldShowBack
        });
        this.poppedCardEl.classList.add('popped-card');
        document.body.appendChild(this.poppedCardEl);
        
        // Position the popped card at the mouse
        this.poppedCardEl.style.left = `${e.clientX - (this.currentCardWidth / 2)}px`;
        this.poppedCardEl.style.top = `${e.clientY - ((this.currentCardWidth * 120/90) / 2)}px`;
    }
    
    endPeek(e) {
        this.isPopping = false;
        this.element.classList.remove('touch-pop-active');
        if (this.poppedCardEl) {
            this.poppedCardEl.remove();
            this.poppedCardEl = null;
        }
        
        // Handle drop logic for peeked card
        this.handlePeekDrop(e);
    }
    
    handlePeekDrop(e) {
        // Determine drop target
        const handZoneEl = document.getElementById('hand-zone');
        const graveyardPileEl = document.getElementById('graveyard-pile');
        const playZonesContainer = document.getElementById('play-zones-container');
        const dropZones = [handZoneEl, graveyardPileEl, playZonesContainer];
        
        for (const zone of dropZones) {
            const rect = zone.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                
                // Card is dropped into a valid zone
                const cardObj = this.removeTopCard();
                this.poppedCardObj = null;
                
                if (zone.id === 'hand-zone') {
                    this.onCardDraw?.(cardObj, 'hand');
                } else if (zone.id === 'graveyard-pile') {
                    this.onCardDraw?.(cardObj, 'graveyard');
                } else if (zone.id === 'play-zones-container') {
                    const activePlayZone = zone.querySelector('.play-zone:not([style*="display: none"])');
                    if (activePlayZone) {
                        const zoneRect = activePlayZone.getBoundingClientRect();
                        const x = e.clientX - zoneRect.left - (this.currentCardWidth / 2);
                        const y = e.clientY - zoneRect.top - ((this.currentCardWidth * 120/90) / 2);
                        cardObj.x = x;
                        cardObj.y = y;
                        this.onCardDraw?.(cardObj, 'play', { x, y });
                    }
                }
                break;
            }
        }
    }
    
    setupDropHandlers() {
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.element.classList.add('zone-active');
        });
        
        this.element.addEventListener('dragleave', () => {
            this.element.classList.remove('zone-active');
        });
        
        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.element.classList.remove('zone-active');
            this.handleDrop(e);
        });
    }
    
    handleDrop(e) {
        const groupDataString = e.dataTransfer.getData('application/json');
        if (groupDataString) {
            const groupData = JSON.parse(groupDataString);
            groupData.cardIds.forEach(cardId => {
                this.onStateChange?.('moveCard', cardId, groupData.sourceZone, this.zoneType);
            });
        } else {
            const cardId = e.dataTransfer.getData('text/plain');
            const sourceZone = e.dataTransfer.getData('sourceZone');
            this.onStateChange?.('moveCard', cardId, sourceZone, this.zoneType);
        }
    }
    
    drawCard() {
        if (this.cards.length === 0) {
            this.showMessage?.(`${this.zoneType.charAt(0).toUpperCase() + this.zoneType.slice(1)} is empty!`);
            return;
        }
        const cardObj = this.removeTopCard();
        this.onCardDraw?.(cardObj, 'hand');
    }
    
    addCard(card) {
        this.cards.push(card);
        this.updateCount();
    }
    
    removeTopCard() {
        const card = this.cards.pop();
        this.updateCount();
        return card;
    }
    
    removeCard(cardId) {
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index > -1) {
            const card = this.cards.splice(index, 1)[0];
            this.updateCount();
            return card;
        }
        return null;
    }
    
    updateCards(newCards) {
        // Check if cards have actually changed to avoid unnecessary updates
        const newCardsJson = JSON.stringify(newCards || []);
        const currentCardsJson = JSON.stringify(this.cards);
        
        if (newCardsJson === currentCardsJson) {
            return; // No changes, skip update
        }
        
        this.cards = newCards || [];
        this.updateCount();
        
        // If modal/panel is open and cards changed, refresh it
        if (this.currentModal) {
            this.closeSidePanel();
            // Small delay to prevent flickering
            setTimeout(() => {
                this.viewAllCards();
            }, 50);
        }
    }
    
    updateCount() {
        if (this.countElement) {
            this.countElement.textContent = this.cards.length;
        }
    }
    
    getTopCard() {
        return this.cards[this.cards.length - 1] || null;
    }
    
    getCards() {
        return [...this.cards]; // Return a copy
    }
    
    clear() {
        this.cards = [];
        this.updateCount();
    }
    
    destroy() {
        // Clean up event listeners and elements
        if (this.poppedCardEl) {
            this.poppedCardEl.remove();
        }
        clearTimeout(this.popTimer);
        
        // Remove global event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
        document.removeEventListener('click', this.boundHideContextMenu);
        
        // Clean up context menu
        if (this.contextMenu) {
            this.contextMenu.remove();
        }
        
        // Clean up modal/panel
        if (this.currentModal) {
            this.closeSidePanel();
        }
    }
    
    closeModal() {
        this.closeSidePanel();
    }
    
    setupContextMenu() {
        this.element.addEventListener('contextmenu', this.boundContextMenu);
        document.addEventListener('click', this.boundHideContextMenu);
    }
    
    handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Set flag to prevent immediate click event
        this.contextMenuJustShown = true;
        this.rightClickInProgress = false;
        
        // Clear the flag after a short delay to allow normal clicking later
        setTimeout(() => {
            this.contextMenuJustShown = false;
        }, 100);
        
        // Hide any existing context menu
        this.hideContextMenu();
        
        // Don't show context menu if zone is empty
        if (this.cards.length === 0) return;
        
        // Create context menu
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'card-zone-context-menu fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-48';
        this.contextMenu.style.left = `${e.clientX}px`;
        this.contextMenu.style.top = `${e.clientY}px`;
        
        // Shuffle option (only if enabled)
        if (this.showShuffle) {
            const shuffleOption = document.createElement('button');
            shuffleOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
            shuffleOption.textContent = `Shuffle ${this.zoneType}`;
            shuffleOption.addEventListener('click', () => {
                this.shuffleCards();
                this.hideContextMenu();
            });
            this.contextMenu.appendChild(shuffleOption);
        }
        
        // View all option (for zones with multiple cards)
        if (this.cards.length > 1) {
            const viewAllOption = document.createElement('button');
            viewAllOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
            // Different text for library vs other zones
            const viewText = this.zoneType === 'library' 
                ? `View all cards (${this.cards.length}) - face down`
                : `View all cards (${this.cards.length})`;
            viewAllOption.textContent = viewText;
            viewAllOption.addEventListener('click', () => {
                this.viewAllCards();
                this.hideContextMenu();
            });
            this.contextMenu.appendChild(viewAllOption);
        }
        
        // Add zone-specific options
        if (this.zoneType === 'library') {
            const drawMultipleOption = document.createElement('button');
            drawMultipleOption.className = 'w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors';
            drawMultipleOption.textContent = 'Draw multiple cards...';
            drawMultipleOption.addEventListener('click', () => {
                this.promptDrawMultiple();
                this.hideContextMenu();
            });
            this.contextMenu.appendChild(drawMultipleOption);
        }
        
        // Ensure context menu stays within viewport
        document.body.appendChild(this.contextMenu);
        const rect = this.contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.contextMenu.style.left = `${e.clientX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.contextMenu.style.top = `${e.clientY - rect.height}px`;
        }
    }
    
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
        // Reset the flag when context menu is hidden
        this.contextMenuJustShown = false;
    }
    
    shuffleCards() {
        // Shuffle using Fisher-Yates algorithm
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        
        // Notify parent of the change
        if (this.onStateChange) {
            this.onStateChange('shuffle', null, this.zoneType, null);
        }
        
        this.showMessage?.(`${this.zoneType.charAt(0).toUpperCase() + this.zoneType.slice(1)} shuffled!`);
    }
    
    viewAllCards() {
        // Create a side panel to show all cards
        const panel = document.createElement('div');
        panel.className = 'card-zone-side-panel fixed top-0 right-0 h-full w-80 bg-gray-800 border-l border-gray-600 z-50 flex flex-col shadow-2xl';
        panel.style.transform = 'translateX(100%)';
        panel.style.transition = 'transform 0.3s ease-in-out';
        
        // Header section
        const header = document.createElement('div');
        header.className = 'p-4 border-b border-gray-600 flex justify-between items-center';
        
        const title = document.createElement('h3');
        title.className = 'text-white text-lg font-semibold';
        title.textContent = `${this.zoneType.charAt(0).toUpperCase() + this.zoneType.slice(1)} (${this.cards.length})`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => this.closeSidePanel());
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Instruction text
        const instruction = document.createElement('p');
        instruction.className = 'text-gray-300 text-sm px-4 py-2 bg-gray-700 border-b border-gray-600';
        instruction.textContent = 'Drag cards from here to move them to other zones';
        
        // Scrollable card container
        const cardContainer = document.createElement('div');
        cardContainer.className = 'flex-1 overflow-y-auto p-4';
        
        const cardList = document.createElement('div');
        cardList.className = 'flex flex-col gap-3';
        
        this.cards.forEach((card, index) => {
            // Track if drag started from within panel
            let dragStartedInPanel = false;
            
            // Create actual card element using cardFactory
            const cardEl = createCardElement(card, 'panel', {
                isMagnifyEnabled: this.isMagnifyEnabled, // Use the zone's magnify setting
                isInteractable: true,
                onCardClick: null,
                onCardDblClick: null,
                onCardDragStart: (e, cardData, location) => {
                    // Custom drag start handler for panel cards
                    dragStartedInPanel = true;
                    e.dataTransfer.setData('text/plain', cardData.id);
                    e.dataTransfer.setData('sourceZone', this.zoneType);
                    e.dataTransfer.setData('cardName', cardData.displayName || cardData.name);
                    e.dataTransfer.effectAllowed = 'move';
                    
                    // Visual feedback
                    setTimeout(() => {
                        if (cardWrapper) cardWrapper.style.opacity = '0.5';
                    }, 0);
                },
                showBack: card.faceShown === 'back'
            });
            
            // Style the card for the side panel
            cardEl.style.cursor = 'grab';
            cardEl.style.width = '120px'; // Slightly larger for better visibility in panel
            cardEl.style.height = 'auto';
            cardEl.style.flexShrink = '0';
            cardEl.draggable = true;
            
            // Add proper drag cursor handling
            cardEl.addEventListener('mousedown', () => {
                cardEl.style.cursor = 'grabbing';
            });
            
            cardEl.addEventListener('mouseup', () => {
                cardEl.style.cursor = 'grab';
            });
            
            // Add a wrapper for styling and interactions
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'card-item p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors flex justify-center';
            cardWrapper.style.cursor = 'grab';
            
            cardWrapper.appendChild(cardEl);
            
            // Store card data for drag operations
            cardEl.dataset.cardId = card.id;
            cardEl.dataset.sourceZone = this.zoneType;
            
            // Add drag end handler
            cardEl.addEventListener('dragend', (e) => {
                // Reset visual feedback
                cardWrapper.style.opacity = '1';
                cardEl.style.cursor = 'grab';
                
                // Check if drag ended outside the panel
                if (dragStartedInPanel) {
                    const panelRect = panel.getBoundingClientRect();
                    const isOutsidePanel = e.clientX < panelRect.left || 
                                         e.clientY < panelRect.top || 
                                         e.clientY > panelRect.bottom;
                    
                    if (isOutsidePanel) {
                        // Close panel after a short delay to allow drop to complete
                        setTimeout(() => {
                            this.closeSidePanel();
                        }, 100);
                    }
                }
                dragStartedInPanel = false;
            });
            
            cardList.appendChild(cardWrapper);
        });
        
        cardContainer.appendChild(cardList);
        
        // Assemble the panel
        panel.appendChild(header);
        panel.appendChild(instruction);
        panel.appendChild(cardContainer);
        
        document.body.appendChild(panel);
        
        // Animate panel in
        setTimeout(() => {
            panel.style.transform = 'translateX(0)';
        }, 10);
        
        // Store panel reference to close it when cards are moved
        this.currentModal = panel;
    }
    
    closeSidePanel() {
        if (this.currentModal) {
            this.currentModal.style.transform = 'translateX(100%)';
            
            // If there's an active magnify preview, remove it so it can reposition when next triggered
            const magnifyPreview = document.getElementById('magnify-preview');
            if (magnifyPreview) {
                magnifyPreview.remove();
            }
            
            setTimeout(() => {
                if (this.currentModal && this.currentModal.parentNode) {
                    this.currentModal.remove();
                    this.currentModal = null;
                }
            }, 300);
        }
    }
    
    promptDrawMultiple() {
        const count = prompt(`How many cards would you like to draw from your ${this.zoneType}? (Available: ${this.cards.length})`);
        const numCards = parseInt(count);
        
        if (isNaN(numCards) || numCards <= 0) return;
        if (numCards > this.cards.length) {
            this.showMessage?.(`Cannot draw ${numCards} cards. Only ${this.cards.length} available.`);
            return;
        }
        
        // Draw multiple cards to hand
        for (let i = 0; i < numCards; i++) {
            if (this.cards.length > 0) {
                const card = this.removeTopCard();
                if (this.onCardDraw) {
                    this.onCardDraw(card, 'hand');
                }
            }
        }
        
        this.showMessage?.(`Drew ${numCards} cards from ${this.zoneType}.`);
    }
    
    updateMagnifyEnabled(enabled) {
        this.isMagnifyEnabled = enabled;
    }
}
