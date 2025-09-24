import { Component } from '@angular/core';
import { CdkDragDrop, CdkDragEnd, CdkDragRelease, CdkDragStart, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { P } from '@angular/cdk/keycodes';

@Component({
  selector: 'app-card-demo',
  standalone: true,
  imports: [CommonModule, MatCardModule, DragDropModule],
  templateUrl: './card-demo.component.html',
  styleUrls: ['./card-demo.component.scss']
})
export class CardDemoComponent {
  cards = [
    {
      name: 'Gumdrop Poisoner',
      image: 'https://cards.scryfall.io/normal/front/5/c/5cb01d4d-91c2-41c6-981e-b4135a1e1e36.jpg?1692937659',
      tapped: false,
      dragging: false,
      zIndex: 1,
    },
    {
      name: 'Lightning Bolt',
      image: 'https://cards.scryfall.io/normal/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg?1628801721',
      tapped: false,
      dragging: false,
      zIndex: 2,
    },
    {
      name: 'Counterspell',
      image: 'https://cards.scryfall.io/normal/front/3/6/36f9d5b0-51a5-4faa-a879-b83871ae39cc.jpg?1757550235',
      tapped: false,
      dragging: false,
      zIndex: 3,
    }
  ];

  activeCardIndex: number | null = null;
  nextZIndex: number = 1;

  ngOnInit() {
    // Initialize zIndex for each card
    this.cards.forEach((card, i) => card.zIndex = i + 1);
    this.nextZIndex = this.cards.length + 1;
  }

  onCardClick(card: any, e: PointerEvent) {
    console.log("tapping");
    // nothing to do if the card is dragging
    if(card.dragging) {
      return;
    }
    
    card.zIndex = this.nextZIndex++;
    card.tapped = !card.tapped;
  }

  drag(card: any, e: CdkDragStart<any>, index: number) {
    console.log("drag start");
    card.dragging = true;
    card.zIndex = this.nextZIndex++;
    this.activeCardIndex = index;
  }

  drop(card: any, e: CdkDragEnd<any>) {
    console.log("drag end");
    setTimeout(() => {card.dragging = false;}, 10);
    //e.event.stopPropagation();
  }

  released(e: CdkDragRelease) {
    console.log("release");
    //e.event.stopPropagation();
  }
}
