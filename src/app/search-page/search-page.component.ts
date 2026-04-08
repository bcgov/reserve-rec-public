import { AfterViewChecked, ChangeDetectorRef, Component, inject, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
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
    {
      value: '/facility/bcparks_7/accessPoint/1',
      display: 'Garibaldi Provincial Park - Rubble Creek'
    },
    {
      value: '/facility/bcparks_7/accessPoint/2',
      display: 'Garibaldi Provincial Park - Cheakamus'
    },
    {
      value: '/facility/bcparks_7/accessPoint/3',
      display: 'Garibaldi Provincial Park - Diamond Head'
    },
    {
      value: '/facility/bcparks_8/accessPoint/1',
      display: 'Golden Ears Provincial Park - Alouette Lake Boat Launch'
    },
    {
      value: '/facility/bcparks_8/accessPoint/2',
      display: 'Golden Ears Provincial Park - Alouette Lake South Beach Day-Use Area'
    },
    {
      value: '/facility/bcparks_8/accessPoint/3',
      display: 'Golden Ears Provincial Park - West Canyon Trailhead'
    },
    {
      value: '/facility/bcparks_8/accessPoint/4',
      display: 'Golden Ears Provincial Park - Gold Creek'
    },
    {
      value: '/facility/bcparks_363/accessPoint/1',
      display: 'Joffre Lakes Provincial Park - Joffre Lakes'
    },
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
