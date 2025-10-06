import { ScryfallCache } from '../scryfallCache.js';
import { DOMCardManager } from './domCardManager.js';
import { Card } from '../state/card.js';
import { Zone } from '../state/socketinterface.js';

interface CardZoneOptions {
    countElement?: HTMLElement | null;
    onCardDraw?: (card: any, targetZone: string, options?: any) => void;
    onStateChange?: (action: string, cardIdOrIds: string | string[], sourceZone: string, targetZone: string) => void;
    showMessage?: (message: string) => void;
    currentCardWidth?: number;
    isMagnifyEnabled?: boolean;
    enablePeek?: boolean;
    peekHoldTime?: number;
    showTopCard?: boolean;
    showShuffle?: boolean;
    cardManager?: DOMCardManager;
}

export class CardZone {
    element: HTMLElement;
    zoneType: string;
    cards: any[];
    countElement?: HTMLElement | null;
    onCardDraw?: (card: any, targetZone: string, options?: any) => void;
    onStateChange?: (action: string, cardIdOrIds: string | string[], sourceZone: string, targetZone: string) => void;
    showMessage?: (message: string) => void;
    cardManager?: DOMCardManager;
    
    currentCardWidth: number;
    isMagnifyEnabled: boolean;
    
    // Library-specific options
    enablePeek: boolean;
    peekHoldTime: number;
    
    // Top card display options
    showTopCard: boolean;
    topCardElement: HTMLElement | null = null;
    
    // Context menu options
    showShuffle: boolean;
    
    // Internal state for peek functionality
    isPopping: boolean = false;
    popTimer: NodeJS.Timeout | null = null;
    poppedCardEl: HTMLElement | null = null;
    poppedCardObj: any = null;
    
    // Bound event handlers for proper cleanup
    boundMouseMove: (e: MouseEvent) => void;
    boundMouseUp: (e: MouseEvent) => void;
    boundContextMenu: (e: MouseEvent) => void;
    boundHideContextMenu: (e: MouseEvent) => void;
    
    // Context menu state
    contextMenu: HTMLElement | null = null;
    contextMenuJustShown: boolean = false;
    rightClickInProgress: boolean = false;
    currentModal: HTMLElement | null = null;
    
    // Drag tracking for top card
    draggedCardId: string | null = null;
    
    // Interaction state
    interactionEnabled: boolean = true; // Default to enabled
    
    constructor(element: HTMLElement, zoneType: string, options: CardZoneOptions = {}) {
        this.element = element;
        this.zoneType = zoneType; // 'library', 'graveyard', 'exile', or 'command'
        this.cards = [];
        this.countElement = options.countElement;
        this.onCardDraw = options.onCardDraw;
        this.onStateChange = options.onStateChange;
        this.showMessage = options.showMessage;
        this.cardManager = options.cardManager;
        
        this.currentCardWidth = options.currentCardWidth || 90;
        this.isMagnifyEnabled = options.isMagnifyEnabled || false;
        
        // Library-specific options
        this.enablePeek = options.enablePeek || false;
        this.peekHoldTime = options.peekHoldTime || 200;
        
        // Top card display options
        this.showTopCard = options.showTopCard || false;
        
        // Context menu options
        this.showShuffle = options.showShuffle !== false; // Default to true unless explicitly false
        
        // Bind event handlers for proper cleanup
        this.boundMouseMove = this.handleGlobalMouseMove.bind(this);
        this.boundMouseUp = this.handleGlobalMouseUp.bind(this);
        this.boundContextMenu = this.handleContextMenu.bind(this);
        this.boundHideContextMenu = this.hideContextMenu.bind(this);
        
        this.initializeEventHandlers();
    }
    
