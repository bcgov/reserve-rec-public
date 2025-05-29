import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-result-section',
  templateUrl: './search-result-section.component.html',
  styleUrls: ['./search-result-section.component.scss'],
  imports: [CommonModule]
})
export class SearchResultSectionComponent {
  @Input() id!: string;
  @Input() title!: string;
}
