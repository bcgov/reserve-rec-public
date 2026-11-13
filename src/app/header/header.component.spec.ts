import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { LoggerService } from '../services/logger.service';
import { ConfigService } from '../services/config.service';
import { SearchService } from '../services/search.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { provideToastr } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { of, throwError } from 'rxjs';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  const apiService = jasmine.createSpyObj<ApiService>('ApiService', ['post']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HeaderComponent
      ],
      providers: [
        LoggerService,
        ConfigService,
        SearchService,
        provideHttpClient(),
        provideToastr(),
        provideHttpClientTesting(),
        { provide: ApiService, useValue: apiService },
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
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    apiService.post.calls.reset();
    apiService.post.and.returnValue(of({}));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should label the account button with the user name for screen readers', () => {
    spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.returnValue({ given_name: 'Jane', family_name: 'Doe' });
    fixture.detectChanges();
    const button: HTMLElement = fixture.nativeElement.querySelector('#accountDropdown');
    expect(button.getAttribute('aria-label')).toBe('Account menu for Jane Doe');
    expect(button.querySelector('.account-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sends a confirmation email for a pending migration', async () => {
    spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.returnValue({
      'custom:migrationPending': 'true',
      'custom:migrationId': '4e707c5a-68f1-4728-b09e-2b5b691b86e6',
      email: 'parks@example.test',
    });

    await component.requestMigrationConfirmation();

    expect(apiService.post).toHaveBeenCalledWith(
      'migrate/4e707c5a-68f1-4728-b09e-2b5b691b86e6/email',
      {},
    );
    expect(component.migrationEmailSent).toBe(true);
  });

  it('shows a request error and allows the user to retry', async () => {
    spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.returnValue({
      'custom:migrationPending': 'true',
      'custom:migrationId': '4e707c5a-68f1-4728-b09e-2b5b691b86e6',
      email: 'parks@example.test',
    });
    apiService.post.and.returnValue(throwError(() => ({ error: { msg: 'Email delivery failed.' } })));

    await component.requestMigrationConfirmation();

    expect(component.migrationEmailError).toBe('Email delivery failed.');
    expect(component.migrationEmailSending).toBe(false);
    expect(component.migrationEmailSent).toBe(false);

    apiService.post.and.returnValue(of({}));
    await component.requestMigrationConfirmation();

    expect(component.migrationEmailError).toBe('');
    expect(component.migrationEmailSent).toBe(true);
  });

  it('rejects an invalid migration ID without calling the API', async () => {
    spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.returnValue({
      'custom:migrationPending': 'true',
      'custom:migrationId': 'invalid',
    });

    await component.requestMigrationConfirmation();

    expect(apiService.post).not.toHaveBeenCalled();
    expect(component.migrationEmailError).toContain('valid migration request');
  });

  describe('cart link', () => {
    const cartLinks = () => fixture.nativeElement.querySelectorAll('a[href="/cart"]') as NodeListOf<HTMLAnchorElement>;
    let count: number;

    beforeEach(() => {
      spyOnProperty(component, 'user').and.returnValue({ given_name: 'A', family_name: 'B' });
      spyOnProperty(component, 'cartItemCount').and.callFake(() => count);
    });

    it('is labelled "Cart" when the cart is empty', () => {
      count = 0;
      fixture.detectChanges();
      expect(cartLinks().length).toBe(2);
      cartLinks().forEach(a => expect(a.getAttribute('aria-label')).toBe('Cart'));
    });

    it('includes the item count in the label', () => {
      count = 1;
      fixture.detectChanges();
      cartLinks().forEach(a => expect(a.getAttribute('aria-label')).toBe('Cart, 1 item'));
      count = 3;
      fixture.detectChanges();
      cartLinks().forEach(a => expect(a.getAttribute('aria-label')).toBe('Cart, 3 items'));
    });

    it('hides the decorative icon from screen readers', () => {
      count = 0;
      fixture.detectChanges();
      cartLinks().forEach(a => expect(a.querySelector('i')?.getAttribute('aria-hidden')).toBe('true'));
    });
  });
});
