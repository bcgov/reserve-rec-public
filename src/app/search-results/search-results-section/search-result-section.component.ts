import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-search-result-section',
  templateUrl: './search-result-section.component.html',
  styleUrls: ['./search-result-section.component.scss'],
  imports: []
})
export class SearchResultSectionComponent {
  @Input() id!: string;
  @Input() title!: string;
}
