import { BaseCard } from "./basecard";
import { Game } from "./game";
import { Player } from "./player";

export interface ServerToClientEvents {
    joinGame: () => void;
    basicEmit: (a: number) => void;
    
}

export interface ClientToServerEvents {
    // For joining a game for the first time, will return the game with the player inserted if successful.
    joinGame: (name: string, roomName: string, commanders: string[], library: string[], onResult: (e: StatusOr<Game>) => void) => void;
    // For re-joining a game, will return the game with the player inserted if successful.
    // we'll check if it's a id or a player name and adjust our behavior.
    rejoinGame: (identifier: string, roomName: string, onResult: (e: StatusOr<Game>) => void) => void;

    // A somewhat forceful state updater. I don't think there's a great way to get a delta to describe whats
    // happening this way. So we couldn't use if for a log
    updateState: (player: Player) => void;  
    
    // update the card, and move it to the appropriate zone
    // We should be able to generally describe this as a written statement: e.g.
    // Player Tapped Sol Ring, Player added 3 counters to Vren, Player moved Ashcoat (to Zone)
    updateCard: (card : BaseCard[], zone: Zone) => void;
    
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
    roomName: string;
}

export enum Zone { 
    battlefield,
    command,
    exile,
    graveyard
}

export interface Success<T> {
    status: 'success';
    value: T;
}

export interface Failure {
    status: 'error';
    message: string;
    code?: number;
}

export type StatusOr<T> = Success<T> | Failure;
