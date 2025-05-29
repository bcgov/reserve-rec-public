import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-result-item',
  imports: [CommonModule],
  templateUrl: './search-result-item.component.html',
  styleUrl: './search-result-item.component.scss'
})
export class SearchResultItemComponent {

  @Input() id: string;
  @Input() title: string;
  @Input() navigation: string;

  constructor(
    private router: Router
  ) { }

  navigate(navigation: string): void {
    this.router.navigate([`${navigation}`]);
  }

}
