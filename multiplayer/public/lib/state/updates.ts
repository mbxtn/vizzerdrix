// This is a class with client side updates.
// Foundation for a log and also generating events.

import { BaseCard, Point } from "./basecard";
import { Player } from "./player";
import { Zone } from "./socketinterface";



export enum Type {
    cardMoved,
    cardCreated,
    cardRemoved,
    lifeChanged,
    lifeRemoved,
    gameReset,
    undefined
}

// Updates are really for logging, not for managing state. We aren't really shooting for reliability or server side validation
// to the point that we can implement rollbacks or something. 
// What we can do is give our best effort to write what the server thinks happened to a game log.
// This class is just trying to effectively combine those states. So that we can update the log appropriately.
// e.g. combine drawing 20 cards quickly into one log message vs 20 individual ones
export abstract class Update {
    type: Type
    time: Date

    constructor(type: Type) {
        this.time = new Date();
        this.type = type;
    }

    // Each subclass should implement this
    abstract describe(): string;

    // Optionally, implement combining logic
    combineWith(other: Update): Update | undefined {
        return; // Default: not combinable
    }
}

export class CardMovedUpdate extends Update {
    cards: BaseCard[];
    fromZone: Zone;
    toZone: Zone;
    position: Point;
    threshold = 500;

    constructor(card: BaseCard, fromZone: Zone, toZone: Zone, position: Point = new Point(0,0)) {
        super(Type.cardMoved);
        this.cards =[card];
        this.fromZone = fromZone;
        this.toZone = toZone;
        this.position = position;
    }

    describe(): string {
        if (this.fromZone == this.toZone && this.fromZone) {
            if(this.toZone == Zone.battlefield) {
                return "${this.card.cardName} moved on the battlefield"
            }
            // We moved it within a zone, ideally we shouldn't be in this state.. but it could help prevent
            // someone from accidentally playing a card and having it in the log forever, even if they undo it
            // quickly
            return "";
        } 
        // A card being moved between the hand and library shouldn't be visible.
        if( this.toZone == Zone.library && this.fromZone == Zone.hand) {
            return "moved a card to their library"
        }
        if( this.toZone == Zone.library && this.fromZone == Zone.hand) {
            return "moved a card to their library"
        }
         "${this.card.cardName} moved to ${this.toZone} from ${this.fromZone}";
        //
        return "moved a card to ${this.toZone} from ${this.fromZone}"

    }

    // I don't really care about original starting position, but we do care about original zone I think?
    combineWith(other: Update): Update | undefined {
        if (other instanceof CardMovedUpdate) {
            // Don't combine if they're outside a time threshold. 
            if(Math.abs(other.time.getTime() - this.time.getTime()) > this.threshold) return;
            if(other.time > this.time) {
                other.fromZone = this.fromZone;
                return other;
            } else {
                this.fromZone = other.fromZone
                return this;
            }
        }
        return;
    }
}