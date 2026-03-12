import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';

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
      value: '7',
      display: 'Garibaldi Provincial Park'
    },
    {
      value: '8',
      display: 'Golden Ears Provincial Park'
    },
    {
      value: '363',
      display: 'Joffre Lake Provincial Park'
    },
  ];

  constructor(
    private router: Router,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.form = new UntypedFormGroup({
      search: new UntypedFormControl('')
    });
    this.form.valueChanges.subscribe(() => {
      this.cd.detectChanges();
    });
  }

  search(): void {
    const query = this.searchBox.trim();
    if (query) {
      this.router.navigate(['/results'], { queryParams: { search: query } });
    }
  }

  toggleAccordion(): void {
    this.isAccordionOpen = !this.isAccordionOpen;
  }
}
