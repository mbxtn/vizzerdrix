import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { Card, Zone } from '@vizzerdrix/shared';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  template: `
    <div 
      class="card"
      [class.tapped]="card.tapped"
      [class.selected]="isSelected"
      [style.transform]="'rotate(' + (card.tapped ? '90deg' : '0deg') + ')'"
      cdkDrag
      [cdkDragData]="card"
      (click)="onCardClick()"
      (dblclick)="onCardDoubleClick()">
      
      <div class="card-image" [style.background-image]="getCardImage()">
        <div class="card-name">{{ card.cardName }}</div>
        
        @if (card.counters > 0) {
          <div class="counters">{{ card.counters }}</div>
        }
        
        @if (showZoneInfo) {
          <div class="zone-info">{{ getZoneName() }}</div>
        }
      </div>
      
      <div *cdkDragPlaceholder class="card-placeholder"></div>
    </div>
  `,
  styles: [`
    .card {
      width: 63px;
      height: 88px;
      border-radius: 6px;
      border: 2px solid #333;
      background: #1a1a1a;
      cursor: pointer;
      transition: transform 0.2s ease;
      position: relative;
      user-select: none;
    }
    
    .card:hover {
      transform: scale(1.05) !important;
      z-index: 10;
    }
    
    .card.selected {
      border-color: #4fc3f7;
      box-shadow: 0 0 8px rgba(79, 195, 247, 0.6);
    }
    
    .card.tapped {
      opacity: 0.7;
    }
    
    .card-image {
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      background-color: #333;
      border-radius: 4px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4px;
    }
    
    .card-name {
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-size: 8px;
      padding: 2px;
      border-radius: 2px;
      text-align: center;
      line-height: 1.2;
      word-wrap: break-word;
      max-height: 20px;
      overflow: hidden;
    }
    
    .counters {
      position: absolute;
      top: 2px;
      right: 2px;
      background: #ff4444;
      color: white;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
    }
    
    .zone-info {
      background: rgba(0, 100, 0, 0.8);
      color: white;
      font-size: 6px;
      padding: 1px 2px;
      border-radius: 2px;
      position: absolute;
      bottom: 2px;
      right: 2px;
    }
    
    .card-placeholder {
      width: 63px;
      height: 88px;
      border: 2px dashed #666;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    
    .cdk-drop-list-dragging .card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `]
})
export class CardComponent {
  @Input() card!: Card;
  @Input() isSelected = false;
  @Input() showZoneInfo = false;
  
  @Output() cardClick = new EventEmitter<Card>();
  @Output() cardDoubleClick = new EventEmitter<Card>();
  
  Zone = Zone;
  
  onCardClick() {
    this.cardClick.emit(this.card);
  }
  
  onCardDoubleClick() {
    this.cardDoubleClick.emit(this.card);
  }
  
  getCardImage(): string {
    // For now, return a placeholder. Later we can fetch actual card images
    return 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'63\' height=\'88\' viewBox=\'0 0 63 88\'><rect width=\'63\' height=\'88\' fill=\'%23444\'/></svg>")';
  }
  
  getZoneName(): string {
    return Zone[this.card.zone];
  }
}