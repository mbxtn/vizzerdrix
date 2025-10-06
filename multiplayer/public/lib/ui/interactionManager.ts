import { Card } from '../state/card.js';
import { Player } from '../state/player.js';
import { Game } from '../state/game.js';
import { Zone } from '../state/socketinterface.js';
import { VdClient } from '../state/socketclient.js';
import { DOMCardManager } from './domCardManager.js';

export interface InteractionManagerCallbacks {
    render: () => void;
    showMessage: (message: string) => void;
    getCurrentPlayer: () => Player | undefined;
    getCurrentGame: () => Game | undefined;
    getActivePlayZonePlayerId: () => string | null;
    getCurrentlyViewedPlayerId: () => string | null;
    getPlayerId: () => string | null;
}

/**
 * Manages all card and zone interactions, keeping interaction logic 
 * separate from the main client code.
 */
export class InteractionManager {
    private vdClient: VdClient;
    private cardManager: DOMCardManager;
    private callbacks: InteractionManagerCallbacks;

    constructor(
        vdClient: VdClient, 
        cardManager: DOMCardManager, 
        callbacks: InteractionManagerCallbacks
    ) {
        this.vdClient = vdClient;
        this.cardManager = cardManager;
        this.callbacks = callbacks;
    }

    /**
     * Handle card click events
     */
    handleCardClick = (card: Card, element: HTMLElement, event: MouseEvent): void => {
        console.log('Card clicked:', card.cardName, card.id);
        
        const player = this.callbacks.getCurrentPlayer();
        if (!player) return;

        // Allow selection of any card, but only allow full interaction with own cards
        const zone = card.zone;
        const playerId = this.callbacks.getPlayerId();
        const activePlayZonePlayerId = this.callbacks.getActivePlayZonePlayerId();
        const isOwnCard = (zone === Zone.hand) || (zone === Zone.battlefield && activePlayZonePlayerId === playerId);
        
        // Handle multi-selection with Ctrl key
        const isCtrlPressed = event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
        
        console.log('Selection state before:', player.selectedCards.slice());
        
        if (isCtrlPressed) {
            // Toggle selection
            const index = player.selectedCards.indexOf(card.id);
            if (index > -1) {
                player.selectedCards.splice(index, 1);
            } else {
                player.selectedCards.push(card.id);
            }
        } else {
            // Single selection
            player.selectedCards.length = 0; // Clear array
            player.selectedCards.push(card.id);
        }
        
        console.log('Selection state after:', player.selectedCards.slice());
        
        // Update visual selection state through DOMCardManager
        this.cardManager.updateSelections(player.selectedCards, {}, {});
        
        // TODO: Send selection update to server
        console.log('TODO: Send selection update to server');
    };

    /**
     * Handle card double-click events
     */
    handleCardDoubleClick = (card: Card, element: HTMLElement, event: MouseEvent): void => {
        console.log('Card double-clicked:', card.cardName);
        
        const player = this.callbacks.getCurrentPlayer();
        if (!player) return;

        // Only allow double-click interactions on own cards
        const zone = card.zone;
        const playerId = this.callbacks.getPlayerId();
        const activePlayZonePlayerId = this.callbacks.getActivePlayZonePlayerId();
        const isOwnCard = (zone === Zone.hand) || (zone === Zone.battlefield && activePlayZonePlayerId === playerId);
        
        if (!isOwnCard) {
            console.log('Cannot double-click non-owned card');
            return;
        }
        
        if (zone === Zone.hand) {
            // Play card from hand to battlefield
            console.log('Playing card from hand to battlefield');
            
            // Update card zone and position
            card.zone = Zone.battlefield;
            card.location.x = 100; // Default position
            card.location.y = 100;
            
            // Send updated state to server
            this.vdClient.updateState(player);
            
            // Update visual state
            this.callbacks.render();
            
        } else if (zone === Zone.battlefield) {
            // Tap/untap card
            console.log('Toggling card tap state');
            card.tapped = !card.tapped;
            
            // Send updated state to server
            this.vdClient.updateState(player);
            
            // Update visual state
            this.callbacks.render();
        }
    };

