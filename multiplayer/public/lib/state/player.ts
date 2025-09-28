import { BaseCard } from './basecard';

// Base representation of a player
export class Player {
    // id can possibly change (rejoin)
    id : string;
    readonly name: string;
    readonly commanders : string[];
    readonly library : string[];

    libraryZone : BaseCard[] = [];
    commandZone: BaseCard[] = [];
    graveyardZone: BaseCard[] = [];
    exileZone: BaseCard[] = [];

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
}