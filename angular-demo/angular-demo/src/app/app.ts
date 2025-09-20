import { Component, signal } from '@angular/core';
import { CardDemoComponent } from './card-demo/card-demo.component';

@Component({
  selector: 'app-root',
  imports: [CardDemoComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('angular-demo');
}
