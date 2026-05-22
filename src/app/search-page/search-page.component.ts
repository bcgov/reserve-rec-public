import { AfterViewChecked, ChangeDetectorRef, Component, inject, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { NgdsFormsModule } from "@digitalspace/ngds-forms";

@Component({
    selector: 'app-search-page',
    imports: [CommonModule, FormsModule, NgdsFormsModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    templateUrl: './search-page.component.html',
    styleUrl: './search-page.component.scss'
})
export class SearchPageComponent implements OnInit, AfterViewChecked {
  private searchService = inject(SearchService);
  searchBox = '';
  isAccordionOpen = false;

  public form;

  public options = [
    { value: null, display: 'Garibaldi Provincial Park', disabled: true },
    { value: '/facility/bcparks_7/structure/1', display: 'Cheakamus' },
    { value: '/facility/bcparks_7/structure/2', display: 'Diamond Head' },
    { value: '/facility/bcparks_7/structure/3', display: 'Rubble Creek' },
    { value: null, display: 'Golden Ears Provincial Park', disabled: true },
    { value: '/facility/bcparks_8/structure/1', display: 'Alouette Lake Boat Launch' },
    { value: '/facility/bcparks_8/structure/2', display: 'Alouette Lake South Beach Day-Use Area' },
    { value: '/facility/bcparks_8/structure/3', display: 'Gold Creek' },
    { value: '/facility/bcparks_8/structure/4', display: 'West Canyon Trailhead' },
    { value: null, display: 'Mount Seymour Park', disabled: true },
    { value: '/facility/bcparks_15/structure/1', display: 'Daily Additional P1 and Lower P5' },
    { value: '/facility/bcparks_15/structure/2', display: 'P1 and Lower P5' },
    { value: null, display: 'Joffre Lakes Provincial Park', disabled: true },
    { value: '/facility/bcparks_363/structure/1', display: 'Joffre Lakes' },
  ];

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.form = new UntypedFormGroup({
      facilitySelect: new UntypedFormControl('')
    });
    this.form.valueChanges.subscribe((value) => {
      if (value) {
        this.redirect();
      }
    });
  }

  ngAfterViewChecked(): void {
    this.cdr.detectChanges();
  }

  redirect(): void {
    const facility = this.form.get('facilitySelect')?.value;
    if (facility) {
      this.router.navigate([facility]);
    }
  }

  toggleAccordion(): void {
    this.isAccordionOpen = !this.isAccordionOpen;
  }
}
