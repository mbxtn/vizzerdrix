import { Injectable } from '@angular/core';
import { createVdClient, VdClient } from '../../lib/socketclient';
import { Game } from '@vizzerdrix/shared';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private client: VdClient;

  constructor() {
    // Create client connection - will connect to same origin in production
    this.client = createVdClient();
  }

  getClient(): VdClient {
    return this.client;
  }

  async joinGame(playerName: string, roomName: string, commanders: string[] = [], library: string[] = []): Promise<Game> {
    return this.client.joinGame(playerName, roomName, commanders, library);
  }

  async rejoinGame(playerId: string, roomName: string): Promise<Game> {
    return this.client.rejoinGame(playerId, roomName);
  }

  addGameStateListener(name: string, callback: (game: Game) => void): void {
    this.client.addOnUpdateListener(name, callback);
  }

  removeGameStateListener(name: string): void {
    this.client.remmoveOnUpdateListener(name);
  }

  getPlayerId(): string {
    return this.client.getId();
  }
}