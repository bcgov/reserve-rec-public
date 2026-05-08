import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Signal } from '@angular/core';

import { FacilityDetailsComponent } from './facility-details.component';
import { SearchMapComponent } from '../search-map/search-map.component';

@Component({
  selector: 'app-search-map',
  template: '',
  standalone: true
})
class MockSearchMapComponent {
  @Input() _dataSignal: Signal<any[]>;
  @Input() displayGeozones = false;
}
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { BsModalService } from 'ngx-bootstrap/modal';

describe('FacilityDetailsComponent', () => {
  let component: FacilityDetailsComponent;
  let fixture: ComponentFixture<FacilityDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacilityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'facility/:orcs/:facilityType/:identifier', component: FacilityDetailsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {
              children: []
            },
            snapshot: {
              data: {
                facility: {
                  geozones: [],
                  isOpen: true,
                  activities: []
                }
              }
            }
          }
        }
      ]
    })
      .overrideComponent(FacilityDetailsComponent, {
        remove: { imports: [SearchMapComponent] },
        add: { imports: [MockSearchMapComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(FacilityDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
