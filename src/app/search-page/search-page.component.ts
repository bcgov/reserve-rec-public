import { Component, inject, OnInit } from '@angular/core';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { NgdsFormsModule } from "@digitalspace/ngds-forms";

@Component({
    selector: 'app-search-page',
    imports: [CommonModule, FormsModule, NgdsFormsModule],
    templateUrl: './search-page.component.html',
    styleUrl: './search-page.component.scss'
})
export class SearchPageComponent implements OnInit {
  private searchService = inject(SearchService);
  searchBox = '';
  isAccordionOpen = false;

  public form;

  public options = [
    {
      value: 'Garibaldi ',
      display: 'Garibaldi Provincial Park'
    },
    {
      value: 'Golden Ears',
      display: 'Golden Ears Provincial Park'
    },
    {
      value: 'Joffre Lake',
      display: 'Joffre Lake Provincial Park'
    },
  ];

  constructor(
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.form = new UntypedFormGroup({
      search: new UntypedFormControl('')
    });
    this.form.valueChanges.subscribe((value) => {
      if (value) {
        this.search();
      }
    });
  }

  search(): void {
    const query = this.form.get('search')?.value;
    if (query) {
      this.router.navigate(['/results'], { queryParams: { search: query } });
    }
  }

  toggleAccordion(): void {
    this.isAccordionOpen = !this.isAccordionOpen;
  }
}
