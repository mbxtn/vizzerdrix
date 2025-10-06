import { Card } from '../state/card.js';
import { Zone } from '../state/socketinterface.js';

export type DOMCardElementOptions = {
    isMagnifyEnabled?: boolean;
    isInteractable?: boolean;
    onCardClick?: (card: Card, element: HTMLElement, event: MouseEvent) => void;
    onCardDblClick?: (card: Card, element: HTMLElement, event: MouseEvent) => void;
    onCardDragStart?: (card: Card, element: HTMLElement, event: DragEvent) => void;
    onCounterClick?: (card: Card, element: HTMLElement, counterType: string, event: MouseEvent) => void;
    onTouchRelease?: (card: Card, element: HTMLElement, event: TouchEvent) => void;
    showBack?: boolean;
    isGhost?: boolean;
    isReverseGhost?: boolean;
    playerSelections?: { [playerId: string]: string[] };
    playerColors?: { [playerId: string]: string };
};

/**
 * Manages a DOM element representation of a Card state object.
 * Handles all UI concerns while keeping the Card state object pure.
 */
export class DOMCardElement {
    private card: Card;
    private element: HTMLElement;
    private options: DOMCardElementOptions;
    private zone: Zone;

    constructor(card: Card, zone: Zone, options: DOMCardElementOptions = {}) {
        this.card = card;
        this.zone = zone;
        this.options = options;
        this.element = this.createElement();
        this.updateElement();
    }

    /**
     * Get the DOM element
     */
    getElement(): HTMLElement {
        return this.element;
    }

    /**
     * Get the associated Card state object
     */
    getCard(): Card {
        return this.card;
    }

    /**
     * Update the DOM element to match the current Card state
     */
    updateFromCard(card: Card): void {
        this.card = card;
        this.updateElement();
    }

    /**
     * Update display options (magnify, interactability, etc.)
     */
    updateOptions(options: Partial<DOMCardElementOptions>): void {
        this.options = { ...this.options, ...options };
        this.updateElement();
    }

    /**
     * Update the zone for this card and handle position styling
     */
    updateZone(newZone: Zone): void {
        this.zone = newZone;
        this.element.setAttribute('data-zone', Zone[this.zone]);
        this.element.setAttribute('data-location', Zone[this.zone]);
        this.updateElement();
    }

    /**
     * Set position for battlefield cards
     */
    setPosition(x: number, y: number): void {
        if (this.zone === Zone.battlefield) {
            this.element.style.position = 'absolute';
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }
    }

    /**
     * Set rotation (tapped state)
     */
    setRotation(degrees: number): void {
        this.element.style.transform = `rotate(${degrees}deg)`;
    }

    /**
     * Update selection state
     */
    setSelected(isSelected: boolean): void {
        if (isSelected) {
            this.element.classList.add('selected-card');
        } else {
            this.element.classList.remove('selected-card');
        }
    }

    /**
     * Update player selection highlights
     */
    updatePlayerSelections(playerSelections: { [playerId: string]: string[] }, playerColors: { [playerId: string]: string }): void {
        this.options.playerSelections = playerSelections;
        this.options.playerColors = playerColors;
        this.updateSelectionHighlights();
    }

    /**
     * Destroy the DOM element and clean up event listeners
     */
    destroy(): void {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }

    private createElement(): HTMLElement {
        const element = document.createElement('div');
        element.className = 'card flex-shrink-0 cursor-grab';
        element.setAttribute('data-id', this.card.id);
        element.setAttribute('data-zone', Zone[this.zone]); // Convert enum to string
        element.setAttribute('data-location', Zone[this.zone]); // Also set location for legacy compatibility
        
        return element;
    }

    private updateElement(): void {
        // Update content based on card type - use the Card's isTemporary property
        if (this.card.isTemporary) {
            this.updateTemporaryCard();
        } else {
            this.updateRegularCard();
        }

        // Update position based on zone
        if (this.zone === Zone.battlefield) {
            this.setPosition(this.card.location.x, this.card.location.y);
            this.setRotation(this.card.tapped ? 90 : 0);
        } else {
            // Clear absolute positioning for non-battlefield cards
            this.element.style.position = '';
            this.element.style.left = '';
            this.element.style.top = '';
            this.element.style.transform = ''; // Clear any rotation too
        }

        // Update interaction state
        this.updateInteractability();

        // Update ghost styling
        this.updateGhostStyling();

        // Update selection highlights
        this.updateSelectionHighlights();

        // Update counters
        this.updateCounters();
    }

