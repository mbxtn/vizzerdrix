import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, CdkDrag, DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Card, Zone } from '@vizzerdrix/shared';
import { CardComponent } from './card.component';

@Component({
  selector: 'app-hand-zone',
  standalone: true,
  imports: [CommonModule, DragDropModule, CardComponent],
  template: `
    <div class="hand-zone">
      <div class="hand-header">
        <h3>Hand ({{ cards.length }})</h3>
        <button class="draw-btn" (click)="drawCard.emit()">Draw Card</button>
      </div>
      
      <div 
        class="hand-container"
        cdkDropList
        id="hand-zone"
        [cdkDropListData]="cards"
        [cdkDropListConnectedTo]="connectedLists"
        (cdkDropListDropped)="onDrop($event)">
        
        @for (card of cards; track card.id) {
          <div class="hand-card-wrapper">
            <app-card
              [card]="card"
              [isSelected]="isCardSelected(card.id)"
              (cardClick)="onCardClick($event)"
              (cardDoubleClick)="onCardDoubleClick($event)">
            </app-card>
          </div>
        }
        
        @if (cards.length === 0) {
          <div class="empty-hand">
            Hand is empty
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .hand-zone {
      display: flex;
      flex-direction: column;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid #444;
      border-radius: 4px;
      margin: 4px;
      flex: 1;
    }
    
    .hand-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.8);
      border-bottom: 1px solid #444;
    }
    
    .hand-header h3 {
      color: white;
      margin: 0;
      font-size: 12px;
    }
    
    .draw-btn {
      background: #4fc3f7;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
    }
    
    .draw-btn:hover {
      background: #29b6f6;
    }
    
    .hand-container {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 8px;
      flex: 1;
      align-items: flex-start;
    }
    
    .hand-card-wrapper {
      flex-shrink: 0;
    }
    
    .empty-hand {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      color: #666;
      font-style: italic;
      font-size: 12px;
    }
    
    .cdk-drop-list {
      min-height: 96px;
      width: 100%;
    }
    
    .cdk-drop-list.cdk-drop-list-receiving {
      background: rgba(79, 195, 247, 0.1);
      border: 2px dashed #4fc3f7;
      border-radius: 8px;
    }
  `]
})
export class HandZoneComponent {
  @Input() cards: Card[] = [];
  @Input() selectedCards: string[] = [];
  @Input() connectedLists: string[] = [];
  
  @Output() cardClick = new EventEmitter<Card>();
  @Output() cardDoubleClick = new EventEmitter<Card>();
  @Output() cardMoved = new EventEmitter<{card: Card, fromZone: Zone, toZone: Zone}>();
  @Output() drawCard = new EventEmitter<void>();
  
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
      // Card moved from another zone to hand
      const card = event.previousContainer.data[event.previousIndex];
      this.cardMoved.emit({
        card: card,
        fromZone: card.zone,
        toZone: Zone.hand
      });
    }
    // For reordering within hand, we don't need to do anything special
    // The visual reordering is handled by CDK automatically
  }
}