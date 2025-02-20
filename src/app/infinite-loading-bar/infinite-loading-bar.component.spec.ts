import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfiniteLoadingBarComponent } from './infinite-loading-bar.component';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('InfiniteLoadingBarComponent', () => {
  let component: InfiniteLoadingBarComponent;
  let fixture: ComponentFixture<InfiniteLoadingBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfiniteLoadingBarComponent],
      providers: [ConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(InfiniteLoadingBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