    initializeEventHandlers(): void {
        console.log(`[CardZone] Initializing event handlers for ${this.zoneType} zone`);
        
        // Since top card now handles its own interactions, we only need:
        // 1. Drop handlers for accepting drops from other zones
        // 2. Context menu on the zone background
        this.setupDropHandlers();
        this.setupContextMenu();
        
        // Set up peek functionality if enabled
        if (this.enablePeek) {
            console.log(`[CardZone] Setting up peek handlers for ${this.zoneType}`);
            this.setupPeekHandlers();
        } else {
            console.log(`[CardZone] Peek handlers disabled for ${this.zoneType}`);
        }
    }
    
    setupPeekHandlers(): void {
        // Peek functionality is now handled by long-pressing the top card
        this.element.addEventListener('mousedown', (e: MouseEvent) => {
            console.log(`[CardZone] ${this.zoneType} mousedown event triggered`, e.button, e.target);
            
            // Check if interactions are enabled
            if (!this.interactionEnabled) {
                console.log(`[CardZone] ${this.zoneType} interactions disabled`);
                return;
            }
            
            // Only handle mousedown if it's not on the top card
            if ((e.target as Element)?.closest('.card')) {
                console.log(`[CardZone] ${this.zoneType} mousedown on card element, letting card handle it`);
                return; // Let the card handle its own events
            }
            
            if (e.button === 2) {
                console.log(`[CardZone] ${this.zoneType} right click detected`);
                this.rightClickInProgress = true;
                return;
            }
            if (e.button !== 0) {
                console.log(`[CardZone] ${this.zoneType} non-left click (button: ${e.button})`);
                return; // Only left click for peek
            }
            
            console.log(`[CardZone] ${this.zoneType} left click start, setting up peek timer`);
            this.rightClickInProgress = false;
            
            if (this.cards.length === 0) {
                if (this.zoneType === 'library') {
                    console.log(`[CardZone] ${this.zoneType} is empty, showing message`);
                    this.showMessage?.("Library is empty!");
                }
                return;
            }
            
            this.popTimer = setTimeout(() => {
                console.log(`[CardZone] ${this.zoneType} peek timer triggered`);
                this.startPeek(e);
            }, this.peekHoldTime);
        });
        
        this.element.addEventListener('mouseup', (e: MouseEvent) => {
            console.log(`[CardZone] ${this.zoneType} mouseup event triggered`, e.button, e.target);
            
            // Check if interactions are enabled
            if (!this.interactionEnabled) {
                console.log(`[CardZone] ${this.zoneType} interactions disabled on mouseup`);
                return;
            }
            
            if (this.popTimer) {
                console.log(`[CardZone] ${this.zoneType} clearing pop timer on mouseup`);
                clearTimeout(this.popTimer);
            }
            
            // Only handle mouseup if it's not on the top card
            if ((e.target as Element)?.closest('.card')) {
                console.log(`[CardZone] ${this.zoneType} mouseup on card element, letting card handle it`);
                return; // Let the card handle its own events
            }
            
            if (e.button === 2 || this.rightClickInProgress) {
                console.log(`[CardZone] ${this.zoneType} right click processed, skipping draw`);
                this.rightClickInProgress = false;
                return;
            }
            
            if (!this.isPopping) {
                // Simple click (not a long press peek) - draw a card for library/command zones
                if (this.contextMenuJustShown) {
                    console.log(`[CardZone] ${this.zoneType} context menu just shown, skipping draw`);
                    this.contextMenuJustShown = false;
                    return;
                }
                
                // Handle simple clicks to draw cards from library or command zone
                if (this.zoneType === 'library' || this.zoneType === 'command') {
                    console.log(`[CardZone] ${this.zoneType} click detected! Calling drawCard with ${this.cards.length} cards`);
                    this.drawCard();
                } else {
                    console.log(`[CardZone] ${this.zoneType} click detected (no draw action for this zone type)`);
                }
            } else {
                console.log(`[CardZone] ${this.zoneType} was in popping state, not drawing card`);
            }
            this.element.classList.remove('touch-pop-active');
        });
        
        // Global mouse handlers for peek functionality
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }

