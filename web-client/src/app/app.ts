import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { GameService } from './services/game.service';
import { Game } from '@vizzerdrix/shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, CommonModule, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('web-client');
  
  public playerName = '';
  public roomName = '';
  public playerId = '';
  public connectionStatus = 'Connecting...';
  public gameState: Game | null = null;
  public error: string | null = null;

  constructor(private gameService: GameService) {}

  ngOnInit() {
    // Set up connection status monitoring
    const client = this.gameService.getClient();
    
    client.socket.on('connect', () => {
      this.connectionStatus = 'Connected';
      this.playerId = this.gameService.getPlayerId();
    });
    
    client.socket.on('disconnect', () => {
      this.connectionStatus = 'Disconnected';
    });
    
    client.socket.on('connect_error', (error: any) => {
      this.connectionStatus = 'Connection Error';
      this.error = error.message;
    });
    
    // Listen for game state updates
    this.gameService.addGameStateListener('app', (game: Game) => {
      this.gameState = game;
      this.error = null;
    });
  }

  ngOnDestroy() {
    this.gameService.removeGameStateListener('app');
  }

  public async joinGame() {
    if (!this.playerName || !this.roomName) return;
    
    try {
      this.error = null;
      const game = await this.gameService.joinGame(this.playerName, this.roomName);
      this.gameState = game;
    } catch (error: any) {
      this.error = error;
    }
  }
}
