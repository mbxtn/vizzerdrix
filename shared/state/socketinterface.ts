import { Card } from "./card";
import { Game } from "./game";
import { Player } from "./player";

export interface ServerToClientEvents {
    // This essentially holds the entire game state. We could very likely be more performant by doing
    // just doing some delta of this instead. but I think the amount of data we're sending is generally small
    // enough.
    StateUpdate: (game: Game) => void;   
}

export interface ClientToServerEvents {
    // For joining a game for the first time, will return the game with the player inserted if successful.
    joinGame: (name: string, roomName: string, commanders: string[], library: string[], onResult: (e: StatusOr<Game>) => void) => void;
    rejoinGame: (identifier: string, roomName: string, onResult: (e: StatusOr<Game>) => void) => void;

    updateState: (player: Player) => void;
    // Set turn order
    setTurnOrder: () => void;

    // Allow players to check if they can rejoin an old room.
    canRejoin: (identifier: string, roomName: string, onResult: (e: boolean) => void) => void;
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
    graveyard,
    hand,
    library
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
