import { beforeAll, afterAll, describe, it, expect } from "vitest"; import { EventHandler } from './gameserver';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData, StatusOr } from '../public/lib/state/socketinterface';
import { createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { Server, type Socket as ServerSocket } from "socket.io";
import { VdClient } from "../public/lib/state/socketclient";
import { Game } from "../public/lib/state/game";
import { Player } from "../public/lib/state/player";


describe('Client Server Tests', () => {
    let io: Server, serverSocket: ServerSocket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
    let eventHandler: EventHandler;
    let client: VdClient;
    beforeAll(() => {
        return new Promise<void>((resolve) => {
            const httpServer = createServer();
            io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer);
            eventHandler = new EventHandler(io);
            httpServer.listen(() => {
                const port = (httpServer.address() as AddressInfo).port;
                clientSocket = ioc(`http://localhost:${port}`);
                client = new VdClient(clientSocket);
                io.on("connection", (socket) => {
                    serverSocket = socket;
                });
                clientSocket.on("connect", resolve);
            });
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.disconnect();
    });

    it('should create a game', () => {
        eventHandler.games.clear();
        return new Promise<void>((resolve) => {
            client.joinGame("345", "456", ["vren"], ["swamp"]).then((game: Game) => {
                console.log(game);
                resolve();
            });
        }
        );
    });

    it('should rejoin a game', () => {
        eventHandler.games.clear();
        return new Promise<void>((resolve) => {
            client.joinGame("345", "456", ["vren"], ["swamp"]).then((game: Game) => {
                let gameServer = eventHandler.games.get("456");
                expect(gameServer).not.toBeNull();
                if (!gameServer) {
                    throw new Error("Shouldn't be here");
                }
                console.log(gameServer.players);
                if(!clientSocket.id) throw new Error("clientsocket.is is null");
                const playerObj = gameServer.players[clientSocket.id];
                if (!playerObj) {
                    throw new Error(`Player with socket id ${clientSocket.id} not found`);
                }
                gameServer.playerDisconnect(playerObj.id);
                client.rejoinGame(playerObj.id, "456").then((game: Game) => {
                    resolve();
                }, (reason) => {
                    console.log(reason);
                });
            });
        }
        );
    });

    it('should update a state', () => {
        eventHandler.games.clear();
        return new Promise<void>((resolve) => {
            client.addOnUpdateListener("test", (game) => {
                resolve()
                console.log("Inside my callback");
            });
            client.joinGame("345", "456", ["vren"], ["swamp"]).then((game: Game) => {
                client.addOnUpdateListener("test", (game) => {
                    console.log("Inside my callback");
                })
                let gameServer = eventHandler.games.get("456");
                expect(gameServer).not.toBeNull();
                if (!clientSocket.id) throw new Error("no clientsocket.id");
                let player = gameServer?.players[clientSocket.id];
                if(!player) {
                    throw new Error("this shouldn't happen");
                }
                let updatePlayer = new Player(player.id, "test", ["bobcat"], ["plains"]);
                client.updateState(updatePlayer);
                serverSocket.on("updateState", () => {
                    if (!clientSocket.id) throw new Error("no clientsocket.id");
                    expect(eventHandler.games.get("456")?.players[clientSocket.id].name).toEqual("test");
                });
            });
        }
        );
    });
});

