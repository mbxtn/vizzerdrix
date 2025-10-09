import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
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
      
      <div class="battlefield-container"
        (drop)="onNativeDrop($event)"
        (dragover)="onDragOver($event)"
        (dragenter)="onDragEnter($event)"
        (dragleave)="onDragLeave($event)">
        
        @for (card of cards; track card.id) {
          <app-card
            [card]="card"
            [isSelected]="isCardSelected(card.id)"
            [position]="{x: card.location.x, y: card.location.y}"
            (cardClick)="onCardClick($event)"
            (cardDoubleClick)="onCardDoubleClick($event)"
            (dragEnded)="onCardDragEnded($event)">
          </app-card>
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
      overflow: hidden; /* Prevent cards from escaping battlefield */
      transition: background-color 0.2s ease;
    }

    .battlefield-container.drag-over {
      background: rgba(79, 195, 247, 0.1);
      border: 2px dashed rgba(79, 195, 247, 0.5);
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

  onCardDragEnded(event: CdkDragEnd) {
    // Get the card from the event data
    const card = event.source.data as Card;
    if (!card || card.zone !== Zone.battlefield) {
      // Only handle position updates for cards on the battlefield
      return;
    }
    
    // Get the drop position relative to the battlefield container
    const battlefieldRect = this.battlefield.nativeElement.getBoundingClientRect();
    const dropPosition = event.dropPoint;
    
    // Calculate relative position within the battlefield
    const relativeX = dropPosition.x - battlefieldRect.left;
    const relativeY = dropPosition.y - battlefieldRect.top;
    
    // Update the card's position
    card.location.x = Math.max(0, relativeX - 31.5); // Center the card (63px / 2)
    card.location.y = Math.max(0, relativeY - 44);   // Center the card (88px / 2)
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // Allow drop
  }

  onDragEnter(event: DragEvent) {
    event.preventDefault();
    // Add visual feedback
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.add('drag-over');
    }
  }

  onDragLeave(event: DragEvent) {
    // Remove visual feedback
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('drag-over');
    }
  }

  onNativeDrop(event: DragEvent) {
    event.preventDefault();
    
    // Remove visual feedback
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.classList.remove('drag-over');
    }

    // Handle drop from other zones
    const cardData = event.dataTransfer?.getData('application/json');
    if (cardData) {
      try {
        const card = JSON.parse(cardData) as Card;
        if (card.zone !== Zone.battlefield) {
          // Calculate drop position
          const battlefieldRect = this.battlefield.nativeElement.getBoundingClientRect();
          const dropX = event.clientX - battlefieldRect.left - 31.5; // Center card
          const dropY = event.clientY - battlefieldRect.top - 44;    // Center card
          
          // Emit move event with position
          this.cardMoved.emit({
            card: { ...card, location: { x: Math.max(0, dropX), y: Math.max(0, dropY) } },
            fromZone: card.zone,
            toZone: Zone.battlefield
          });
        }
      } catch (e) {
        console.error('Failed to parse dropped card data:', e);
      }
    }
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