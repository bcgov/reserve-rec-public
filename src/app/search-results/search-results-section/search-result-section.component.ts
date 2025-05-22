import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-result-section',
  templateUrl: './search-result-section.component.html',
  styleUrls: ['./search-result-section.component.scss'],
  imports: [CommonModule]
})
export class SearchResultSectionComponent {
  @Input() id!: string;
  @Input() title!: string;
  @Input() navigation!: string;
  @Input() items: any[] = [];

  constructor(private router: Router) {}

  navigate(navigation: string): void {
    this.router.navigate([`${navigation}`]);
  }
}
