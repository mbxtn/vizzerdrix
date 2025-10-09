import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Game, Player, Card, Zone, Point } from '@vizzerdrix/shared';

@Injectable({
  providedIn: 'root'
})
export class LocalGameService {
  private gameSubject = new BehaviorSubject<Game | null>(null);
  private currentPlayerSubject = new BehaviorSubject<Player | null>(null);

  public game$ = this.gameSubject.asObservable();
  public currentPlayer$ = this.currentPlayerSubject.asObservable();

  private mockPlayerId = 'local-player-1';

  constructor() {}

  createLocalGame(playerName: string, roomName: string = 'local-game'): Game {
    // Create a new game
    const game = new Game(roomName);
    
    // Add player to the game - this creates the Player object
    const player = game.addPlayer(playerName, this.mockPlayerId, [], []);
    
    if (!player) {
      throw new Error('Failed to create player');
    }
    
    // Add some sample cards to the player for testing
    this.addSampleCards(player);

    // Update subjects
    this.gameSubject.next(game);
    this.currentPlayerSubject.next(player);
    
    console.log('Created local game:', game);
    return game;
  }

  getCurrentGame(): Game | null {
    return this.gameSubject.value;
  }

  getCurrentPlayer(): Player | null {
    return this.currentPlayerSubject.value;
  }

  // Move a card between zones for the current player
  moveCard(cardId: string, fromZone: Zone, toZone: Zone): boolean {
    const game = this.getCurrentGame();
    const player = this.getCurrentPlayer();
    
    if (!game || !player) {
      console.error('No active game or player');
      return false;
    }

    // Get the card from the player's cards
    const card = player.getCard(cardId, fromZone);
    if (!card) {
      console.error(`Card ${cardId} not found in zone ${Zone[fromZone]}`);
      return false;
    }

    // Move the card to the new zone
    card.zone = toZone;
    
    // Initialize location for battlefield
    if (toZone === Zone.battlefield && !card.location) {
      card.location = new Point(
        Math.random() * 400 + 50, // Random x between 50-450
        Math.random() * 300 + 50  // Random y between 50-350
      );
    }

    // Update the game state
    this.gameSubject.next(game);
    this.currentPlayerSubject.next(player);
    
    console.log(`Moved card ${card.cardName} from ${Zone[fromZone]} to ${Zone[toZone]}`);
    return true;
  }

  // Add a card to a specific zone
  addCardToZone(card: Card, zoneName: Zone): boolean {
    const player = this.getCurrentPlayer();
    if (!player) {
      console.error('No active player');
      return false;
    }

    // Add card to player's cards and set its zone
    player.cards[card.id] = card;
    card.zone = zoneName;
    
    this.currentPlayerSubject.next(player);
    
    console.log(`Added card ${card.cardName} to ${Zone[zoneName]}`);
    return true;
  }

  // Get cards in a specific zone
  getCardsInZone(zone: Zone): Card[] {
    const player = this.getCurrentPlayer();
    if (!player) {
      return [];
    }
    return player.getZone(zone);
  }

  // Observable for cards in a specific zone - automatically updates when game state changes
  getCardsInZone$(zone: Zone): Observable<Card[]> {
    return this.currentPlayer$.pipe(
      map((player: Player | null) => {
        if (!player) return [];
        return player.getZone(zone);
      })
    );
  }

  // Handle CDK drop list events and convert to zone moves
  handleCardDrop(event: any, targetZone: Zone): boolean {
    const card = event.item.data as Card;
    const sourceZone = card.zone;
    
    if (sourceZone === targetZone) {
      // Same zone, no move needed
      return false;
    }
    
    return this.moveCard(card.id, sourceZone, targetZone);
  }

  // Get zone ID for CDK drop lists (maps Zone enum to string IDs)
  getZoneId(zone: Zone): string {
    const zoneMap: { [key in Zone]: string } = {
      [Zone.library]: 'library-zone',
      [Zone.hand]: 'hand-zone',
      [Zone.battlefield]: 'battlefield-zone',
      [Zone.graveyard]: 'graveyard-zone',
      [Zone.exile]: 'exile-zone',
      [Zone.command]: 'command-zone'
    };
    return zoneMap[zone];
  }

  // Get Zone enum from CDK drop list ID
  getZoneFromId(zoneId: string): Zone | null {
    const idMap: { [key: string]: Zone } = {
      'library-zone': Zone.library,
      'hand-zone': Zone.hand,
      'battlefield-zone': Zone.battlefield,
      'graveyard-zone': Zone.graveyard,
      'exile-zone': Zone.exile,
      'command-zone': Zone.command
    };
    return idMap[zoneId] || null;
  }

  // Create some sample cards for testing
  private addSampleCards(player: Player): void {
    const sampleCards = [
      this.createSampleCard('Lightning Bolt', Zone.hand),
      this.createSampleCard('Grizzly Bears', Zone.hand),
      this.createSampleCard('Forest', Zone.hand),
      this.createSampleCard('Mountain', Zone.hand),
      this.createSampleCard('Counterspell', Zone.hand),
      this.createSampleCard('Sol Ring', Zone.hand),
      this.createSampleCard('Serra Angel', Zone.hand)
    ];

    // Add cards to player's cards collection
    sampleCards.forEach(card => {
      player.cards[card.id] = card;
    });

    // Add some cards to library for testing
    const libraryCards = [
      this.createSampleCard('Plains', Zone.library),
      this.createSampleCard('Island', Zone.library),
      this.createSampleCard('Swamp', Zone.library),
      this.createSampleCard('Black Lotus', Zone.library),
      this.createSampleCard('Ancestral Recall', Zone.library)
    ];
    
    libraryCards.forEach(card => {
      player.cards[card.id] = card;
    });
  }

  private createSampleCard(name: string, zone: Zone): Card {
    const card = new Card(
      `card-${Math.random().toString(36).substr(2, 9)}`, // Random ID
      name,
      zone,
      false, // isCommander
      '', // scryfallId
      false // isTemporary
    );
    
    // Initialize location for battlefield cards
    if (zone === Zone.battlefield) {
      card.location = new Point(
        Math.random() * 400 + 50, // Random x between 50-450
        Math.random() * 300 + 50  // Random y between 50-350
      );
    }
    
    return card;
  }

  // Draw cards from library to hand
  drawCards(count: number = 1): Card[] {
    const player = this.getCurrentPlayer();
    if (!player) {
      console.error('No active player');
      return [];
    }

    const libraryCards = player.getZone(Zone.library);
    const drawnCards: Card[] = [];
    
    for (let i = 0; i < count && libraryCards.length > 0; i++) {
      // Remove from end of library (top of deck)
      const card = libraryCards.pop();
      if (card) {
        card.zone = Zone.hand;
        drawnCards.push(card);
      }
    }

    if (drawnCards.length > 0) {
      this.currentPlayerSubject.next(player);
      console.log(`Drew ${drawnCards.length} cards:`, drawnCards.map(c => c.cardName));
    }

    return drawnCards;
  }

  // Shuffle library
  shuffleLibrary(): void {
    const player = this.getCurrentPlayer();
    if (!player) {
      console.error('No active player');
      return;
    }

    const libraryCards = player.getZone(Zone.library);
    
    // Fisher-Yates shuffle
    for (let i = libraryCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [libraryCards[i], libraryCards[j]] = [libraryCards[j], libraryCards[i]];
    }

    this.currentPlayerSubject.next(player);
    console.log('Shuffled library');
  }
}