import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileOffcanvasComponent } from './profile-offcanvas.component';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';

describe('ProfileOffcanvasComponent', () => {
  let component: ProfileOffcanvasComponent;
  let fixture: ComponentFixture<ProfileOffcanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileOffcanvasComponent],
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => '',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileOffcanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
