import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
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
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Title } from '@angular/platform-browser';
import { ServerTimeService } from '../services/server-time.service';

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
              queryParamMap: convertToParamMap({}),
              data: {
                facility: {
                  displayName: 'Joffre Lakes Park',
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

  it('sets the browser title to the facility name', () => {
    expect(TestBed.inject(Title).getTitle()).toBe('Joffre Lakes Park | BC Parks');
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

  describe('reservation window', () => {
    const date = '2026-09-27';

    function selectDateWithWindow(open: number, close: number) {
      component.availableDates = {
        [date]: {
          reservationContext: { minDailyInventory: 1, maxDailyInventory: 4, temporalWindows: { reservationWindow: { open, close } } },
          inventoryPool: { isOpen: true, available: 10 }
        }
      };
      component.form.get('selectedDate').setValue(date, { emitEvent: false });
      return (component as any).loadPassesAvailable(date);
    }

    afterEach(() => fixture.destroy());

    it('gates on server time when the device clock runs fast', async () => {
      const open = Date.now() - 60 * 1000;
      TestBed.inject(ServerTimeService).record({ serverTime: open - 60 * 1000 });

      await selectDateWithWindow(open, open + 86400000);

      expect(component.passesAvailable).toBeFalse();
      expect(component.passStatus).toBe('not-open-yet');
    });

    it('shows the opening time in park time', async () => {
      const open = Date.now() + 3600000;

      await selectDateWithWindow(open, open + 86400000);

      expect(component.reservationOpensAt?.zoneName).toBe('America/Vancouver');
      expect(component.reservationOpensAt?.toMillis()).toBe(open);
    });

    it('offers passes inside the window', async () => {
      await selectDateWithWindow(Date.now() - 1000, Date.now() + 86400000);

      expect(component.passesAvailable).toBeTrue();
      expect(component.passStatus).toBe('available');
      expect(component.reservationOpensAt).toBeNull();
    });

    it('opens a page left waiting when the window opens', fakeAsync(() => {
      const open = Date.now() + 5 * 60 * 1000;
      selectDateWithWindow(open, open + 86400000);
      flushMicrotasks();
      expect(component.passStatus).toBe('not-open-yet');

      tick(5 * 60 * 1000 - 1000);
      flushMicrotasks();
      expect(component.passStatus).toBe('not-open-yet');

      tick(2000);
      flushMicrotasks();
      expect(component.passStatus).toBe('available');
      expect(component.passesAvailable).toBeTrue();
    }));
  });
});
