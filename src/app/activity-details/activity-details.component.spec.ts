import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivityDetailsComponent } from './activity-details.component';
import { provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ActivityDetailsComponent', () => {
  let component: ActivityDetailsComponent;
  let fixture: ComponentFixture<ActivityDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'activity/:orcs/:activityType/:identifier', component: ActivityDetailsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ActivityDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
