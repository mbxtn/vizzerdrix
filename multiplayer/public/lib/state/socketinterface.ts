import { BaseCard } from "./basecard";
import { Game } from "./game";
import { Player } from "./player";

export interface ServerToClientEvents {
    joinGame: () => void;
    basicEmit: (a: number) => void;
    
}

export interface ClientToServerEvents {
    // For joining a game for the first time, will return the game with the player inserted if successful.
    joinGame: (id: string, name: string, roomName: string, commanders: string[], library: string[]) => Game;
    // For re-joining a game, will return the game with the player inserted if successful.
    // we'll check if it's a id or a player name and adjust our behavior.
    rejoinGame: (identifier: string, newId: string, roomName: string) => Game;

    // A somewhat forceful state updater. I don't think there's a great way to get a delta to describe whats
    // happening this way. So we couldn't use if for a log
    updateState: (player: Player) => void;  
    
    // update the card, and move it to the appropriate zone
    updateCard: (card : BaseCard, zone: Zone) => void;
    
    // for creating or removing temporary cards. These cards should always be in the battlefield
    cardCreated: (card: BaseCard) => void;
    cardRemoved: (card: BaseCard) => void;

    updateLifeTotal: (amount: number) => void;

    // Set turn order
    setTurnOrder: () => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    name: string;
    age: string;
}

export enum Zone { 
    battlefield,
    command,
    exile,
    graveyard
}