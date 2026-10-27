import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterComponent } from './footer.component';
import { LoggerService } from '../services/logger.service';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [LoggerService, ConfigService, provideHttpClient(), provideHttpClientTesting()]
    })
      .compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts its headings at h2 and does not skip levels', () => {
    const headings = [...fixture.nativeElement.querySelectorAll('h1, h2, h3, h4, h5, h6')] as HTMLElement[];
    expect(headings.map(h => `${h.tagName} ${h.textContent?.trim()}`)).toEqual([
      'H2 Land acknowledgement',
      'H3 Day-use pass',
      'H3 Stay connected'
    ]);
  });
});
