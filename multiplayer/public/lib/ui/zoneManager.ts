import { Zone } from '../state/socketinterface.js';
import { CardZone } from './cardZone.js';
import { DOMCardManager } from './domCardManager.js';
import { InteractionManager } from './interactionManager.js';
import { SettingsManager } from './settingsManager.js';

export interface ZoneManagerCallbacks {
    showMessage: (message: string) => void;
}

/**
 * Manages all CardZone instances and their setup
 */
export class ZoneManager {
    private zones: Map<Zone, CardZone> = new Map();
    private interactionManager: InteractionManager;
    private cardManager: DOMCardManager;
    private settingsManager: SettingsManager;
    private callbacks: ZoneManagerCallbacks;

    constructor(
        interactionManager: InteractionManager,
        cardManager: DOMCardManager,
        settingsManager: SettingsManager,
        callbacks: ZoneManagerCallbacks
    ) {
        this.interactionManager = interactionManager;
        this.cardManager = cardManager;
        this.settingsManager = settingsManager;
        this.callbacks = callbacks;
    }

    /**
     * Initialize all card zones
     */
    initializeZones(): void {
        console.log('Initializing card zones...');
        
        // Clear existing zones
        this.zones.forEach(zone => zone.destroy());
        this.zones.clear();
        
        this.setupLibraryZone();
        this.setupGraveyardZone();
        this.setupExileZone();
        this.setupCommandZone();
        
        console.log(`Initialized ${this.zones.size} card zones`);
    }

    /**
     * Setup library zone
     */
    private setupLibraryZone(): void {
        const libraryEl = document.getElementById('library');
        const libraryCountEl = document.getElementById('library-count');
        console.log('Library element found:', !!libraryEl, libraryEl?.id);
        
        if (libraryEl) {
            const libraryZone = new CardZone(libraryEl, 'library', {
                countElement: libraryCountEl,
                enablePeek: true,
                peekHoldTime: 200,
                showTopCard: true,
                currentCardWidth: this.settingsManager.getSetting('currentCardWidth'),
                isMagnifyEnabled: this.settingsManager.getSetting('isMagnifyEnabled'),
                showMessage: this.callbacks.showMessage,
                onCardDraw: this.interactionManager.handleCardDraw,
                onStateChange: this.interactionManager.handleZoneStateChange,
                cardManager: this.cardManager
            });
            this.zones.set(Zone.library, libraryZone);
            console.log('Library zone initialized successfully');
        } else {
            console.error('Library element not found!');
        }
    }

    /**
     * Setup graveyard zone
     */
    private setupGraveyardZone(): void {
        const graveyardEl = document.getElementById('graveyard-pile');
        const graveyardCountEl = document.getElementById('graveyard-count');
        
        if (graveyardEl) {
            const graveyardZone = new CardZone(graveyardEl, 'graveyard', {
                countElement: graveyardCountEl,
                enablePeek: true,
                peekHoldTime: 200,
                showShuffle: false,
                showTopCard: true,
                currentCardWidth: this.settingsManager.getSetting('currentCardWidth'),
                isMagnifyEnabled: this.settingsManager.getSetting('isMagnifyEnabled'),
                showMessage: this.callbacks.showMessage,
                onCardDraw: this.interactionManager.handleCardDraw,
                onStateChange: this.interactionManager.handleZoneStateChange,
                cardManager: this.cardManager
            });
            this.zones.set(Zone.graveyard, graveyardZone);
            console.log('Graveyard zone initialized successfully');
        }
    }

    /**
     * Setup exile zone
     */
    private setupExileZone(): void {
        const exileEl = document.getElementById('exile-pile');
        const exileCountEl = document.getElementById('exile-count');
        
        if (exileEl) {
            const exileZone = new CardZone(exileEl, 'exile', {
                countElement: exileCountEl,
                enablePeek: true,
                peekHoldTime: 200,
                showShuffle: false,
                showTopCard: true,
                currentCardWidth: this.settingsManager.getSetting('currentCardWidth'),
                isMagnifyEnabled: this.settingsManager.getSetting('isMagnifyEnabled'),
                showMessage: this.callbacks.showMessage,
                onCardDraw: this.interactionManager.handleCardDraw,
                onStateChange: this.interactionManager.handleZoneStateChange,
                cardManager: this.cardManager
            });
            this.zones.set(Zone.exile, exileZone);
            console.log('Exile zone initialized successfully');
        }
    }

