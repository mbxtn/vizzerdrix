import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData, StatusOr, Zone, Game, Player } from "@vizzerdrix/shared";
import { Server } from "socket.io";


export class EventHandler {
    readonly io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
    games: Map<string, Game> = new Map();

    constructor(server: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
        this.io = server;
        this.games = new Map();
        this.io.on("connection", socket => {
            socket.on("joinGame", (name: string, room: string, commanders: string[], library: string[], onResult: (e: StatusOr<Game>) => void) => {
                let result = this.joinGame(socket.id, name, room, commanders, library);
                if (result.status == "success") {
                    // If we joined successfully set the room name so it's easy to remember in the future
                    socket.data.roomName = room;
                    socket.join(room);
                    this.emitState(room);
                }
                onResult(result);
            });
            socket.on("rejoinGame", (id: string, room: string, onResult: (e: StatusOr<Game>) => void) => {
                let result = this.rejoinGame(id, socket.id, room);
                if (result.status == "success") {
                    // If we joined successfully set the room name so it's easy to remember in the future
                    socket.data.roomName = room;
                    socket.join(room);
                    this.emitState(room);
                }
                onResult(result);
            });
            socket.on("updateState", (player: Player) => {
                // This is sort of a hard update. For the moment we don't try and bother deducing the differences.
                // This is used for player initialization and game resets, or shuffling. It won't be reflected in the public game 
                // logs in any way.
                this.updateState(socket.data.roomName, player);
                this.emitState(socket.data.roomName);
            });
        })
    }

    joinGame(id: string, name: string, room: string, commanders: string[], library: string[]): StatusOr<Game> {
        console.log(this.games);
        let game = this.games.get(room);
        if (!game) {
            game = new Game(room);
            this.games.set(room, game);
        }
        let player = game.addPlayer(name, id, commanders, library);
        if (!player) {
            return { status: 'error', message: "Client already exists" };
        } else {
            return { status: 'success', value: game };
        }
    }

    emitState(room: string) {
        let game = this.games.get(room);
        if (game) {
           this.io.to(room).emit("StateUpdate", game);
        }
    }

    rejoinGame(identifier: string, newId: string, roomName: string): StatusOr<Game> {
        let game = this.games.get(roomName);
        if (!game) {
            return { status: "error", message: "Game not found" };
        }
        let player = game.players[identifier];
        if (!player) {
            return { status: "error", message: "Player not found" };
        }

        // Really Basic Logic just set the player to active and update the id and hand them the game.
        // Also delete the old identifier.
        player.isActive = true;
        player.id = newId;
        game.players[newId] = player;
        delete game.players[identifier];
        return { status: "success", value: game };
    }

    playerLeft(id: string, room: string) {
        let game = this.games.get(room);
        if (!game) {
            return;
        }
        let player = game.getPlayer(id);
        if (!player) {
            return;
        }
        player.isActive = false;
    }

    // updates a players state
    updateState(room: string, player: Player) {
        let game = this.games.get(room);
        if (!game) {
            console.log("updateState: Couldn't find room");
            return;
        }

        let serverPlayer = game.getPlayer(player.id);
        if (!serverPlayer) {
            console.log("updateState: room doesn't have client");
            return;
        }

        Object.assign(serverPlayer, player);
    }
}


