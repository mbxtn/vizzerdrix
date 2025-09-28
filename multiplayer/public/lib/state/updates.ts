// This is a class with client side updates.
// Foundation for a log and also generating events.

import { Player } from "./player";



export enum Type {
    cardMoved,
    cardCreated,
    cardRemoved,
    lifeChanged,
    lifeRemoved,
    gameReset
}

export class Update {
    type: Type
    time: Date

    constructor(type: Type) {
        this.time = new Date();
        this.type = type;
    }
}