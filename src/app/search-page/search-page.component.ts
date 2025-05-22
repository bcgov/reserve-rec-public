import { Component, inject } from '@angular/core';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
    selector: 'app-search-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './search-page.component.html',
    styleUrl: './search-page.component.scss'
})
export class SearchPageComponent {
  private searchService = inject(SearchService);
  searchBox = '';

  constructor(private router: Router) { }

  search(): void {
    const query = this.searchBox.trim();
    if (query) {
      this.router.navigate(['/results'], { queryParams: { search: query } });
    }
  }
}
