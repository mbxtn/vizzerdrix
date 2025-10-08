import { Socket, io } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents, StatusOr, Game, Player, Card } from "@vizzerdrix/shared";

// Factory function to create a VdClient with socket connection
export function createVdClient(serverUrl?: string): VdClient {
    // Default to same origin if no server URL provided (for production)
    const url = serverUrl || window.location.origin;
    const socket = io(url) as Socket<ServerToClientEvents, ClientToServerEvents>;
    return new VdClient(socket);
}

export class VdClient {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    listeners: Map<string, (gameState : Game) => void> = new Map();

    constructor(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
        this.socket = socket;

        this.socket.on("StateUpdate", (game: Game) => {
            // Recursively restore prototypes for the entire object graph
            const restoredGame = restorePrototypes(game) as Game;
            this.listeners.forEach(
                (fn: (gameState : Game) => void) => {
                    fn(restoredGame);
                }
            )
        });
    }

    joinGame(name: string, roomName: string, commanders: string[], library: string[]): Promise<Game> {
        return new Promise<Game>((resolve, reject) => {
            this.socket.emit("joinGame", name, roomName, commanders, library,
                (e: StatusOr<Game>) => {
                    if (e.status == 'success') {
                        const restoredGame = restorePrototypes(e.value) as Game;
                        resolve(restoredGame);
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
                        const restoredGame = restorePrototypes(e.value) as Game;
                        resolve(restoredGame);
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

// Helper function to recursively restore prototypes for deserialized objects
function restorePrototypes(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => restorePrototypes(item));
    }

    // Restore prototypes based on object structure/properties
    if (obj.players && obj.turnOrder && obj.currentTurn !== undefined) {
        // This looks like a Game object
        Object.setPrototypeOf(obj, Game.prototype);
        
        // Restore prototypes for players
        if (obj.players) {
            Object.keys(obj.players).forEach(playerId => {
                const player = obj.players[playerId];
                Object.setPrototypeOf(player, Player.prototype);
                
                // Restore prototypes for cards in each zone
                ['hand', 'library', 'graveyard', 'exile', 'command', 'battlefield'].forEach(zoneName => {
                    if (player[zoneName] && Array.isArray(player[zoneName])) {
                        player[zoneName].forEach((card: any) => {
                            Object.setPrototypeOf(card, Card.prototype);
                        });
                    }
                });
            });
        }
        
        // Restore prototypes for turnOrder players
        if (obj.turnOrder && Array.isArray(obj.turnOrder)) {
            obj.turnOrder.forEach((player: any) => {
                Object.setPrototypeOf(player, Player.prototype);
            });
        }
    } else if (obj.name && obj.zones) {
        // This looks like a Player object
        Object.setPrototypeOf(obj, Player.prototype);
        
        // Restore prototypes for cards in zones
        Object.keys(obj.zones || {}).forEach(zoneName => {
            if (obj.zones[zoneName] && Array.isArray(obj.zones[zoneName])) {
                obj.zones[zoneName].forEach((card: any) => {
                    Object.setPrototypeOf(card, Card.prototype);
                });
            }
        });
    } else if (obj.id && obj.cardName) {
        // This looks like a Card object
        Object.setPrototypeOf(obj, Card.prototype);
    }

    return obj;
}
