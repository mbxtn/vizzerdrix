import { Card } from '../state/card.js';
import { Zone } from '../state/socketinterface.js';

/**
 * Interface for zones that can accept dropped cards
 */
export interface IDropZone {
    /**
     * Handle cards being dropped into this zone
     * @param cards Array of Card objects being dropped
     * @param dropPosition Optional position data for zones that support positioning
     * @returns true if the drop was successful, false otherwise
     */
    handleCardDrop(cards: Card[], dropPosition?: { x: number, y: number }): boolean;

    /**
     * Check if cards can be dropped into this zone
     * @param cards Array of Card objects to check
     * @returns true if the drop would be valid
     */
    canAcceptCards(cards: Card[]): boolean;

    /**
     * Get the zone type this drop handler represents
     */
    getZoneType(): Zone;
}

/**
 * Interface for click actions on zones (like clicking on a pile to draw)
 */
export interface IClickableZone {
    /**
     * Handle click on the zone (e.g., draw from library)
     */
    handleZoneClick(): void;

    /**
     * Check if the zone can be clicked
     */
    canClick(): boolean;
}