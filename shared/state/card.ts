import { Update } from "./updates";
import { StatusOr, Zone } from "./socketinterface";

export class Card {
    readonly cardName: string;
    readonly scryfallId: string; // If empty that means this wasn't found on creation, don't bother trying to find it
    readonly commander: boolean;
    readonly isTemporary: boolean; // For placeholders, copies, temporary cards, etc.

    // We should generate a new id rather than duplicate
    readonly id: string;

    // Zone where this card is currently located
    zone: Zone;

    // These only really matter when in a battlefield, should be ignored otherwise
    location = new Point(0,0);
    tapped: boolean;
    flipped: boolean;
    counters = 0;
    zIndex?: number;

    constructor(id: string, name: string, zone: Zone = Zone.library, isCommander = false, scryfallId: string = "", isTemporary = false) {
        this.cardName = name;
        this.id = id;
        this.scryfallId = scryfallId;
        this.zone = zone;
        this.tapped = false;
        this.flipped = false;
        this.commander = isCommander;
        this.isTemporary = isTemporary;
    }
}

export class Point {
    x = 0;
    y = 0;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export interface CardFactory {
    createCardsFromIds(scryfallIds: string[]) : Card[];
    createCardsFromNames(scryfallIds: string[]) : Card[];
    loadCardsFromNames(names: string[], progressCallback: (loaded: number, total: number, currentCard: string) => void) : void;
    loadCardsFromIds(names: string[], progressCallback: (loaded: number, total: number, currentCard: string) => void) : void;
}
