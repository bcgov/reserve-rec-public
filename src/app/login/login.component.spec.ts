import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginComponent } from './login.component';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [ConfigService, provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // #628: Cognito's own errors named the user pool client in the sign-in alert.
  // Every wrapped handler must replace the raw error with a generic message.
  describe('auth errors are not surfaced verbatim', () => {
    const RAW = 'User pool client 1a0cfcigjl0c1esdeihuqnl9vu does not exist.';

    const handlers: (keyof LoginComponent['services'])[] = [
      'handleSignIn',
      'handleSignUp',
      'handleConfirmSignUp',
      'handleForgotPassword',
      'handleForgotPasswordSubmit',
    ];

    handlers.forEach(name => {
      it(`${name} replaces the underlying error`, async () => {
        spyOn(console, 'error');
        // Force the wrapped call to fail the way Cognito would.
        spyOn<any>(component, 'withGenericError').and.callThrough();
        const thrown = await (component.services[name] as any)({})
          .then(() => null, (e: Error) => e);

        expect(thrown).toBeTruthy();
        expect(thrown.message).not.toContain('User pool client');
        expect(thrown.message).not.toContain('1a0cfcigjl0c1esdeihuqnl9vu');
        expect(thrown.message.length).toBeGreaterThan(0);
      });
    });

    it('logs the original error for debugging', async () => {
      const spy = spyOn(console, 'error');
      await (component.services.handleSignIn as any)({}).catch(() => undefined);

      expect(spy).toHaveBeenCalled();
      expect(spy.calls.mostRecent().args[0]).toBe('Auth error:');
    });

    it('does not leak the raw message when Cognito names the pool client', async () => {
      spyOn(console, 'error');
      const failing = () => Promise.reject(new Error(RAW));
      const thrown = await (component as any)
        .withGenericError(failing, 'Generic message.')
        .then(() => null, (e: Error) => e);

      expect(thrown.message).toBe('Generic message.');
    });
  });
  // #685: Amplify's built-in sign-up fields default to isRequired, which makes
  // the browser block submit before handleSignUp runs, so no error can render.
  describe('sign-up password errors are reachable', () => {
    it('clears the native required flag on every built-in sign-up field', () => {
      expect(component.formFields.signUp.email.isRequired).toBeFalse();
      expect(component.formFields.signUp.password.isRequired).toBeFalse();
      expect(component.formFields.signUp.confirm_password.isRequired).toBeFalse();
    });

    it('reports a blank password instead of failing silently', async () => {
      spyOn(console, 'error');
      const thrown = await (component.services.handleSignUp as any)({
        username: 'someone@example.com',
        password: '',
      }).then(() => null, (e: Error) => e);

      expect(component.passwordError).toBe('Password is required');
      expect(thrown.message).toContain('Password');
    });

    // Amplify strips confirm_password from the sign-up input, so this is the
    // only hook that can see it. Without it, clearing isRequired would let an
    // account through on a single typed password.
    describe('validateCustomSignUp', () => {
      const validate = (password: string, confirm: string) =>
        (component.services as any).validateCustomSignUp({
          password,
          confirm_password: confirm,
        });

      it('rejects a blank confirmation', async () => {
        expect(await validate('Passw0rd!', '')).toEqual({
          confirm_password: 'Please confirm your password.',
        });
      });

      it('rejects a mismatch', async () => {
        expect(await validate('Passw0rd!', 'Passw0rd?')).toEqual({
          confirm_password: 'Passwords do not match.',
        });
      });

      it('accepts a matching pair', async () => {
        expect(await validate('Passw0rd!', 'Passw0rd!')).toBeNull();
      });
    });
  });
});