    handleGlobalMouseMove(e: MouseEvent): void {
        if (this.isPopping && this.poppedCardEl) {
            // Update the position of the ghost card to follow the cursor
            // Use the same aspect ratio as CSS: 80/107, so height = width * (107/80)
            const cardHeight = this.currentCardWidth * (107/80);
            this.poppedCardEl.style.left = `${e.clientX - (this.currentCardWidth / 2)}px`;
            this.poppedCardEl.style.top = `${e.clientY - (cardHeight / 2)}px`;
        }
    }
    
    handleGlobalMouseUp(e: MouseEvent): void {
        if (this.isPopping) {
            this.endPeek(e);
        }
    }
    
    startPeek(e: MouseEvent): void {
        this.isPopping = true;
        this.poppedCardObj = this.cards[this.cards.length - 1]; // Get top card object
        this.element.classList.add('touch-pop-active');
        
        // Create the visual popped card element using DOMCardManager
        if (this.cardManager && this.poppedCardObj) {
            // For library cards, always show card back
            const shouldShowBack = this.zoneType === 'library' || this.poppedCardObj.faceShown === 'back';
            
            const domCardElement = this.cardManager.createOrUpdateCardElement(
                this.poppedCardObj, 
                this.zoneType === 'library' ? Zone.library : Zone.exile, // Use appropriate zone
                {
                    isMagnifyEnabled: this.isMagnifyEnabled,
                    isInteractable: false,
                    showBack: shouldShowBack,
                    isGhost: true // Make it a ghost card for peek
                }
            );
            
            this.poppedCardEl = domCardElement.getElement();
            this.poppedCardEl.classList.add('popped-card');
            
            // Force the popped card to use the current card width for consistent positioning
            // Override the CSS variable for this specific element to ensure it matches our positioning calculations
            this.poppedCardEl.style.setProperty('--card-width', `${this.currentCardWidth}px`);
            this.poppedCardEl.style.width = `${this.currentCardWidth}px`;
            // Let aspect-ratio handle the height automatically
            
            document.body.appendChild(this.poppedCardEl);
            
            // Position the popped card at the mouse
            // Use the same aspect ratio as CSS: 80/107, so height = width * (107/80)
            const cardHeight = this.currentCardWidth * (107/80);
            this.poppedCardEl.style.left = `${e.clientX - (this.currentCardWidth / 2)}px`;
            this.poppedCardEl.style.top = `${e.clientY - (cardHeight / 2)}px`;
        }
    }
    
    endPeek(e: MouseEvent): void {
        this.isPopping = false;
        this.element.classList.remove('touch-pop-active');
        if (this.poppedCardEl) {
            this.poppedCardEl.remove();
            this.poppedCardEl = null;
        }
        
        // Small delay to ensure DOM updates before drop detection
        setTimeout(() => {
            this.handlePeekDrop(e);
        }, 0);
    }
    
    handlePeekDrop(e: MouseEvent): void {
        // Simple and reliable drop detection using bounding boxes
        // Check smaller/more specific targets first, then larger areas
        const dropTargets = [
            { element: document.getElementById('graveyard-pile'), type: 'graveyard' },
            { element: document.getElementById('graveyard-container'), type: 'graveyard' },
            { element: document.getElementById('exile-pile'), type: 'exile' },
            { element: document.getElementById('exile-container'), type: 'exile' },
            { element: document.getElementById('command-pile'), type: 'command' },
            { element: document.getElementById('command-container'), type: 'command' },
            { element: document.getElementById('hand-zone'), type: 'hand' },
            { element: document.getElementById('play-zones-container'), type: 'play' }
        ];
        
        for (const target of dropTargets) {
            if (target.element && this.isMouseOverElement(e, target.element)) {
                console.log(`Peek drop detected on ${target.type}`);
                
                if (target.type === 'play') {
                    // For play zone, calculate position relative to the container
                    const containerRect = target.element.getBoundingClientRect();
                    const options = {
                        x: e.clientX - containerRect.left,
                        y: e.clientY - containerRect.top
                    };
                    this.onCardDraw?.(this.poppedCardObj, target.type, options);
                } else {
                    this.onCardDraw?.(this.poppedCardObj, target.type);
                }
                return;
            }
        }
        
        console.log('Peek drop - no valid target found');
    }
    
