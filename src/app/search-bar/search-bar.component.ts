import { Component, inject } from '@angular/core';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
    selector: 'app-search-bar',
    imports: [CommonModule, FormsModule],
    templateUrl: './search-bar.component.html',
    styleUrl: './search-bar.component.scss'
})
export class SearchBarComponent {
  private searchService = inject(SearchService);
  searchBox = '';

  constructor(private router: Router) { }

  search(): void {
    console.log("Searching for: ", this.searchBox);
    // Get search results and put into data service
    if (this.searchBox !== '') {
      this.searchService.getFacilities(this.searchBox);
    }

    // Then navigate to search page
    this.router.navigate(['/search']);
  }
}
