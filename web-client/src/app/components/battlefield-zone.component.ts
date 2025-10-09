import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDropList, CdkDrag, DragDropModule, CdkDragDrop, CdkDragEnd, moveItemInArray } from '@angular/cdk/drag-drop';
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
      </div>
      
      <div class="battlefield-container">
        
        @for (card of cards; track card.id) {
          <div 
            class="battlefield-card">
            
            <app-card
              [card]="card"
              [isSelected]="isCardSelected(card.id)"
              [dragBoundary]="'.battlefield-container'"
              [freeDragPosition]="{x: card.location.x, y: card.location.y}"
              (cardClick)="onCardClick($event)"
              (cardDoubleClick)="onCardDoubleClick($event)"
              (dragEnded)="onCardDragEnded($event, card)">
            </app-card>
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
    
    .battlefield-container {
      position: relative;
      width: 100%;
      flex: 1;
      min-height: 0;
      padding: 10px;
    }
    
    .battlefield-card {
      width: 63px;
      height: 88px;
      position: relative;
      display: inline-block;
    }
    
    .battlefield-card.cdk-drag-disabled {
      cursor: default;
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
export class BattlefieldZoneComponent implements OnChanges {
  @Input() cards: Card[] = [];
  @Input() selectedCards: string[] = [];
  @Input() connectedLists: string[] = [];
  
  @Output() cardClick = new EventEmitter<Card>();
  @Output() cardDoubleClick = new EventEmitter<Card>();
  @Output() cardMoved = new EventEmitter<{card: Card, fromZone: Zone, toZone: Zone}>();
  
  @ViewChild('battlefield', { static: true }) battlefield!: ElementRef;
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['cards'] && this.cards) {
      // Initialize positions for new cards that don't have them
      this.cards.forEach(card => {
        if (card.location.x === 0 && card.location.y === 0) {
          const newPosition = this.getRandomPosition();
          card.location.x = newPosition.x;
          card.location.y = newPosition.y;
        }
      });
    }
  }
  
  onCardClick(card: Card) {
    this.cardClick.emit(card);
  }

  onCardDoubleClick(card: Card) {
    this.cardDoubleClick.emit(card);
  }

  onCardDragEnded(event: CdkDragEnd, card: Card) {
    // Update the card's position based on the drag end position
    const transform = event.source.getFreeDragPosition();
    card.location.x = transform.x;
    card.location.y = transform.y;
  }

  isCardSelected(cardId: string): boolean {
    return this.selectedCards.includes(cardId);
  }
  
  private getRandomPosition(): { x: number; y: number } {
    const containerRect = this.battlefield?.nativeElement?.getBoundingClientRect();
    if (!containerRect) {
      return { x: 100, y: 100 };
    }
    
    const cardWidth = 63;
    const cardHeight = 88;
    const padding = 20;
    
    // Ensure cards don't go outside the container bounds
    const maxX = containerRect.width - cardWidth - padding;
    const maxY = containerRect.height - cardHeight - padding;
    
    return {
      x: Math.max(padding, Math.random() * maxX),
      y: Math.max(padding, Math.random() * maxY)
    };
  }
}