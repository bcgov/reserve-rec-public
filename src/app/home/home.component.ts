import { Component } from '@angular/core';
import { AlphaPageComponent } from '../alpha-page/alpha-page.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [AlphaPageComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent { }
