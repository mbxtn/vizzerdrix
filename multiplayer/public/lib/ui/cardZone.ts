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
        // Since top card now handles its own interactions, we only need:
        // 1. Drop handlers for accepting drops from other zones
        // 2. Context menu on the zone background
        this.setupDropHandlers();
        this.setupContextMenu();
        
        // Set up peek functionality if enabled
        if (this.enablePeek) {
            this.setupPeekHandlers();
        }
    }
    
    setupPeekHandlers(): void {
        // Peek functionality is now handled by long-pressing the top card
        this.element.addEventListener('mousedown', (e: MouseEvent) => {
            // Check if interactions are enabled
            if (!this.interactionEnabled) return;
            
            // Only handle mousedown if it's not on the top card
            if ((e.target as Element)?.closest('.card')) {
                return; // Let the card handle its own events
            }
            
            if (e.button === 2) {
                this.rightClickInProgress = true;
                return;
            }
            if (e.button !== 0) return; // Only left click for peek
            
            this.rightClickInProgress = false;
            
            if (this.cards.length === 0) {
                if (this.zoneType === 'library') {
                    this.showMessage?.("Library is empty!");
                }
                return;
            }
            
            this.popTimer = setTimeout(() => {
                this.startPeek(e);
            }, this.peekHoldTime);
        });
        
        this.element.addEventListener('mouseup', (e: MouseEvent) => {
            // Check if interactions are enabled
            if (!this.interactionEnabled) return;
            
            if (this.popTimer) {
                clearTimeout(this.popTimer);
            }
            
            // Only handle mouseup if it's not on the top card
            if ((e.target as Element)?.closest('.card')) {
                return; // Let the card handle its own events
            }
            
            if (e.button === 2 || this.rightClickInProgress) {
                this.rightClickInProgress = false;
                return;
            }
            
            if (!this.isPopping) {
                // Background click - no action needed since card handles clicks
                if (this.contextMenuJustShown) {
                    this.contextMenuJustShown = false;
                    return;
                }
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
        if (this.cards.length === 0) {
            // Only show empty message for library, not for graveyard
            if (this.zoneType === 'library') {
                this.showMessage?.(`${this.zoneType.charAt(0).toUpperCase() + this.zoneType.slice(1)} is empty!`);
            }
            return;
        }
        const cardObj = this.removeTopCard();
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
        // TODO: Implement top card display logic
        console.log(`Updating top card display for ${this.zoneType}, ${this.cards.length} cards`);
    }
    
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