import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card, Zone, Player, Game } from '@vizzerdrix/shared';
import { HandZoneComponent } from './hand-zone.component';
import { BattlefieldZoneComponent } from './battlefield-zone.component';
import { SimpleZoneComponent } from './simple-zone.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [
    CommonModule,
    HandZoneComponent,
    BattlefieldZoneComponent,
    SimpleZoneComponent
  ],
  template: `
    <div class="game-board">
      <!-- Player info header -->
      <div class="player-info">
        <h3>{{ currentPlayer?.name || 'Player' }}</h3>
        <div class="life-total">Life: {{ currentPlayer?.lifeTotal || 40 }}</div>
      </div>
      
      <!-- Main battlefield area -->
      <div class="battlefield-area">
        <app-battlefield-zone
          [cards]="getCardsInZone(Zone.battlefield)"
          [selectedCards]="selectedCards"
          [connectedLists]="allZoneIds"
          (cardClick)="onCardClick($event)"
          (cardDoubleClick)="onCardDoubleClick($event)"
          (cardMoved)="onCardMoved($event)"
          (cardTapped)="onCardTapped($event)"
          (counterChanged)="onCounterChanged($event)">
        </app-battlefield-zone>
      </div>
      
      <!-- Bottom zones bar: Library, Command, Hand, Graveyard, Exile -->
      <div class="bottom-zones">
        <app-simple-zone
          [zone]="Zone.library"
          zoneName="Library"
          [cards]="getCardsInZone(Zone.library)"
          [selectedCards]="selectedCards"
          [connectedLists]="allZoneIds"
          (cardClick)="onCardClick($event)"
          (cardDoubleClick)="onCardDoubleClick($event)"
          (cardMoved)="onCardMoved($event)"
          (shuffleLibrary)="onShuffleLibrary()"
          (drawCard)="onDrawCard()">
        </app-simple-zone>
        
        <app-simple-zone
          [zone]="Zone.command"
          zoneName="Command"
          [cards]="getCardsInZone(Zone.command)"
          [selectedCards]="selectedCards"
          [connectedLists]="allZoneIds"
          [alwaysExpanded]="true"
          (cardClick)="onCardClick($event)"
          (cardDoubleClick)="onCardDoubleClick($event)"
          (cardMoved)="onCardMoved($event)">
        </app-simple-zone>
        
        <app-hand-zone
          [cards]="getCardsInZone(Zone.hand)"
          [selectedCards]="selectedCards"
          [connectedLists]="allZoneIds"
          (cardClick)="onCardClick($event)"
          (cardDoubleClick)="onCardDoubleClick($event)"
          (cardMoved)="onCardMoved($event)"
          (drawCard)="onDrawCard()">
        </app-hand-zone>
        
        <app-simple-zone
          [zone]="Zone.graveyard"
          zoneName="Graveyard"
          [cards]="getCardsInZone(Zone.graveyard)"
          [selectedCards]="selectedCards"
          [connectedLists]="allZoneIds"
          (cardClick)="onCardClick($event)"
          (cardDoubleClick)="onCardDoubleClick($event)"
          (cardMoved)="onCardMoved($event)">
        </app-simple-zone>
        
        <app-simple-zone
          [zone]="Zone.exile"
          zoneName="Exile"
          [cards]="getCardsInZone(Zone.exile)"
          [selectedCards]="selectedCards"
          [connectedLists]="allZoneIds"
          (cardClick)="onCardClick($event)"
          (cardDoubleClick)="onCardDoubleClick($event)"
          (cardMoved)="onCardMoved($event)">
        </app-simple-zone>
      </div>
    </div>
  `,
  styles: [`
    .game-board {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%);
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .player-info {
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.8);
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 40px;
    }
    
    .player-info h3 {
      margin: 0;
      color: #4fc3f7;
      font-size: 16px;
    }
    
    .life-total {
      font-size: 18px;
      font-weight: bold;
      color: #4caf50;
    }
    
    .battlefield-area {
      flex: 1;
      min-height: 0; /* Important for flex children */
      padding: 8px;
      display: flex;
      flex-direction: column;
    }
    
    .battlefield-area app-battlefield-zone {
      flex: 1;
      min-height: 0;
    }
    
    .bottom-zones {
      display: flex;
      background: rgba(0, 0, 0, 0.9);
      border-top: 2px solid #444;
      min-height: 140px;
      max-height: 200px;
    }
    
    .bottom-zones app-simple-zone {
      min-width: 100px;
      max-width: 150px;
      flex-shrink: 0;
    }
    
    .bottom-zones app-hand-zone {
      flex: 1;
      min-width: 300px;
    }
  `]
})
export class GameBoardComponent {
  @Input() currentPlayer: Player | null = null;
  @Input() game: Game | null = null;
  
  @Output() cardClick = new EventEmitter<Card>();
  @Output() cardDoubleClick = new EventEmitter<Card>();
  @Output() cardMoved = new EventEmitter<{card: Card, fromZone: Zone, toZone: Zone}>();
  @Output() cardTapped = new EventEmitter<Card>();
  @Output() counterChanged = new EventEmitter<{card: Card, change: number}>();
  @Output() shuffleLibrary = new EventEmitter<void>();
  @Output() drawCard = new EventEmitter<void>();
  
  selectedCards: string[] = [];
  Zone = Zone;
  
  // All zone IDs for drag and drop connections
  allZoneIds = ['hand', 'battlefield', 'library', 'graveyard', 'exile', 'command'];
  
  getCardsInZone(zone: Zone): Card[] {
    if (!this.currentPlayer) return [];
    return this.currentPlayer.getZone(zone);
  }
  
  onCardClick(card: Card) {
    // Toggle card selection
    const index = this.selectedCards.indexOf(card.id);
    if (index > -1) {
      this.selectedCards.splice(index, 1);
    } else {
      this.selectedCards.push(card.id);
    }
    this.cardClick.emit(card);
  }
  
  onCardDoubleClick(card: Card) {
    // Double click to play card to battlefield
    if (card.zone === Zone.hand) {
      this.onCardMoved({
        card,
        fromZone: Zone.hand,
        toZone: Zone.battlefield
      });
    }
    this.cardDoubleClick.emit(card);
  }
  
  onCardMoved(event: {card: Card, fromZone: Zone, toZone: Zone}) {
    this.cardMoved.emit(event);
  }
  
  onCardTapped(card: Card) {
    this.cardTapped.emit(card);
  }
  
  onCounterChanged(event: {card: Card, change: number}) {
    this.counterChanged.emit(event);
  }
  
  onShuffleLibrary() {
    this.shuffleLibrary.emit();
  }
  
  onDrawCard() {
    this.drawCard.emit();
  }
}