    /**
     * Handle card drag start events
     */
    handleCardDragStart = (card: Card, element: HTMLElement, event: DragEvent): void => {
        console.log('Card drag started:', card.cardName);
        
        const player = this.callbacks.getCurrentPlayer();
        if (!player) return;

        // Only allow dragging own cards
        const zone = card.zone;
        const playerId = this.callbacks.getPlayerId();
        const activePlayZonePlayerId = this.callbacks.getActivePlayZonePlayerId();
        const isOwnCard = (zone === Zone.hand) || (zone === Zone.battlefield && activePlayZonePlayerId === playerId);
        
        if (!isOwnCard) {
            event.preventDefault();
            return;
        }
        
        // If this card is not selected, select it
        if (!player.selectedCards.includes(card.id)) {
            player.selectedCards.length = 0;
            player.selectedCards.push(card.id);
            this.cardManager.updateSelections(player.selectedCards, {}, {});
        }
        
        // Set up drag data
        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', JSON.stringify({
                cardIds: player.selectedCards,
                sourceZone: Zone[zone]
            }));
        }
        
        console.log('Drag data set for cards:', player.selectedCards);
    };

    /**
     * Handle card drawing from zones (library, command, etc.)
     */
    handleCardDraw = (card: any, targetZone: string, options: any = {}): void => {
        console.log(`Drawing card from zone to ${targetZone}:`, card);
        
        const player = this.callbacks.getCurrentPlayer();
        if (!player) {
            console.error('No player available for card draw');
            return;
        }
        
        // Find the actual Card object in the player's cards
        const playerCard = player.getCard(card.id);
        if (!playerCard) {
            console.error('Card not found in player cards:', card.id);
            return;
        }
        
        // Convert target zone string to Zone enum
        const targetZoneEnum = this.getZoneFromString(targetZone);
        if (targetZoneEnum === null) {
            console.error('Invalid target zone:', targetZone);
            return;
        }
        
        console.log(`Moving card ${playerCard.cardName} from ${Zone[playerCard.zone]} to ${targetZone}`);
        
        // Update the card's zone
        playerCard.zone = targetZoneEnum;
        
        // Handle special positioning for battlefield
        if (targetZone === 'battlefield') {
            playerCard.location.x = options.x || 100;
            playerCard.location.y = options.y || 100;
        }
        
        // Send updated state to server
        this.vdClient.updateState(player);
        
        // Trigger a render
        this.callbacks.render();
    };

    /**
     * Handle zone state changes
     */
    handleZoneStateChange = (action: string, cardIdOrIds: string | string[], sourceZone: string, targetZone: string): void => {
        console.log(`Zone state change: ${action} from ${sourceZone} to ${targetZone}`, cardIdOrIds);
        
        // TODO: Implement zone state changes using vdClient
        // This would update the state classes and send to server
        
        // For now, trigger a render
        this.callbacks.render();
    };

    /**
     * Handle card drops between zones
     */
    handleCardDrop = (event: DragEvent, targetZone: string, dropElement: HTMLElement): void => {
        const dragData = event.dataTransfer?.getData('text/plain');
        const player = this.callbacks.getCurrentPlayer();
        
        console.log('Raw drag data received:', dragData);
        console.log('Drag data type:', typeof dragData);
        console.log('Drag data length:', dragData?.length);
        
        if (!dragData || !player) {
            console.log('Missing drag data or player');
            return;
        }
        
        try {
            const data = JSON.parse(dragData);
            const { cardIds, sourceZone } = data;
            
            console.log(`Drop detected: Moving ${cardIds.length} cards from ${sourceZone} to ${targetZone}`);
            
            if (!cardIds || !Array.isArray(cardIds)) {
                console.error('Invalid drag data: cardIds not found or not an array');
                return;
            }
            
            this.processDrop(cardIds, sourceZone, targetZone, dropElement, event, player);
            
        } catch (error) {
            console.error('Error parsing drag data as JSON:', error);
            console.log('Attempting to handle as simple card ID...');
            
            // Fallback: try to handle as a simple card ID
            if (typeof dragData === 'string' && dragData.trim()) {
                const cardId = dragData.trim();
                console.log('Treating drag data as card ID:', cardId);
                
                // Find the card to determine source zone
                const card = player.getCard(cardId);
                if (card) {
                    const sourceZone = Zone[card.zone];
                    console.log(`Found card ${card.cardName} in ${sourceZone}, moving to ${targetZone}`);
                    this.processDrop([cardId], sourceZone, targetZone, dropElement, event, player);
                } else {
                    console.error('Card not found for ID:', cardId);
                }
            } else {
                console.error('Unable to handle drag data:', dragData);
            }
        }
    };

    /**
     * Process the actual drop operation
     */
    private processDrop = (cardIds: string[], sourceZone: string, targetZone: string, dropElement: HTMLElement, event: DragEvent, player: any): void => {
        // Convert zone names to Zone enum values
        const sourceZoneEnum = this.getZoneFromString(sourceZone);
        const targetZoneEnum = this.getZoneFromString(targetZone);
        
        if (sourceZoneEnum === null || targetZoneEnum === null) {
            console.error('Invalid zone names:', sourceZone, targetZone);
            return;
        }
        
        // Calculate position for battlefield drops
        let x = 0, y = 0;
        if (targetZone === 'battlefield') {
            const rect = dropElement.getBoundingClientRect();
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        }
        
        // Move cards from source to target zone
        for (const cardId of cardIds) {
            const card = player.getCard(cardId);
            if (card) {
                // Update card properties
                card.zone = targetZoneEnum;
                if (targetZone === 'battlefield') {
                    card.location.x = x;
                    card.location.y = y;
                    // Add small offset for multiple cards
                    x += 20;
                    y += 20;
                }
                
                console.log(`Moved card ${card.cardName} from ${sourceZone} to ${targetZone}`);
            } else {
                console.error('Card not found:', cardId);
            }
        }
        
        // Send updated state to server
        this.vdClient.updateState(player);
        
        // Update visual state
        this.callbacks.render();
    };

    /**
     * Convert zone string to Zone enum
     */
    private getZoneFromString(zoneString: string): Zone | null {
        switch (zoneString.toLowerCase()) {
            case 'hand': return Zone.hand;
            case 'battlefield': return Zone.battlefield;
            case 'library': return Zone.library;
            case 'graveyard': return Zone.graveyard;
            case 'exile': return Zone.exile;
            case 'command': return Zone.command;
            default: return null;
        }
    }
}