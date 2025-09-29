import { BaseCard } from './basecard';
import { Zone } from './socketinterface';

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
    handZone: BaseCard[] = [];
    exileZone: BaseCard[] = [];
    battlefieldZone: BaseCard[] = [];

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

    getZone(zone: Zone) : BaseCard[] {
        switch(zone) {
            case Zone.battlefield:
                return this.battlefieldZone;
            case Zone.command:
                return this.commandZone;
            case Zone.exile:
                return this.exileZone;
            case Zone.graveyard:
                return this.exileZone;
            case Zone.hand:
                return this.handZone;
            default: 
                return this.libraryZone;
        }
    }

    getCard(id: string, zone : Zone) : BaseCard | undefined {
        // Just loop through all the zones and see if we can get a reference to the card, probably a smarter way to handle this.
        return this.getZone(zone).find((card: BaseCard) => {return card.id == id;});
    }
}