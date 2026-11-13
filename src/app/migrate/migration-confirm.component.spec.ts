import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { MigrationConfirmComponent } from './migration-confirm.component';

describe('MigrationConfirmComponent', () => {
  let fixture: ComponentFixture<MigrationConfirmComponent>;
  const apiService = jasmine.createSpyObj<ApiService>('ApiService', ['post']);
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['migrateLogout', 'loginWithProvider']);
  const migrateId = '4e707c5a-68f1-4728-b09e-2b5b691b86e6';
  const token = 'a'.repeat(43);
  let fragment: string;

  beforeEach(async () => {
    fragment = `migrateId=${migrateId}&token=${token}`;
    apiService.post.calls.reset();
    apiService.post.and.returnValue(of({
      data: { status: 'confirmed' },
      msg: 'Migration confirmed.',
    }));
    authService.migrateLogout.calls.reset();
    authService.migrateLogout.and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [MigrationConfirmComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { get fragment() { return fragment; } } },
        },
      ],
    }).compileComponents();
  });

  it('confirms the emailed token and signs the user out', async () => {
    fixture = TestBed.createComponent(MigrationConfirmComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiService.post).toHaveBeenCalledWith('migrate/confirm', { migrateId, token });
    expect(authService.migrateLogout).toHaveBeenCalled();
    expect(fixture.componentInstance.confirmed).toBe(true);
    expect(fixture.componentInstance.status).toBe('confirmed');
    expect(fixture.componentInstance.message).toBe('Migration confirmed.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.login-choice-button')).not.toBeNull();
  });

  it('does not call the API with an invalid link', () => {
    fragment = `migrateId=invalid&token=${token}`;
    fixture = TestBed.createComponent(MigrationConfirmComponent);
    fixture.detectChanges();

    expect(apiService.post).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorMessage).toContain('invalid');
  });

  it('shows an API error without signing the user out', async () => {
    apiService.post.and.returnValue(throwError(() => ({ error: { msg: 'This link has expired.' } })));
    fixture = TestBed.createComponent(MigrationConfirmComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.confirmed).toBe(false);
    expect(fixture.componentInstance.errorMessage).toBe('This link has expired.');
    expect(authService.migrateLogout).not.toHaveBeenCalled();
  });

  it('does not offer BCSC sign-in after the migration is already complete', async () => {
    apiService.post.and.returnValue(of({ data: { status: 'completed' }, msg: 'Migration already completed.' }));
    fixture = TestBed.createComponent(MigrationConfirmComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.status).toBe('completed');
    expect(fixture.nativeElement.querySelector('.login-choice-button')).toBeNull();
  });
});
