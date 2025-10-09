import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Card, Zone } from '@vizzerdrix/shared';
import { CardComponent } from './card.component';

@Component({
  selector: 'app-simple-zone',
  standalone: true,
  imports: [CommonModule, DragDropModule, CardComponent],
  template: `
    <div class="simple-zone" [class]="zoneClass">
      <div class="zone-header" (click)="toggleExpanded()">
        <h4>{{ zoneName }} ({{ cards.length }})</h4>
        <span class="expand-icon" [class.expanded]="isExpanded">▼</span>
      </div>
      
      <div 
        class="zone-container"
        [class.expanded]="isExpanded"
        cdkDropList
        [id]="zoneId"
        [cdkDropListData]="cards"
        [cdkDropListConnectedTo]="connectedLists"
        (cdkDropListDropped)="onDrop($event)">
        
        @if (isExpanded || alwaysExpanded) {
          @for (card of visibleCards; track card.id) {
            <div class="zone-card">
              <app-card
                [card]="card"
                [isSelected]="isCardSelected(card.id)"
                [showZoneInfo]="false"
                (cardClick)="onCardClick($event)"
                (cardDoubleClick)="onCardDoubleClick($event)">
              </app-card>
            </div>
          }
        } @else {
          @if (cards.length > 0) {
            <div class="card-stack">
              <app-card
                [card]="cards[cards.length - 1]"
                [showZoneInfo]="true">
              </app-card>
              @if (cards.length > 1) {
                <div class="stack-count">{{ cards.length }}</div>
              }
            </div>
          }
        }
        
        @if (cards.length === 0) {
          <div class="empty-zone">
            {{ zoneName }} is empty
          </div>
        }
      </div>
      
      @if (zone === Zone.library) {
        <div class="zone-actions">
          <button (click)="shuffleLibrary.emit()" class="action-btn">Shuffle</button>
          <button (click)="drawCard.emit()" class="action-btn">Draw</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .simple-zone {
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid #444;
      border-radius: 4px;
      margin: 4px;
      display: flex;
      flex-direction: column;
      min-width: 80px;
    }
    
    .simple-zone.library {
      background: rgba(139, 69, 19, 0.7);
      border-color: #8B4513;
    }
    
    .simple-zone.graveyard {
      background: rgba(64, 64, 64, 0.7);
      border-color: #404040;
    }
    
    .simple-zone.exile {
      background: rgba(128, 0, 128, 0.7);
      border-color: #800080;
    }
    
    .simple-zone.command {
      background: rgba(255, 215, 0, 0.7);
      border-color: #FFD700;
    }
    
    .zone-header {
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
      min-height: 20px;
    }
    
    .zone-header h4 {
      margin: 0;
      font-size: 10px;
      text-align: center;
      flex: 1;
    }
    
    .expand-icon {
      transition: transform 0.2s;
      font-size: 8px;
      margin-left: 4px;
    }
    
    .expand-icon.expanded {
      transform: rotate(180deg);
    }
    
    .zone-container {
      padding: 4px;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .zone-container.expanded {
      max-height: 120px;
      overflow-y: auto;
    }
    
    .zone-card {
      margin: 1px;
      display: block;
    }
    
    .card-stack {
      position: relative;
      display: block;
      margin: 4px auto;
    }
    
    .stack-count {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #ff4444;
      color: white;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: bold;
      border: 2px solid white;
    }
    
    .empty-zone {
      padding: 10px 4px;
      text-align: center;
      color: #666;
      font-style: italic;
      font-size: 10px;
    }
    
    .zone-actions {
      padding: 4px;
      border-top: 1px solid #444;
      display: flex;
      gap: 2px;
    }
    
    .action-btn {
      background: #4fc3f7;
      color: white;
      border: none;
      padding: 3px 6px;
      border-radius: 2px;
      font-size: 9px;
      cursor: pointer;
      flex: 1;
    }
    
    .action-btn:hover {
      background: #29b6f6;
    }
    
    .cdk-drop-list.cdk-drop-list-receiving {
      background: rgba(79, 195, 247, 0.2);
      border: 2px dashed #4fc3f7;
    }
  `]
})
export class SimpleZoneComponent {
  @Input() zone!: Zone;
  @Input() zoneName!: string;
  @Input() zoneId!: string;
  @Input() cards: Card[] = [];
  @Input() selectedCards: string[] = [];
  @Input() connectedLists: string[] = [];
  @Input() alwaysExpanded = false;
  
  @Output() cardClick = new EventEmitter<Card>();
  @Output() cardDoubleClick = new EventEmitter<Card>();
  @Output() cardMoved = new EventEmitter<{card: Card, fromZone: Zone, toZone: Zone}>();
  @Output() shuffleLibrary = new EventEmitter<void>();
  @Output() drawCard = new EventEmitter<void>();
  
  isExpanded = false;
  Zone = Zone;
  
  get zoneClass(): string {
    return Zone[this.zone].toLowerCase();
  }
  
  get visibleCards(): Card[] {
    // For library, show most recent first (top of deck)
    if (this.zone === Zone.library) {
      return [...this.cards].reverse();
    }
    return this.cards;
  }
  
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }
  
  onCardClick(card: Card) {
    this.cardClick.emit(card);
  }
  
  onCardDoubleClick(card: Card) {
    this.cardDoubleClick.emit(card);
  }
  
  isCardSelected(cardId: string): boolean {
    return this.selectedCards.includes(cardId);
  }
  
  onDrop(event: CdkDragDrop<Card[]>) {
    if (event.previousContainer !== event.container) {
      // Card moved from another zone to this zone
      const card = event.previousContainer.data[event.previousIndex];
      this.cardMoved.emit({
        card: card,
        fromZone: card.zone,
        toZone: this.zone
      });
    }
  }
}