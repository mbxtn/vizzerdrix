import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { LocalGameService } from './services/local-game.service';
import { GameBoardComponent } from './components/game-board.component';
import { Game, Player, Card, Zone } from '@vizzerdrix/shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, CommonModule, JsonPipe, GameBoardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('web-client');
  
  public playerName = '';
  public roomName = 'local-test';
  public playerId = '';
  public connectionStatus = 'Local Mode';
  public gameState: Game | null = null;
  public currentPlayer: Player | null = null;
  public error: string | null = null;

  // Zone enum for template
  public Zone = Zone;

  constructor(private localGameService: LocalGameService) {}

  ngOnInit() {
    // Subscribe to local game state changes
    this.localGameService.game$.subscribe(game => {
      this.gameState = game;
    });
    
    this.localGameService.currentPlayer$.subscribe(player => {
      this.currentPlayer = player;
      if (player) {
        this.playerId = player.id;
      }
    });
  }

  ngOnDestroy() {
    // No cleanup needed for local service
  }

  public async joinGame() {
    if (!this.playerName) return;
    
    try {
      this.error = null;
      const game = this.localGameService.createLocalGame(this.playerName, this.roomName);
      console.log('Created local game:', game);
    } catch (error: any) {
      this.error = error.message || error;
    }
  }

  // Card interaction methods
  public getCardsInZone(zone: Zone): Card[] {
    return this.localGameService.getCardsInZone(zone);
  }

  public moveCard(cardId: string, fromZone: Zone, toZone: Zone): void {
    this.localGameService.moveCard(cardId, fromZone, toZone);
  }

  public drawCards(count: number = 1): void {
    this.localGameService.drawCards(count);
  }

  public shuffleLibrary(): void {
    this.localGameService.shuffleLibrary();
  }

  // Helper methods for template
  public getZoneName(zone: Zone): string {
    return Zone[zone];
  }

  public getHandSize(): number {
    return this.getCardsInZone(Zone.hand).length;
  }

  public getLibrarySize(): number {
    return this.getCardsInZone(Zone.library).length;
  }

  public getBattlefieldCards(): Card[] {
    return this.getCardsInZone(Zone.battlefield);
  }

  public getGraveyardCards(): Card[] {
    return this.getCardsInZone(Zone.graveyard);
  }

  // Game board event handlers
  public onCardClick(card: Card): void {
    console.log('Card clicked:', card.cardName);
  }

  public onCardDoubleClick(card: Card): void {
    console.log('Card double-clicked:', card.cardName);
    // Double-click usually means "play this card"
    if (card.zone === Zone.hand) {
      this.moveCard(card.id, Zone.hand, Zone.battlefield);
    }
  }

  public onCardMoved(event: {card: Card, fromZone: Zone, toZone: Zone}): void {
    console.log(`Moving ${event.card.cardName} from ${Zone[event.fromZone]} to ${Zone[event.toZone]}`);
    this.moveCard(event.card.id, event.fromZone, event.toZone);
  }

  public onCardTapped(card: Card): void {
    console.log(`${card.cardName} ${card.tapped ? 'tapped' : 'untapped'}`);
    // Card tapping is handled by the component, we just log it
  }

  public onCounterChanged(event: {card: Card, change: number}): void {
    console.log(`${event.card.cardName} now has ${event.card.counters} counters`);
    // Counter changes are handled by the component, we just log it
  }
}
