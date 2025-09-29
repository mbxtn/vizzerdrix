import { Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents, StatusOr } from "./socketinterface";
import { Game } from "./game";
import { Player } from "./player";

export class VdClient {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    constructor(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
        this.socket = socket;
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

    updateState(player: Player) {
        this.socket.emit("updateState", player);
    }
}

