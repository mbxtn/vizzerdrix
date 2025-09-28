import { ServerToClientEvents, ClientToServerEvents } from "../public/lib/state/socketinterface";
import { Game } from "../public/lib/state/game";
import { Player } from "../public/lib/state/player";
import { BaseCard } from "../public/lib/state/basecard";

export class EventHandler {
    games: Map<string, Game> = new Map();

    constructor() {
    }

    joinGameHandler(id: string, name: string, room: string, commanders: string[], library: string[]) : Game {
        let game = this.games.get(room)
        if(!game) {
            game = new Game(room);
            this.games.set(room, game);
        }
        game.addPlayer(name, id, commanders, library);
        return game;
    }

    rejoinGame(identifier: string, newId: string, roomName: string): Game | undefined {
        let game = this.games.get(identifier);
        if (!game) {
            return;
        }
        let player: Player | undefined;
        game.players.forEach(p => {
            if(p.name === identifier) {
                player = p;
            }
        });
        if(!player) {
            return
        } else {
            
        }
    }

    playerLeft(id: string, room: string) {
        let game = this.games.get(room);
        if(!game) {
            return;
        }
        let player = game.players.get(id);
        if(!player) {
            return;
        }
        player.isActive = false;
    }

}
