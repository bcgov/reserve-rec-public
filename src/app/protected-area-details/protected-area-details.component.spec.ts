import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProtectedAreaDetailsComponent } from './protected-area-details.component';
import { ConfigService } from '../services/config.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ProtectedAreaDetailsComponent', () => {
  let component: ProtectedAreaDetailsComponent;
  let fixture: ComponentFixture<ProtectedAreaDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProtectedAreaDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'protected-area/:orcs/', component: ProtectedAreaDetailsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProtectedAreaDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
