import { Component, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDropList, CdkDrag, DragDropModule, CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Card, Zone, Point } from '@vizzerdrix/shared';
import { CardComponent } from './card.component';

@Component({
  selector: 'app-battlefield-zone',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, CardComponent],
  template: `
    <div class="battlefield-zone" #battlefield>
      <div class="battlefield-header">
        <h3>Battlefield</h3>
        <label class="snap-toggle">
          <input type="checkbox" [(ngModel)]="snapToGrid" />
          Snap to Grid
        </label>
      </div>
      
      <div 
        class="battlefield-container"
        [class.grid]="snapToGrid"
        cdkDropList
        [cdkDropListData]="cards"
        [cdkDropListConnectedTo]="connectedLists"
        (cdkDropListDropped)="onDrop($event)">
        
        @for (card of cards; track card.id) {
          <div 
            class="battlefield-card"
            [style.left.px]="getCardPosition(card).x"
            [style.top.px]="getCardPosition(card).y"
            cdkDrag
            [cdkDragData]="card"
            [cdkDragFreeDragPosition]="getCardPosition(card)"
            (cdkDragEnded)="onCardMoved($event, card)">
            
            <app-card
              [card]="card"
              [isSelected]="isCardSelected(card.id)"
              (cardClick)="onCardClick($event)"
              (cardDoubleClick)="onCardDoubleClick($event)">
            </app-card>
            
            <div class="card-controls">
              <button class="tap-btn" (click)="toggleTap(card)" [class.tapped]="card.tapped">
                {{ card.tapped ? 'Untap' : 'Tap' }}
              </button>
              <div class="counter-controls">
                <button (click)="addCounter(card)">+</button>
                <span>{{ card.counters }}</span>
                <button (click)="removeCounter(card)">-</button>
              </div>
            </div>
          </div>
        }
        
        @if (cards.length === 0) {
          <div class="empty-battlefield">
            Battlefield is empty - drag cards here to play them
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .battlefield-zone {
      width: 100%;
      height: 100%;
      background: #2a5d31;
      border: 2px solid #4a7c59;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .battlefield-header {
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    
    .battlefield-header h3 {
      margin: 0;
      font-size: 14px;
    }
    
    .snap-toggle {
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .battlefield-container {
      position: relative;
      width: 100%;
      flex: 1;
      min-height: 0;
    }
    
    .battlefield-container.grid {
      background-image: 
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 75px 100px;
    }
    
    .battlefield-card {
      position: absolute;
      cursor: move;
    }
    
    .battlefield-card:hover .card-controls {
      opacity: 1;
    }
    
    .card-controls {
      position: absolute;
      top: -30px;
      left: 0;
      background: rgba(0, 0, 0, 0.9);
      padding: 4px;
      border-radius: 4px;
      opacity: 0;
      transition: opacity 0.2s;
      display: flex;
      gap: 4px;
      align-items: center;
      z-index: 20;
    }
    
    .tap-btn {
      background: #ff9800;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 10px;
      cursor: pointer;
    }
    
    .tap-btn.tapped {
      background: #666;
    }
    
    .counter-controls {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    
    .counter-controls button {
      background: #4fc3f7;
      color: white;
      border: none;
      width: 16px;
      height: 16px;
      border-radius: 2px;
      font-size: 10px;
      cursor: pointer;
    }
    
    .counter-controls span {
      color: white;
      font-size: 10px;
      min-width: 12px;
      text-align: center;
    }
    
    .empty-battlefield {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: rgba(255, 255, 255, 0.6);
      font-style: italic;
      text-align: center;
    }
    
    .cdk-drop-list.cdk-drop-list-receiving {
      background: rgba(79, 195, 247, 0.1);
    }
    
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `]
})
export class BattlefieldZoneComponent {
  @Input() cards: Card[] = [];
  @Input() selectedCards: string[] = [];
  @Input() connectedLists: string[] = [];
  
  @Output() cardClick = new EventEmitter<Card>();
  @Output() cardDoubleClick = new EventEmitter<Card>();
  @Output() cardMoved = new EventEmitter<{card: Card, fromZone: Zone, toZone: Zone}>();
  @Output() cardTapped = new EventEmitter<Card>();
  @Output() counterChanged = new EventEmitter<{card: Card, change: number}>();
  
  @ViewChild('battlefield', { static: true }) battlefield!: ElementRef;
  
  snapToGrid = false;
  gridSize = 75;
  
  getCardPosition(card: Card): { x: number; y: number } {
    if (card.location) {
      return { x: card.location.x, y: card.location.y };
    }
    // Return a random position for new cards
    return this.getRandomPosition();
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
      // Card moved from another zone to battlefield
      const card = event.previousContainer.data[event.previousIndex];
      this.cardMoved.emit({
        card: card,
        fromZone: card.zone,
        toZone: Zone.battlefield
      });
    }
  }

  onCardMoved(event: CdkDragEnd, card: Card) {
    let newPosition = event.source.getFreeDragPosition();

    if (this.snapToGrid) {
      newPosition = {
        x: Math.round(newPosition.x / this.gridSize) * this.gridSize,
        y: Math.round(newPosition.y / this.gridSize) * this.gridSize
      };
    }

    // Update card position using the Point class
    if (!card.location) {
      card.location = new Point(newPosition.x, newPosition.y);
    } else {
      card.location.x = newPosition.x;
      card.location.y = newPosition.y;
    }
  }  toggleTap(card: Card) {
    card.tapped = !card.tapped;
    this.cardTapped.emit(card);
  }
  
  addCounter(card: Card) {
    card.counters++;
    this.counterChanged.emit({ card, change: 1 });
  }
  
  removeCounter(card: Card) {
    if (card.counters > 0) {
      card.counters--;
      this.counterChanged.emit({ card, change: -1 });
    }
  }
  
  private getRandomPosition(): { x: number; y: number } {
    const containerRect = this.battlefield?.nativeElement?.getBoundingClientRect();
    if (!containerRect) {
      return { x: 100, y: 100 };
    }
    
    return {
      x: Math.random() * (containerRect.width - 100),
      y: Math.random() * (containerRect.height - 120)
    };
  }
}