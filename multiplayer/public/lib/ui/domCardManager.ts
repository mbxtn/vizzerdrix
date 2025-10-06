import { Card } from '../state/card.js';
import { Zone } from '../state/socketinterface.js';
import { DOMCardElement, DOMCardElementOptions } from './domCardElement.js';

/**
 * Manages the mapping between Card state objects and their DOM representations.
 * Provides efficient updates and maintains consistency between state and UI.
 */
export class DOMCardManager {
    private cardElements = new Map<string, DOMCardElement>();
    private defaultOptions: DOMCardElementOptions = {};

    /**
     * Set default options that will be applied to all card elements
     */
    setDefaultOptions(options: DOMCardElementOptions): void {
        this.defaultOptions = { ...options };
    }

    /**
     * Create or update a DOM element for a Card
     */
    createOrUpdateCardElement(
        card: Card, 
        zone: Zone, 
        options: DOMCardElementOptions = {}
    ): DOMCardElement {
        const mergedOptions = { ...this.defaultOptions, ...options };
        
        let domCard = this.cardElements.get(card.id);
        
        if (!domCard) {
            // Create new DOM element
            domCard = new DOMCardElement(card, zone, mergedOptions);
            this.cardElements.set(card.id, domCard);
        } else {
            // Update existing DOM element
            domCard.updateFromCard(card);
            domCard.updateOptions(mergedOptions);
        }
        
        return domCard;
    }

    /**
     * Get a DOM element for a specific card ID
     */
    getCardElement(cardId: string): DOMCardElement | undefined {
        return this.cardElements.get(cardId);
    }

    /**
     * Remove a card element from management
     */
    removeCardElement(cardId: string): void {
        const domCard = this.cardElements.get(cardId);
        if (domCard) {
            domCard.destroy();
            this.cardElements.delete(cardId);
        }
    }

    /**
     * Update multiple cards efficiently
     */
    updateCards(
        cards: Card[], 
        zone: Zone, 
        options: DOMCardElementOptions = {}
    ): DOMCardElement[] {
        const cardIds = new Set(cards.map(card => card.id));
        const domCards: DOMCardElement[] = [];

        // Remove DOM elements for cards that no longer exist
        for (const [cardId, domCard] of this.cardElements.entries()) {
            if (!cardIds.has(cardId)) {
                domCard.destroy();
                this.cardElements.delete(cardId);
            }
        }

        // Create or update DOM elements for current cards
        for (const card of cards) {
            const domCard = this.createOrUpdateCardElement(card, zone, options);
            domCards.push(domCard);
        }

        return domCards;
    }

    /**
     * Update selection state for multiple cards
     */
    updateSelections(
        selectedCardIds: string[], 
        playerSelections: { [playerId: string]: string[] },
        playerColors: { [playerId: string]: string }
    ): void {
        // Clear all selections first
        for (const domCard of this.cardElements.values()) {
            domCard.setSelected(false);
        }

        // Set selection state for selected cards
        for (const cardId of selectedCardIds) {
            const domCard = this.cardElements.get(cardId);
            if (domCard) {
                domCard.setSelected(true);
            }
        }

        // Update player selection highlights
        for (const domCard of this.cardElements.values()) {
            domCard.updatePlayerSelections(playerSelections, playerColors);
        }
    }

    /**
     * Update positions for battlefield cards
     */
    updateBattlefieldPositions(cards: Card[]): void {
        for (const card of cards) {
            const domCard = this.cardElements.get(card.id);
            if (domCard) {
                domCard.setPosition(card.location.x, card.location.y);
                domCard.setRotation(card.tapped ? 90 : 0);
            }
        }
    }

    /**
     * Get all DOM elements for a specific zone
     */
    getElementsForZone(zone: Zone): DOMCardElement[] {
        const elements: DOMCardElement[] = [];
        for (const domCard of this.cardElements.values()) {
            // Check if the card's current state matches the zone
            if (domCard.getCard().zone === zone) {
                elements.push(domCard);
            }
        }
        return elements;
    }

    /**
     * Clear all managed elements
     */
    clear(): void {
        for (const domCard of this.cardElements.values()) {
            domCard.destroy();
        }
        this.cardElements.clear();
    }

    /**
     * Get count of managed elements
     */
    getCount(): number {
        return this.cardElements.size;
    }

    /**
     * Update options for all existing elements
     */
    updateAllOptions(options: Partial<DOMCardElementOptions>): void {
        for (const domCard of this.cardElements.values()) {
            domCard.updateOptions(options);
        }
    }

    /**
     * Get all managed card IDs
     */
    getManagedCardIds(): string[] {
        return Array.from(this.cardElements.keys());
    }

    /**
     * Render cards directly to a container element
     */
    renderCardsToContainer(
        cards: Card[], 
        container: HTMLElement, 
        zone: Zone,
        options: DOMCardElementOptions = {}
    ): DOMCardElement[] {
        container.innerHTML = '';
        const domCards: DOMCardElement[] = [];

        for (const card of cards) {
            const domCard = this.createOrUpdateCardElement(card, zone, options);
            const element = domCard.getElement();
            container.appendChild(element);
            domCards.push(domCard);
        }

        return domCards;
    }
}