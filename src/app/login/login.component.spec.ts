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
  // #685: the browser's own constraint check refused the submit and only moved
  // focus to the first bad field, so handleSignUp never ran and no message was
  // ever shown. The form has to report its own errors.
  describe('sign-up field errors are reachable', () => {
    it('turns off native validation on the sign-up form', () => {
      const form = document.createElement('form');
      const host: HTMLElement = fixture.nativeElement;
      spyOn(host, 'querySelector').and.returnValue(form as any);

      component.ngAfterViewChecked();

      expect(form.noValidate).toBeTrue();
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

    // The only hook that can put a message on Amplify's own email, password and
    // confirm password fields; anything it names is rendered under that field.
    describe('validateCustomSignUp', () => {
      const validate = (formData: Record<string, string>, touched: Record<string, boolean> = {}) =>
        (component.services as any).validateCustomSignUp(formData, touched);

      const filled = {
        email: 'someone@example.com',
        password: 'Passw0rd!',
        confirm_password: 'Passw0rd!',
      };

      it('stays quiet until the first submit', async () => {
        expect(await validate({ email: '', password: '', confirm_password: '' })).toBeNull();
      });

      describe('once Create Account has been pressed', () => {
        beforeEach(() => {
          fixture.nativeElement.dispatchEvent(new Event('submit', { bubbles: true }));
        });

        it('names the email field when it is blank', async () => {
          const errors = await validate({ ...filled, email: '' });

          expect(errors.email).toBe('Email is required');
          expect(component.summaryError).toContain('Email');
        });

        it('names the email field when the address is malformed', async () => {
          expect((await validate({ ...filled, email: 'notanemail' })).email)
            .toBe('Please enter a valid email address');
        });

        // Amplify's own password validator returns nothing for a field that has
        // never had focus, so a straight-to-submit blank password needs covering.
        it('names an untouched blank password', async () => {
          expect((await validate({ ...filled, password: '', confirm_password: '' })).password)
            .toBe('Password is required');
        });

        it('leaves a touched password to Amplify', async () => {
          const errors = await validate({ ...filled, password: '', confirm_password: '' }, { password: true });

          expect(errors.password).toBeUndefined();
        });

        it('rejects a blank confirmation', async () => {
          expect((await validate({ ...filled, confirm_password: '' })).confirm_password)
            .toBe('Please confirm your password.');
        });

        it('rejects a mismatch', async () => {
          expect((await validate({ ...filled, confirm_password: 'Passw0rd?' })).confirm_password)
            .toBe('Passwords do not match.');
        });

        it('accepts a complete set of credentials', async () => {
          expect(await validate(filled)).toBeNull();
        });
      });
    });
  });

  // #685: a duplicate account is only detectable at submit, and the generic
  // wrapper reduced it to an unactionable message at the foot of the form.
  describe('sign-up failures name the field to change', () => {
    const fail = (error: unknown) => {
      try {
        (component as any).failSignUp(error);
        return null;
      } catch (e) {
        return e as Error;
      }
    };

    beforeEach(() => spyOn(console, 'error'));

    it('puts an existing account on the email field', () => {
      const thrown = fail({ name: 'UsernameExistsException' });

      expect(component.emailError).toContain('already exists');
      expect(thrown?.message).toContain('already exists');
    });

    // Cognito only reports the clash at submit, so the message has to survive
    // the next validation pass to stay on the field the user has to change.
    it('keeps the message on the email field until the address changes', async () => {
      try {
        (component as any).failSignUp({ name: 'UsernameExistsException' }, 'taken@example.com');
      } catch { /* expected */ }
      fixture.nativeElement.dispatchEvent(new Event('submit', { bubbles: true }));

      const complete = {
        password: 'Passw0rd!', confirm_password: 'Passw0rd!',
        given_name: 'Test', family_name: 'User',
        'custom:streetAddress': '123 Main St', 'custom:city': 'Victoria',
        'custom:province': 'BC', 'custom:postalCode': 'V8W9V1',
        'custom:country': 'Canada', 'custom:mobilePhone': '+12505551234',
      };
      const validate = (email: string) =>
        (component.services as any).validateCustomSignUp({ ...complete, email }, {});

      expect((await validate('taken@example.com')).email).toContain('already exists');
      expect(await validate('someone.else@example.com')).toBeNull();
    });

    it('lists the email field in the summary', () => {
      fail({ name: 'UsernameExistsException' });

      expect(component.summaryError).toContain('Email');
    });

    it('keeps the generic message for an unmapped failure', () => {
      const thrown = fail({ name: 'InternalErrorException' });

      expect(thrown?.message).toBe(
        'We could not create your account. Please check your details and try again.'
      );
      expect(component.emailError).toBe('');
    });

    it('matches on name, not the SDK v2 code field', () => {
      const thrown = fail({ code: 'UsernameExistsException' });

      expect(thrown?.message).not.toContain('already exists');
    });
  });

  // #685: the field carried no "(Optional)" marker, so it read as mandatory
  // while an account could still be created without one. Account settings
  // already require a mobile number, so sign-up asks for one too.
  describe('mobile phone', () => {
    it('is required on submit', async () => {
      spyOn(console, 'error');
      const thrown = await (component.services.handleSignUp as any)({
        username: 'someone@example.com',
        password: 'Passw0rd!',
      }).then(() => null, (e: Error) => e);

      expect(component.mobilePhoneError).toBe('Mobile phone is required');
      expect(thrown.message).toContain('Mobile Phone Number');
    });

    it('is required on blur', () => {
      component.validateMobilePhone({ target: { value: '' } } as unknown as Event);

      expect(component.mobilePhoneError).toBe('Mobile phone is required');
    });

    it('accepts a valid number', () => {
      component.validateMobilePhone({ target: { value: '+1 (250) 555-1234' } } as unknown as Event);

      expect(component.mobilePhoneError).toBe('');
    });
  });

  // The summary drives the error alert; it used to be computed and discarded.
  describe('error summary', () => {
    it('names every field currently in error', () => {
      component.emailError = 'Email is required';
      component.cityError = 'City is required';
      (component as any).updateErrorSummary();

      expect(component.summaryError).toContain('Email');
      expect(component.summaryError).toContain('City');
      expect(component.summaryError).not.toContain('Province');
    });

    it('clears once the fields are valid', () => {
      component.emailError = 'Email is required';
      (component as any).updateErrorSummary();
      component.emailError = '';
      (component as any).updateErrorSummary();

      expect(component.summaryError).toBe('');
    });

    // The old guard re-threw the previous submit's summary before the errors
    // were cleared, so a corrected form could never be resubmitted.
    it('does not block a resubmit with the previous summary', async () => {
      spyOn(console, 'error');
      component.summaryError = 'Please fix the following before continuing: City.';

      const thrown = await (component.services.handleSignUp as any)({
        username: 'someone@example.com',
        password: '',
      }).then(() => null, (e: Error) => e);

      expect(thrown.message).toContain('Invalid fields');
      expect(thrown.message).not.toContain('City.');
    });
  });
});
