import { Update } from "./updates";
import { Zone } from "./socketinterface";

export class BaseCard {
    readonly cardName: string;
    readonly scryfallId: string;
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

    constructor(id: string, name: string, zone: Zone = Zone.library, isCommander = false) {
        this.cardName = name;
        this.id = id;
        this.scryfallId = "";
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