import { BaseCard } from './basecard';
import { Zone } from './socketinterface';
import { Update } from './updates';

// Base representation of a player
export class Player {
    // id can possibly change (rejoin)
    id: string;
    readonly name: string;
    readonly commanders: string[];
    readonly library: string[];

    // Flat map of all cards by ID
    cards: { [id: string]: BaseCard } = {};

    // A single players game log, a date sorted combined log should be accessible in the Game itself
    // should be periodically updated with the contents of updates. Updates subclassing won't properly 
    // cross network boundaries without some casting system. So we'll just process them locally into gameLog.
    updates: Update[] = [];
    gameLog: { time: number, message: string }[] = [];

    lifeTotal = 40;

    // Indicates if a player is active in the game.
    isActive: boolean;

    constructor(playerId: string, playerName: string, commanders: string[], library: string[]) {
        this.id = playerId;
        this.name = playerName;
        this.commanders = commanders;
        this.library = library;
        this.isActive = true;
    }

    updateGameLog() {
        let combinedUpdates = [];
        let currentUpdate: Update | undefined;
        this.updates.forEach((update: Update) => {
            if (currentUpdate) {
                let combined = currentUpdate.combineWith(update);
                if (combined) {
                    currentUpdate = combined;
                } else {
                    combinedUpdates.push(currentUpdate);
                    currentUpdate = update;
                }
            } else {
                currentUpdate = update;
            }
        });
        if (currentUpdate) combinedUpdates.push(currentUpdate);
        this.updates = combinedUpdates;
        let gameLog: { time: number, message: string }[] = [];
        this.updates.forEach((update: Update) => {
            gameLog.push({time: update.time, message: update.describe() });
        });
        this.gameLog = gameLog;
    }

    getZone(zone: Zone): BaseCard[] {
        return Object.values(this.cards).filter(card => card.zone === zone);
    }

    getCard(id: string, zone?: Zone): BaseCard | undefined {
        const card = this.cards[id];
        if (!card) return undefined;
        
        // If zone is specified, only return the card if it's in that zone
        if (zone !== undefined && card.zone !== zone) return undefined;
        
        return card;
    }
}