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

  // Scrolled to the bottom, the trailing sections can never reach the 15% line,
  // so the "On this page" list used to stay stuck on an earlier section.
  it('highlights the last section once the page is scrolled to the bottom', () => {
    const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { value: 1e6, configurable: true });

    const last = document.createElement('div');
    last.id = 'last-section';
    last.className = 'scroll-anchor';
    document.body.appendChild(last);

    component.ngAfterViewInit();

    expect(component.activeSection).toBe('last-section');

    component.ngOnDestroy();
    last.remove();
    if (scrollY) Object.defineProperty(window, 'scrollY', scrollY);
  });

  // The API answers a missing facility with 200 and a null body. The constructor
  // used to dereference it unguarded, which threw and left Angular rendering an
  // entirely blank page instead of anything the user could act on.
  it('does not throw when the resolver supplies no facility', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FacilityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } },
        {
          provide: ActivatedRoute,
          useValue: { root: { children: [] }, snapshot: { data: { facility: null } } }
        }
      ]
    }).overrideComponent(FacilityDetailsComponent, {
      remove: { imports: [SearchMapComponent] },
      add: { imports: [MockSearchMapComponent] }
    });

    const nullFixture = TestBed.createComponent(FacilityDetailsComponent);

    expect(nullFixture.componentInstance.facilityLoadFailed).toBeTrue();
    expect(nullFixture.componentInstance.facility).toBeNull();
    expect(nullFixture.componentInstance.geozone).toBeNull();
    expect(nullFixture.componentInstance.relatedActivities).toEqual([]);
  });

  it('renders an error state rather than an empty page', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FacilityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } },
        {
          provide: ActivatedRoute,
          useValue: { root: { children: [] }, snapshot: { data: { facility: null } } }
        }
      ]
    }).overrideComponent(FacilityDetailsComponent, {
      remove: { imports: [SearchMapComponent] },
      add: { imports: [MockSearchMapComponent] }
    });

    const nullFixture = TestBed.createComponent(FacilityDetailsComponent);
    nullFixture.detectChanges();
    const el: HTMLElement = nullFixture.nativeElement;

    expect(el.querySelector('[role="alert"]')?.textContent)
      .toContain('could not load this day-use area');
    // The booking form must not be offered for a facility that never loaded.
    expect(el.querySelector('form')).toBeNull();
  });
});
