import { Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents, StatusOr } from "./socketinterface";
import { Game } from "./game";
import { Player } from "./player";

export class VdClient {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    listeners: Map<string, (gameState : Game) => void> = new Map();

    constructor(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
        this.socket = socket;

        this.socket.on("StateUpdate", (game: Game) => {
            this.listeners.forEach(
                (fn: (gameState : Game) => void) => {
                    fn(game);
                }
            )
        });
    }

    joinGame(name: string, roomName: string, commanders: string[], library: string[]): Promise<Game> {
        return new Promise<Game>((resolve, reject) => {
            this.socket.emit("joinGame", name, roomName, commanders, library,
                (e: StatusOr<Game>) => {
                    if (e.status == 'success') {
                        resolve(e.value);
                    } else {
                        reject(e.message);
                    }
                }
            )
        });
    }

    rejoinGame(identifier: string, roomName: string): Promise<Game> {
        return new Promise<Game>((resolve, reject) => {
            this.socket.emit("rejoinGame", identifier, roomName,
                (e: StatusOr<Game>) => {
                    if (e.status == 'success') {
                        resolve(e.value);
                    } else {
                        reject(e.message);
                    }
                }
            )
        }
        );
    }

    getId() {
        return this.socket.id?? "";
    }

    updateState(player: Player) {
        this.socket.emit("updateState", player);
    }

    // Add a subscriber to gamestate changes. 
    addOnUpdateListener(name: string, fn : (gameState : Game) => void) {
        this.listeners.set(name, fn);
    }

    remmoveOnUpdateListener(name: string) { 
        this.listeners.delete(name);
    }
}

