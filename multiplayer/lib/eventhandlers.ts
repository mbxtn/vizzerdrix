import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData, StatusOr, Zone } from "../public/lib/state/socketinterface";
import { Game } from "../public/lib/state/game";
import { Player } from "../public/lib/state/player";
import { BaseCard } from "../public/lib/state/basecard";
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
                if(result.status == "success")
                {
                    // If we joined successfully set the room name so it's easy to remember in the future
                    socket.data.roomName = room;
                }
                onResult(result);
            });
            socket.on("rejoinGame", (id: string, room: string, onResult: (e : StatusOr<Game>) => void) => {
                let result = this.rejoinGame(id, socket.id, room);
                if(result.status == "success")
                {
                    // If we joined successfully set the room name so it's easy to remember in the future
                    socket.data.roomName = room;
                }
                onResult(result);
            });
            socket.on("updateState", (player: Player) => {
                this.updateState(socket.data.roomName, player);
            });
            socket.on('updateCard', (card : BaseCard[], zone: Zone) => {

            });
            socket.on('cardCreated', (card: BaseCard) => {

            });
            socket.on('cardRemoved', (card: BaseCard) => {

            });
            socket.on('updateLifeTotal', (amount: number) => {

            })

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
            return {status: 'error', message: "Client already exists"};
        } else {
            return {status: 'success', value: game};
        }
    }

    rejoinGame(identifier: string, newId: string, roomName: string): StatusOr<Game> {
        let game = this.games.get(roomName);
        if (!game) {
            return {status: "error", message: "Game not found"};
        }
        let player = game.getPlayer(identifier);
        if (!player) {
            return {status: "error", message: "Player not found"};
        }
        player.isActive = true;
        player.id = newId;
        return {status: "success", value: game};
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

    // Pretty harsh reset, doesn't track changes.. since creating a readable delta of the object woudln't exactly make sense
    updateState(room: string, player: Player) {
        let game = this.games.get(room);
        if(!game) {
            console.log("updateState: Couldn't find room");
            return;
        }

        let serverPlayer = game.getPlayer(player.id);
        if(!serverPlayer) {
            console.log("updateState: room doesn't have client");
            return;
        }
        
        Object.assign(serverPlayer, player);
    }

}


