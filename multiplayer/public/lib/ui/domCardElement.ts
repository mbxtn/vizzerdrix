import { Card } from '../state/card.js';
import { Zone } from '../state/socketinterface.js';

export interface DOMCardElementOptions {
    isMagnifyEnabled?: boolean;
    isInteractable?: boolean;
    onCardClick?: (card: Card, element: HTMLElement) => void;
    onCardDblClick?: (card: Card, element: HTMLElement) => void;
    onCardDragStart?: (card: Card, element: HTMLElement, event: DragEvent) => void;
    onCounterClick?: (card: Card, element: HTMLElement, counterType: string) => void;
    onTouchRelease?: (card: Card, element: HTMLElement) => void;
    showBack?: boolean;
    isGhost?: boolean;
    isReverseGhost?: boolean;
    playerSelections?: { [playerId: string]: string[] };
    playerColors?: { [playerId: string]: string };
}

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
        element.className = 'card';
        element.setAttribute('data-id', this.card.id);
        element.setAttribute('data-zone', Zone[this.zone]); // Convert enum to string
        
        // Set base styles
        element.style.position = 'relative';
        element.style.display = 'inline-block';
        
        return element;
    }

    private updateElement(): void {
        // Update content based on card type - use the Card's isTemporary property
        if (this.card.isTemporary) {
            this.updateTemporaryCard();
        } else {
            this.updateRegularCard();
        }

        // Update position if battlefield card
        if (this.zone === Zone.battlefield) {
            this.setPosition(this.card.location.x, this.card.location.y);
            this.setRotation(this.card.tapped ? 90 : 0);
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
        this.element.innerHTML = `
            <div class="temporary-content">
                <span class="temporary-text">${this.card.cardName}</span>
            </div>
        `;
    }

    private updateRegularCard(): void {
        this.element.className = 'card';
        
        // This would integrate with your existing cardFactory system
        // For now, create a basic structure
        this.element.innerHTML = `
            <div class="card-content">
                <img src="${this.getCardImageUrl()}" alt="${this.card.cardName}" class="card-image" />
                <div class="card-name">${this.card.cardName}</div>
            </div>
        `;
    }

    private getCardImageUrl(): string {
        // This would integrate with your Scryfall cache system
        // Return appropriate image URL based on card data and options.showBack
        if (this.options.showBack) {
            return './cardback.png';
        }
        
        // Would normally get from ScryfallCache based on card.scryfallId
        return `https://api.scryfall.com/cards/${this.card.scryfallId}?format=image&version=normal`;
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
                        this.options.onCounterClick?.(this.card, this.element, 'generic');
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
                                this.options.onCounterClick?.(this.card, this.element, counterType);
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
                this.options.onCardClick?.(this.card, this.element);
            });
        }

        if (this.options.onCardDblClick) {
            this.element.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.options.onCardDblClick?.(this.card, this.element);
            });
        }

        if (this.options.onCardDragStart) {
            this.element.draggable = true;
            this.element.addEventListener('dragstart', (e) => {
                this.options.onCardDragStart?.(this.card, this.element, e);
            });
        }

        if (this.options.onTouchRelease) {
            this.element.addEventListener('touchend', (e) => {
                this.options.onTouchRelease?.(this.card, this.element);
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
}