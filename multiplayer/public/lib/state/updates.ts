// This is a class with client side updates.
// Foundation for a log and also generating events.

import { BaseCard, Point } from "./basecard";
import { Player } from "./player";
import { Zone } from "./socketinterface";

// Updates are really for logging, not for managing state. We aren't really shooting for reliability or server side validation
// to the point that we can implement rollbacks or something. 
// What we can do is give our best effort to write what the server thinks happened to a game log.
// This class is just trying to effectively combine those states. So that we can update the log appropriately.
// e.g. combine drawing 20 cards quickly into one log message vs 20 individual ones
export abstract class Update {
    time: number
    threshold: number = 500; // Default threshold, can be overridden in subclasses

    constructor() {
        this.time = Date.now();
    }

    // Each subclass should implement this
    abstract describe(): string;

    // Check if two updates can be combined based on time threshold
    protected canCombineWithTime(other: Update): boolean {
        return Math.abs(other.time - this.time) <= this.threshold;
    }

    // Optionally, implement combining logic
    combineWith(other: Update): Update | undefined {
        return; // Default: not combinable
    }
}

export class EmptyUpdate extends Update {
    describe(): string {
        return "";
    }

    combineWith(other: Update): Update | undefined {
        return;
    }
}

export class CardMoved extends Update {
    card: BaseCard;
    origin: Zone;
    dest: Zone;
    position: Point;

    constructor(card: BaseCard, fromZone: Zone, toZone: Zone, position: Point = new Point(0,0)) {
        super();
        this.card = card;
        this.origin = fromZone;
        this.dest = toZone;
        this.position = position;
    }

    describe(): string {
        if (this.dest == this.dest) {
            if(this.dest == Zone.battlefield) {
                return `${this.card.cardName} moved on the battlefield`
            }
            // We moved it within a zone, ideally we shouldn't be in this state.. but it could help prevent
            // someone from accidentally playing a card and having it in the log forever, even if they undo it
            // quickly
            return 'moved no where';
        } 
        // A card being moved between the hand and library shouldn't be visible.
        if( this.dest == Zone.library && this.origin == Zone.hand) {
            return "moved a card to their library"
        }
        if( this.dest == Zone.library && this.origin == Zone.hand) {
            return "moved a card to their library"
        }
        let result =  `moved ${this.card.cardName} to ${Zone[this.dest]} from ${Zone[this.origin]}`;
        return result;

    }

    // I don't really care about original starting position, but we do care about original zone I think?
    combineWith(other: Update): Update | undefined {
        if (other instanceof CardMoved) {
            // Don't combine if they're outside a time threshold. 
            if(!this.canCombineWithTime(other)) return;
            if(other.time > this.time) {
                other.origin = this.origin;
                return other;
            } else {
                this.origin = other.origin
                return this;
            }
        }
        return;
    }
}

export class CardsMoved extends Update {
    cards : BaseCard[];
    origin: Zone;
    dest: Zone;

    constructor(first: BaseCard,  second : BaseCard, origin : Zone, dest: Zone) {
        super();
        this.cards = [first, second];
        this.origin = origin;
        this.dest = dest;
    }

    describe() : string {
        // Iterate over cards
        return "";
    }

    combineWith(other: Update) : Update | undefined  {
        // If the timestamps are too far do nothing, I think this is wrong perf wise, but cleanest code wise
        if(!this.canCombineWithTime(other)) return;
        // First case, a CardMovedUpdate: We add that card to this update
        if(other instanceof CardMoved) {

            return;
        }
        // Second case, a CardsMovedUpdate: If they have the same destination combine them
        return;
    }
}

export class CountersChanged extends Update {
    describe(): string {
        throw new Error("Method not implemented.");
    }
}

export class TappedUntapped extends Update {
    describe(): string {
        throw new Error("Method not implemented.");
    }
}

export class CardCreated extends Update {
    card : BaseCard;
    // We only need one card and a number since we'll only duplicate cards with the same name
    cardsCreated : number;

    constructor(card: BaseCard) {
        super();
        this.card = card;
        this.cardsCreated = 1;
    }

    combineWith(other: Update): Update | undefined {
        if (other instanceof CardCreated) {
            if(!this.canCombineWithTime(other)) return
            // If the card names match, increment by the others created count and dedupe
            if(this.card.cardName == other.card.cardName) {
                this.cardsCreated += other.cardsCreated;
                return this;
            }
            return
        }
        return
    }

    describe(): string {
        throw new Error("Method not implemented.");
    }
}

// Basic class for players to post messages to the log
export class Message extends Update {
    message : string;
    constructor(message : string) {
        super();
        this.message = this.sanitizeMessage(message);
    }

    private sanitizeMessage(message: string): string {
        // Trim whitespace and limit length
        const trimmed = message.trim();
        const maxLength = 500;
        const truncated = trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
        
        // Remove or escape potentially dangerous characters
        return truncated
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/&/g, '&amp;');
    }

    describe(): string {
        return this.message;
    }
}
