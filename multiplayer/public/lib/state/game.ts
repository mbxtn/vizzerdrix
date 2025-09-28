import { Player } from "./player"
// Representation of a game as the server knows it
export class Game {
    roomName: string;
    players: Map<string, Player> = new Map();
    
    // order of the players 
    turnOrder: string[] = [];
    // index in array of current turn
    currentTurn = 0;
    // Number of times we've gone around
    round = 0;

    constructor(name: string) {
        this.roomName = name;
    }

    addPlayer(name: string, id: string, commanders: string[], library: string[]) : Player | undefined {
        let existingPlayer : Player | undefined;
        this.players.forEach(player => {
            if(player.name == name) {
                existingPlayer = player;
            }
        });

        if(existingPlayer) {
            // Might be a rejoin...
            if(existingPlayer.isActive) {
                return undefined;
            } else {
                existingPlayer.isActive = true;
                return existingPlayer;
            }
        }
        let newPlayer = new Player(id, name, commanders, library);
        this.players.set(id, newPlayer);
        return newPlayer;
    }

    setTurnOrder() {
        this.currentTurn = 0;
        this.round = 0;

        this.turnOrder = [];
        const shuffledOrder = [...this.players];
            
        // Fisher-Yates shuffle
        for (let i = shuffledOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOrder[i], shuffledOrder[j]] = [shuffledOrder[j], shuffledOrder[i]];
        }

        shuffledOrder.forEach(player => {
            this.turnOrder.push(player[1].id)
        });
    }

    playerDisconnect(id: string) {
        let player = this.players.get(id);
        if(player) {
            player.isActive = false;
        }
    }

    advanceTurn() {
        this.currentTurn++;
        // update the round and go back to 0
        if(this.currentTurn > this.turnOrder.length - 1) {
            this.currentTurn = 0;
            this.round++;
        }
    }
}