    isMouseOverElement(e: MouseEvent, element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    }
    
    setupDropHandlers(): void {
        this.element.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
        });
        
        this.element.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            const cardId = e.dataTransfer?.getData('cardId');
            const sourceZone = e.dataTransfer?.getData('sourceZone');
            if (cardId && sourceZone) {
                this.onStateChange?.('moveCard', cardId, sourceZone, this.zoneType);
                
                // Update visual displays after single card drop
                setTimeout(() => {
                    this.updateTopCardDisplay();
                    if (this.currentModal) {
                        this.updateSidePanel();
                    }
                }, 50);
            }
        });
    }
    
    drawCard(): void {
        console.log(`drawCard called on ${this.zoneType} with ${this.cards.length} cards`);
        if (this.cards.length === 0) {
            // Only show empty message for library, not for graveyard
            if (this.zoneType === 'library') {
                this.showMessage?.(`${this.zoneType.charAt(0).toUpperCase() + this.zoneType.slice(1)} is empty!`);
            }
            return;
        }
        const cardObj = this.removeTopCard();
        console.log(`Drawing card:`, cardObj);
        this.onCardDraw?.(cardObj, 'hand');
    }
    
    addCard(card: any): void {
        this.cards.push(card);
        this.updateCount();
        this.updateTopCardDisplay(); // Update the visual display
        
        // Update side panel if open
        if (this.currentModal) {
            this.updateSidePanel();
        }
    }
    
    removeTopCard(): any {
        const card = this.cards.pop();
        this.updateCount();
        this.updateTopCardDisplay(); // Update the visual display
        
        // Update side panel if open
        if (this.currentModal) {
            this.updateSidePanel();
        }
        
        return card;
    }
    
    removeCard(cardId: string): any {
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index > -1) {
            const card = this.cards.splice(index, 1)[0];
            this.updateCount();
            this.updateTopCardDisplay(); // Update the visual display
            
            // Update side panel if open
            if (this.currentModal) {
                this.updateSidePanel();
            }
            
            return card;
        }
        return null;
    }
    
    updateCards(newCards: any[]): void {
        // Check if cards have actually changed to avoid unnecessary updates
        const newCardsJson = JSON.stringify(newCards || []);
        const currentCardsJson = JSON.stringify(this.cards);
        
        if (newCardsJson === currentCardsJson) {
            return; // No changes, skip update
        }
        
        this.cards = newCards || [];
        this.updateCount();
        this.updateTopCardDisplay();
        
        // If modal/panel is open and cards changed, refresh it
        if (this.currentModal) {
            // Update immediately and also with a delay to catch any async updates
            this.updateSidePanel();
            setTimeout(() => {
                this.updateSidePanel();
            }, 50);
        }
    }
    
    setInteractionEnabled(enabled: boolean): void {
        this.interactionEnabled = enabled;
        
        // Update the visual state of the zone
        if (enabled) {
            this.element.classList.remove('interaction-disabled');
            this.element.style.opacity = '';
        } else {
            this.element.classList.add('interaction-disabled');
            this.element.style.opacity = '0.6';
        }
        
        // Update top card interaction state if it exists
        if (this.topCardElement) {
            if (enabled) {
                this.topCardElement.classList.remove('interaction-disabled');
                this.topCardElement.style.pointerEvents = '';
            } else {
                this.topCardElement.classList.add('interaction-disabled');
                this.topCardElement.style.pointerEvents = 'none';
            }
        }
    }
    
    updateCount(): void {
        if (this.countElement) {
            this.countElement.textContent = this.cards.length.toString();
        }
    }
    
    // Placeholder methods that need to be implemented
    updateTopCardDisplay(): void {
        console.log(`[CardZone] Updating top card display for ${this.zoneType}, ${this.cards.length} cards, showTopCard: ${this.showTopCard}`);
        
        // Remove existing top card element if any
        if (this.topCardElement) {
            this.topCardElement.remove();
            this.topCardElement = null;
        }
        
        // Only show top card if configured to do so and there are cards
        if (!this.showTopCard || this.cards.length === 0) {
            console.log(`[CardZone] ${this.zoneType} not showing top card (showTopCard: ${this.showTopCard}, cards: ${this.cards.length})`);
            return;
        }
        
        const topCard = this.cards[this.cards.length - 1];
        if (!topCard) {
            console.log(`[CardZone] ${this.zoneType} no top card found`);
            return;
        }
        
        console.log(`[CardZone] ${this.zoneType} creating top card element for:`, topCard.cardName || topCard.name);
        
        // Determine if we should show the back of the card
        let shouldShowBack = !this.showTopCard;
        if (this.zoneType === 'library') {
            shouldShowBack = true; // Always show back for library cards
        }
        
        // Create the top card element using DOMCardManager
        if (this.cardManager) {
            const domCardElement = this.cardManager.createOrUpdateCardElement(
                topCard,
                this.zoneType === 'library' ? Zone.library : (this.zoneType === 'graveyard' ? Zone.graveyard : (this.zoneType === 'exile' ? Zone.exile : Zone.command)),
                {
                    isMagnifyEnabled: this.isMagnifyEnabled,
                    isInteractable: this.interactionEnabled,
                    showBack: shouldShowBack,
                    onCardClick: this.interactionEnabled ? this.handleTopCardClick.bind(this) : undefined,
                    onCardDblClick: undefined, // No double-click support for zone cards
                    onCardDragStart: this.interactionEnabled ? this.handleTopCardDragStart.bind(this) : undefined
                }
            );
            
            if (domCardElement.getElement()) {
                this.topCardElement = domCardElement.getElement();
                
                // Position the top card centered within the zone
                this.topCardElement.style.position = 'absolute';
                this.topCardElement.style.top = '50%';
                this.topCardElement.style.left = '50%';
                this.topCardElement.style.transform = 'translate(-50%, -50%)';
                this.topCardElement.classList.add('zone-top-card');
                
                // Add the top card to the zone element
                this.element.appendChild(this.topCardElement);
                
                console.log(`[CardZone] ${this.zoneType} top card element created and added`);
            } else {
                console.error(`[CardZone] ${this.zoneType} failed to create top card element`);
            }
        }
    }
    
    handleTopCardClick = (card: any, element: HTMLElement, event: MouseEvent): void => {
        console.log(`[CardZone] ${this.zoneType} top card clicked:`, card.cardName || card.name);
        
        // Close any open context menus
        if ((window as any).hideCardContextMenu) (window as any).hideCardContextMenu();
        if ((window as any).hideBottomBarContextMenu) (window as any).hideBottomBarContextMenu();
        
        // Only handle clicks if not in peek mode and interactions are enabled
        if (!this.isPopping && !this.rightClickInProgress && !this.contextMenuJustShown && this.interactionEnabled) {
            console.log(`[CardZone] ${this.zoneType} calling drawCard from top card click`);
            this.drawCard();
        } else {
            console.log(`[CardZone] ${this.zoneType} top card click ignored (isPopping: ${this.isPopping}, rightClick: ${this.rightClickInProgress}, contextMenu: ${this.contextMenuJustShown}, enabled: ${this.interactionEnabled})`);
        }
    };
    
    handleTopCardDragStart = (card: any, element: HTMLElement, event: DragEvent): void => {
        console.log(`[CardZone] ${this.zoneType} top card drag started:`, card.cardName || card.name);
        
        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', card.id);
            event.dataTransfer.setData('sourceZone', this.zoneType);
            event.dataTransfer.setData('cardName', card.displayName || card.name || card.cardName);
            event.dataTransfer.effectAllowed = 'move';
            
            this.draggedCardId = card.id;
        }
    };
    
    updateSidePanel(): void {
        // TODO: Implement side panel update logic
        console.log(`Updating side panel for ${this.zoneType}`);
    }
    
    setupContextMenu(): void {
        this.element.addEventListener('contextmenu', this.boundContextMenu);
        document.addEventListener('click', this.boundHideContextMenu);

        // Add two-finger tap support for context menu (iPad/touch devices)
        this.element.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches && e.touches.length === 2) {
                // Prevent default to avoid zoom or scroll
                e.preventDefault();
                // Synthesize a contextmenu event at the midpoint of the two touches
                const x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const syntheticEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: x,
                    clientY: y
                });
                this.element.dispatchEvent(syntheticEvent);
            }
        }, { passive: false });
    }
    
    handleContextMenu(e: MouseEvent): void {
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
        this.contextMenu.className = 'card-zone-context-menu fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1';
        this.contextMenu.style.left = `${e.clientX}px`;
        this.contextMenu.style.top = `${e.clientY}px`;
        
        // Add header if viewing another player's zone
        if (!this.interactionEnabled) {
            const header = document.createElement('div');
            header.className = 'px-4 py-2 border-b border-gray-600 text-gray-300 text-sm font-semibold';
            header.textContent = `Viewing ${this.zoneType} (View Only)`;
            this.contextMenu.appendChild(header);
        }
        
        // TODO: Add context menu items
        
        document.body.appendChild(this.contextMenu);
    }
    
    hideContextMenu(): void {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }
    
    getTopCard(): any {
        return this.cards[this.cards.length - 1] || null;
    }
    
    getCards(): any[] {
        return [...this.cards]; // Return a copy
    }
    
    clear(): void {
        this.cards = [];
        this.updateCount();
        this.updateTopCardDisplay(); // Update the visual display
    }
    
    destroy(): void {
        // Clean up event listeners and elements
        if (this.poppedCardEl) {
            this.poppedCardEl.remove();
        }
        if (this.topCardElement) {
            this.topCardElement.remove();
            this.topCardElement = null;
        }
        if (this.popTimer) {
            clearTimeout(this.popTimer);
        }
        
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
    
    closeModal(): void {
        this.closeSidePanel();
    }
    
    closeSidePanel(): void {
        // TODO: Implement side panel closing logic
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
    }
    
    updateMagnifyEnabled(enabled: boolean): void {
        this.isMagnifyEnabled = enabled;
    }
    
    updateCardWidth(newWidth: number): void {
        this.currentCardWidth = newWidth;
        
        // If we have a popped card active, update its size too
        if (this.poppedCardEl) {
            this.poppedCardEl.style.setProperty('--card-width', `${this.currentCardWidth}px`);
            this.poppedCardEl.style.width = `${this.currentCardWidth}px`;
            // Let aspect-ratio handle the height automatically
        }
        
        // Update top card display to reflect new size
        // Don't set specific pixel widths - let CSS variables handle sizing
        this.updateTopCardDisplay();
    }
    
    setShowTopCard(enabled: boolean): void {
        this.showTopCard = enabled;
        // Always update the top card display since we now always show the top card,
        // just with different face up/down states
        this.updateTopCardDisplay();
    }
    
    toggleTopCard(): void {
        this.setShowTopCard(!this.showTopCard);
        const faceState = this.showTopCard ? 'face up' : 'face down';
        console.log(`Top card now showing ${faceState} for ${this.zoneType}.`);
    }
}