    private updateTemporaryCard(): void {
        this.element.className = 'card temporary-card';
        
        // Simple placeholder display
        this.element.innerHTML = `
            <div class="temporary-content">
                <span class="temporary-text">${this.card.cardName}</span>
            </div>
        `;
        
        // Styling for temporary cards (slightly different to distinguish them)
        this.element.style.border = '2px dashed #888';
        this.element.style.borderRadius = '8px';
        this.element.style.padding = '8px';
        this.element.style.minHeight = '60px';
        this.element.style.width = 'var(--card-width, 80px)'; // Use CSS variable
        this.element.style.backgroundColor = '#e8e8e8';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.textAlign = 'center';
        this.element.style.fontSize = '12px';
        this.element.style.fontStyle = 'italic';
        this.element.style.color = '#666';
    }

    private updateRegularCard(): void {
        this.element.className = 'card';
        
        // Simple card name display for now - just like when card images aren't found
        this.element.innerHTML = `
            <div class="card-content">
                <div class="card-name-display">${this.card.cardName}</div>
            </div>
        `;
        
        // Add some basic styling to make it look like a card
        this.element.style.border = '1px solid #ccc';
        this.element.style.borderRadius = '8px';
        this.element.style.padding = '8px';
        this.element.style.minHeight = '60px';
        this.element.style.width = 'var(--card-width, 80px)'; // Use CSS variable
        this.element.style.backgroundColor = '#f9f9f9';
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.textAlign = 'center';
        this.element.style.fontSize = '12px';
        this.element.style.fontWeight = 'bold';
    }

    private updateInteractability(): void {
        if (this.options.isInteractable) {
            this.element.style.cursor = 'pointer';
            this.addEventListeners();
        } else {
            this.element.style.cursor = 'default';
            this.removeEventListeners();
        }
    }

