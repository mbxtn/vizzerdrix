import { Component } from '@angular/core';
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';

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
      image: 'https://cards.scryfall.io/normal/front/5/c/5cb01d4d-91c2-41c6-981e-b4135a1e1e36.jpg?1692937659'
    },
    {
      name: 'Lightning Bolt',
      image: 'https://cards.scryfall.io/normal/front/c/e/ce711943-c1a1-43a0-8b89-8d169cfb8e06.jpg?1628801721'
    },
    {
      name: 'Counterspell',
      image: 'https://cards.scryfall.io/normal/front/3/6/36f9d5b0-51a5-4faa-a879-b83871ae39cc.jpg?1757550235'
    }
  ];

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.cards, event.previousIndex, event.currentIndex);
  }
}
