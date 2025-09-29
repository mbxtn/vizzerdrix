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
    card: BaseCard;
    fromZone: Zone;
    toZone: Zone;
    position: Point;

    constructor(card: BaseCard, fromZone: Zone, toZone: Zone, position: Point = new Point(0,0)) {
        super(Type.cardMoved);
        this.card = card;
        this.fromZone = fromZone;
        this.toZone = toZone;
        this.position = position
    }

    describe(): string {
        return "Card"
    }

    // We should basically just take the newer update always.
    combineWith(other: Update): Update | undefined {
        if (other instanceof CardMovedUpdate && other.card.id == this.card.id)
        return;
    }
}