    private updateGhostStyling(): void {
        if (this.options.isGhost) {
            this.element.style.opacity = '0.4';
            this.element.style.border = '2px dashed #48bb78';
            this.element.style.borderRadius = '8px';
            this.element.style.filter = 'brightness(0.7) saturate(0.5)';
            this.element.style.zIndex = '1';
            this.element.style.boxShadow = '0 0 8px rgba(72, 187, 120, 0.3)';
        } else if (this.options.isReverseGhost) {
            this.element.style.opacity = '0.3';
            this.element.style.border = '2px dashed #f59e0b';
            this.element.style.borderRadius = '8px';
            this.element.style.filter = 'brightness(0.6) saturate(0.4) hue-rotate(30deg)';
            this.element.style.zIndex = '2';
            this.element.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.4)';
        } else {
            // Reset ghost styling
            this.element.style.opacity = '';
            this.element.style.border = '';
            this.element.style.filter = '';
            this.element.style.zIndex = this.zone === Zone.battlefield ? '10' : '';
            this.element.style.boxShadow = '';
        }
    }

    private updateSelectionHighlights(): void {
        if (!this.options.playerSelections || !this.options.playerColors) return;

        // Remove existing selection highlights
        const existingHighlights = this.element.querySelectorAll('.player-selection-indicator');
        existingHighlights.forEach(highlight => highlight.remove());

        // Add selection highlights for each player who has this card selected
        Object.entries(this.options.playerSelections).forEach(([playerId, selectedCardIds]) => {
            if (selectedCardIds.includes(this.card.id)) {
                const color = this.options.playerColors?.[playerId];
                if (color) {
                    const indicator = document.createElement('div');
                    indicator.className = 'player-selection-indicator';
                    indicator.style.position = 'absolute';
                    indicator.style.top = '-2px';
                    indicator.style.left = '-2px';
                    indicator.style.right = '-2px';
                    indicator.style.bottom = '-2px';
                    indicator.style.border = `3px solid ${color}`;
                    indicator.style.borderRadius = '8px';
                    indicator.style.pointerEvents = 'none';
                    indicator.style.zIndex = '100';
                    this.element.appendChild(indicator);
                }
            }
        });
    }

    private updateCounters(): void {
        // Remove existing counter displays
        const existingCounters = this.element.querySelectorAll('.card-counter');
        existingCounters.forEach(counter => counter.remove());

        // Add counter displays - handle both number and object counters
        if (this.card.counters !== undefined) {
            if (typeof this.card.counters === 'number' && this.card.counters > 0) {
                // Handle simple number counter (legacy)
                const counterEl = document.createElement('div');
                counterEl.className = 'card-counter';
                counterEl.style.position = 'absolute';
                counterEl.style.top = '5px';
                counterEl.style.right = '5px';
                counterEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                counterEl.style.color = 'white';
                counterEl.style.padding = '2px 6px';
                counterEl.style.borderRadius = '12px';
                counterEl.style.fontSize = '12px';
                counterEl.style.fontWeight = 'bold';
                counterEl.style.zIndex = '101';
                counterEl.textContent = `+${this.card.counters}`;
                
                if (this.options.isInteractable && this.options.onCounterClick) {
                    counterEl.style.cursor = 'pointer';
                    counterEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.options.onCounterClick?.(this.card, this.element, 'generic', e);
                    });
                }
                
                this.element.appendChild(counterEl);
            } else if (typeof this.card.counters === 'object' && this.card.counters !== null) {
                // Handle object counters (if Card class is updated to support this)
                Object.entries(this.card.counters).forEach(([counterType, count], index) => {
                    if (typeof count === 'number' && count > 0) {
                        const counterEl = document.createElement('div');
                        counterEl.className = 'card-counter';
                        counterEl.style.position = 'absolute';
                        counterEl.style.top = `${5 + (index * 25)}px`;
                        counterEl.style.right = '5px';
                        counterEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                        counterEl.style.color = 'white';
                        counterEl.style.padding = '2px 6px';
                        counterEl.style.borderRadius = '12px';
                        counterEl.style.fontSize = '12px';
                        counterEl.style.fontWeight = 'bold';
                        counterEl.style.zIndex = '101';
                        counterEl.textContent = `${counterType}: ${count}`;
                        
                        if (this.options.isInteractable && this.options.onCounterClick) {
                            counterEl.style.cursor = 'pointer';
                            counterEl.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.options.onCounterClick?.(this.card, this.element, counterType, e);
                            });
                        }
                        
                        this.element.appendChild(counterEl);
                    }
                });
            }
        }
    }

    private addEventListeners(): void {
        if (this.options.onCardClick) {
            this.element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.options.onCardClick?.(this.card, this.element, e);
            });
        }

        if (this.options.onCardDblClick) {
            this.element.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.options.onCardDblClick?.(this.card, this.element, e);
            });
        }

        if (this.options.onCardDragStart) {
            this.element.draggable = true;
            this.element.addEventListener('dragstart', (e) => {
                this.handleDragStart(e);
                this.options.onCardDragStart?.(this.card, this.element, e);
            });
        }

        if (this.options.onTouchRelease) {
            this.element.addEventListener('touchend', (e) => {
                this.options.onTouchRelease?.(this.card, this.element, e);
            });
        }
    }

    private removeEventListeners(): void {
        // Clone the element to remove all event listeners
        const newElement = this.element.cloneNode(true) as HTMLElement;
        if (this.element.parentNode) {
            this.element.parentNode.replaceChild(newElement, this.element);
        }
        this.element = newElement;
    }

    /**
     * Handle drag start - create proper drag image and center it
     */
    private handleDragStart(event: DragEvent): void {
        // Get current card width from CSS variable
        const computedStyle = getComputedStyle(document.documentElement);
        const currentCardWidth = parseInt(computedStyle.getPropertyValue('--card-width')) || 80;
        
        // Create custom drag image
        const customDragImage = this.createCustomDragImage(currentCardWidth);
        
        // Set the custom drag image, centered on cursor
        const cardHeight = currentCardWidth * (107 / 80); // Magic the Gathering card aspect ratio
        event.dataTransfer?.setDragImage(customDragImage, currentCardWidth / 2, cardHeight / 2);
        
        // Clean up the temporary drag image after drag operation starts
        setTimeout(() => {
            if (customDragImage && customDragImage.parentNode) {
                customDragImage.parentNode.removeChild(customDragImage);
            }
        }, 1);
    }

    /**
     * Create a custom drag image for the card
     */
    private createCustomDragImage(currentCardWidth: number): HTMLElement {
        // Create a clone of the card element
        const dragImage = this.element.cloneNode(true) as HTMLElement;

        // Force the drag image to use the current card width
        const cardHeight = currentCardWidth * (107 / 80);
        dragImage.style.width = `${currentCardWidth}px`;
        dragImage.style.height = `${cardHeight}px`;
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px'; // Hide it off-screen
        dragImage.style.left = '-9999px';
        dragImage.style.pointerEvents = 'none';
        dragImage.style.opacity = '0.9'; // Make it slightly transparent
        dragImage.style.zIndex = '999999';

        // Override CSS variables for this specific element
        dragImage.style.setProperty('--card-width', `${currentCardWidth}px`);

        // Add to document temporarily
        document.body.appendChild(dragImage);

        return dragImage;
    }
}