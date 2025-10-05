import { Update } from "./updates";
import { StatusOr, Zone } from "./socketinterface";
import { ScryfallCache } from "../scryfallCache";

export class Card {
    readonly cardName: string;
    readonly scryfallId: string; // If empty that means this wasn't found on creation, don't bother trying to find it
    readonly commander: boolean;

    // We should generate a new id rather than duplicate
    readonly id: string;

    // Zone where this card is currently located
    zone: Zone;

    // These only really matter when in a battlefield, should be ignored otherwise
    location = new Point(0,0);
    tapped: boolean;
    flipped: boolean;
    counters = 0;

    constructor(id: string, name: string, zone: Zone = Zone.library, isCommander = false, scryfallId: string = "") {
        this.cardName = name;
        this.id = id;
        this.scryfallId = scryfallId;
        this.zone = zone;
        this.tapped = false;
        this.flipped = false;
        this.commander = isCommander;
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

export class ScryfallCardFactory implements CardFactory {
    playerId : string;
    counter = 0;

    constructor(playerId : string) {
        this.playerId = playerId;
    }

    scryfallCache = ScryfallCache.getInstance();

    createCardsFromIds(scryfallIds: string[]): Card[] {
        let cards : Card[] = [];
        scryfallIds.forEach(
            id => {
                let scryFallCard = this.scryfallCache.getById(id);
                let name = scryFallCard?.name ?? "unnamed";
                cards.push(new Card(this.playerId + this.counter, name, Zone.library, false, id));
                ++this.counter;
            }
        )
        return  cards;
    }

    createCardsFromNames(names: string[]) : Card[] {
        let cards : Card[] = [];
        names.forEach(
            name => {
                let scryFallCard = this.scryfallCache.get(name);
                cards.push(new Card(this.playerId + this.counter, name, Zone.library, false, scryFallCard?.id ?? ""));
                ++this.counter;
            }
        )
        return  cards;
    }

    // Active step, but we can be a bit more agressive here, there's a progress callback but it typically shouldn't be used
    loadCardsFromIds(ids: string[], progressCallback: (loaded: number, total: number, currentCard: string) => void) {
        this.scryfallCache.load(ids, (loaded: number, total: number, currentCard: string) => {
            progressCallback(loaded, total, currentCard);
        }, true);
    }

    // Preload step, each client should only have to do this on their own cards
    loadCardsFromNames(names: string[], progressCallback: (loaded: number, total: number, currentCard: string) => void) {
        this.scryfallCache.load(names, (loaded: number, total: number, currentCard: string) => {
            progressCallback(loaded, total, currentCard);
        }); 
    }
    
}