    /**
     * Setup command zone
     */
    private setupCommandZone(): void {
        const commandEl = document.getElementById('command-pile');
        const commandCountEl = document.getElementById('command-count');
        console.log('Command element found:', !!commandEl, commandEl?.id);
        
        if (commandEl) {
            const commandZone = new CardZone(commandEl, 'command', {
                countElement: commandCountEl,
                enablePeek: true,
                peekHoldTime: 200,
                showShuffle: false,
                showTopCard: true,
                currentCardWidth: this.settingsManager.getSetting('currentCardWidth'),
                isMagnifyEnabled: this.settingsManager.getSetting('isMagnifyEnabled'),
                showMessage: this.callbacks.showMessage,
                onCardDraw: this.interactionManager.handleCardDraw,
                onStateChange: this.interactionManager.handleZoneStateChange,
                cardManager: this.cardManager
            });
            this.zones.set(Zone.command, commandZone);
            console.log('Command zone initialized successfully');
        } else {
            console.error('Command element not found!');
        }
    }

    /**
     * Setup drop zones for drag and drop functionality
     */
    setupDropZones(): void {
        console.log('Setting up drop zones...');
        
        // Set up hand zone for dropping cards
        const handZoneEl = document.getElementById('hand-zone');
        if (handZoneEl) {
            this.setupDropZone(handZoneEl, 'hand');
        }
        
        // Set up battlefield drop zone
        const playZonesContainer = document.getElementById('play-zones-container');
        if (playZonesContainer) {
            this.setupDropZone(playZonesContainer, 'battlefield');
        }
        
        console.log('Drop zones setup complete');
    }

    /**
     * Setup individual drop zone
     */
    private setupDropZone(element: HTMLElement, zoneName: string): void {
        // Prevent adding duplicate listeners
        if ((element as any).hasDropListeners) return;
        (element as any).hasDropListeners = true;
        
        element.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            element.classList.add('zone-active');
        });
        
        element.addEventListener('dragleave', (e: DragEvent) => {
            element.classList.remove('zone-active');
        });
        
        element.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            element.classList.remove('zone-active');
            this.interactionManager.handleCardDrop(e, zoneName, element);
        });
    }

    /**
     * Update all zones with current player data
     */
    updateZones(player: any, viewedPlayer: any, playerId: string | null): void {
        if (!viewedPlayer) return;
        
        // Update each zone with cards from the state classes
        for (const [zoneType, cardZone] of this.zones) {
            const cards = viewedPlayer.getZone(zoneType);
            
            // Convert Card objects to legacy format for CardZone compatibility
            const legacyCards = cards.map((card: any) => ({
                id: card.id,
                name: card.cardName,
                displayName: card.cardName,
                x: card.location.x,
                y: card.location.y,
                rotation: card.tapped ? 90 : 0,
                counters: card.counters,
                faceShown: card.flipped ? 'back' : 'front',
                zone: card.zone,
                isCommander: card.commander,
                isTemporary: card.isTemporary
            }));
            
            cardZone.updateCards(legacyCards);
            cardZone.setInteractionEnabled(viewedPlayer === player);
            
            console.log(`Updated ${zoneType} with ${legacyCards.length} cards`);
        }
    }

    /**
     * Update settings for all zones
     */
    updateSettings(): void {
        this.zones.forEach(zone => {
            zone.updateMagnifyEnabled(this.settingsManager.getSetting('isMagnifyEnabled'));
            zone.updateCardWidth(this.settingsManager.getSetting('currentCardWidth'));
        });
    }

    /**
     * Get a specific zone
     */
    getZone(zoneType: Zone): CardZone | undefined {
        return this.zones.get(zoneType);
    }

    /**
     * Get all zones
     */
    getAllZones(): Map<Zone, CardZone> {
        return this.zones;
    }

    /**
     * Destroy all zones
     */
    destroy(): void {
        this.zones.forEach(zone => zone.destroy());
        this.zones.clear();
    }
}