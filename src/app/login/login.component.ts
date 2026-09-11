import { AfterViewChecked, AfterViewInit, Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';
import { AuthService } from '../services/auth.service';
import { AuthValidationService, SignUpValidationErrors } from '../services/auth-validation.service';
import {
  signIn,
  signUp,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

import { ActivatedRoute, Router } from '@angular/router';


@Component({
    selector: 'app-login',
    imports: [CommonModule, AmplifyAuthenticatorModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit, AfterViewInit, AfterViewChecked {
  showAmplifyAuth = false;
  authKey = Date.now();
  initialState: 'signIn' | 'signUp' = 'signIn';

  loginReason: string | null = null;

  // Error message variables to display under each html input field
  emailError = '';
  passwordError = '';
  confirmPasswordError = '';
  givenNameError = '';
  familyNameError = '';
  mobilePhoneError = '';
  homePhoneError = '';
  streetAddressError = '';
  cityError = '';
  provinceError = '';
  postalCodeError = '';
  countryError = '';
  summaryError = ''; // Track summary error message for display

  // Placeholders are a single space to suppress Amplify's default placeholder,
  // which just repeats the label.
  formFields = {
    signUp: {
      email: { placeholder: ' ' },
      password: { placeholder: ' ' },
      confirm_password: { placeholder: ' ' },
    },
  };

  // Set on the first Create Account press. Amplify re-runs the validators on
  // every keystroke, so nothing is flagged before then: validating earlier
  // paints the form red while the user is still typing it in, and leaves the
  // Create Account button disabled from the moment the page opens (#685).
  private submitAttempted = false;
  private signUpForm: HTMLFormElement | null = null;

  // A duplicate account is only detectable at submit, so the message has to be
  // held and replayed through the validator to land on the email field. It is
  // dropped as soon as a different address is typed.
  private takenEmail = '';

  // Error-property name -> the label the user sees, for both the summary and
  // the "invalid fields" message. One map so the two can't drift apart.
  private readonly fieldLabels: Record<string, string> = {
    emailError: 'Email',
    passwordError: 'Password',
    confirmPasswordError: 'Confirm Password',
    givenNameError: 'Given Name',
    familyNameError: 'Family Name',
    mobilePhoneError: 'Mobile Phone Number',
    homePhoneError: 'Home Phone Number',
    streetAddressError: 'Street Address',
    cityError: 'City',
    provinceError: 'Province',
    postalCodeError: 'Postal Code',
    countryError: 'Country',
  };

  // Sign-up failures a user can act on. Anything unlisted keeps the generic
  // message so Cognito's pool/client detail stays out of the UI (#628).
  private static readonly SIGN_UP_ERRORS: Record<string, string> = {
    UsernameExistsException:
      'An account with this email address already exists. Sign in instead, or reset your password.',
    InvalidPasswordException:
      'That password does not meet the requirements listed above.',
    InvalidParameterException:
      'Some of the details entered are not valid. Check the fields above and try again.',
    TooManyRequestsException: 'Too many attempts. Wait a moment and try again.',
    LimitExceededException: 'Too many attempts. Wait a moment and try again.',
  };

  private static readonly SIGN_UP_GENERIC_ERROR =
    'We could not create your account. Please check your details and try again.';

  private clearAllErrors(): void {
    this.emailError = '';
    this.passwordError = '';
    this.confirmPasswordError = '';
    this.givenNameError = '';
    this.familyNameError = '';
    this.mobilePhoneError = '';
    this.homePhoneError = '';
    this.streetAddressError = '';
    this.cityError = '';
    this.provinceError = '';
    this.postalCodeError = '';
    this.countryError = '';
    this.summaryError = '';
    this.takenEmail = '';
  }

  // The summary was computed and thrown away, so the alert never rendered and
  // every field error had to be found by scrolling the form (#685).
  private updateErrorSummary(): void {
    const errors = this as unknown as Record<string, string>;
    const invalid = Object.keys(this.fieldLabels).filter(key => errors[key]);

    this.summaryError = invalid.length
      ? `Please fix the following before continuing: ${invalid.map(key => this.fieldLabels[key]).join(', ')}.`
      : '';
  }

  // Amplify surfaces the raw Cognito error in the authenticator's alert, which
  // leaked infrastructure detail to end users — e.g. "User pool client
  // <id> does not exist." (#628). Wrapping the handlers keeps Cognito's own
  // wording out of the UI: users get an actionable generic message, and the
  // original error is still logged for debugging.
  public services = {
    handleSignIn: (input: Parameters<typeof signIn>[0]) =>
      this.withGenericError(() => signIn(input),
        'We could not sign you in. Check your email and password and try again.'),

    handleSignUp: async (input: Parameters<typeof signUp>[0]) => {
      this.clearAllErrors();

      const email = input.username ?? '';
      const errors = this.showErrors(
        email,
        input.password ?? '',
        (input.options?.userAttributes ?? {}) as Record<string, unknown>
      );

      const errorEntries = Object.entries(errors).filter(([, message]) => message);
      if (errorEntries.length) {
        const invalidFields = errorEntries.map(([key]) => this.fieldLabels[key]).join(', ');
        throw new Error(`Invalid fields: ${invalidFields}`);
      }

      try {
        return await signUp(input);
      } catch (error) {
        this.failSignUp(error, email);
      }
    },

    // The only hook that can put a message on Amplify's own email, password and
    // confirm password fields, which the sign-up slot renders as one block. It
    // runs on every change and on submit, so a field named here is reported
    // under that field rather than in a list at the foot of the form (#685).
    validateCustomSignUp: async (
      formData: Record<string, string>,
      touchData: Record<string, boolean>,
    ) => {
      if (!this.submitAttempted) {
        return null;
      }

      const email = formData?.['email'] ?? '';
      const password = formData?.['password'] ?? '';
      const confirmPassword = formData?.['confirm_password'] ?? '';

      // Every field is checked on each pass, so one press of Create Account
      // reports the whole form rather than revealing the address fields only
      // once the credentials above them are fixed.
      this.showErrors(email, password, formData);

      if (!this.emailError && this.takenEmail && email === this.takenEmail) {
        this.emailError = LoginComponent.SIGN_UP_ERRORS['UsernameExistsException'];
      }

      const errors: Record<string, string> = {};
      if (this.emailError) {
        errors['email'] = this.emailError;
      }

      // A password Amplify has never seen focus gets no message from its own
      // validator, so a straight-to-submit blank one needs covering here.
      // Anything it does report is left to it, to keep to one message.
      if (this.passwordError && !touchData?.['password']) {
        errors['password'] = this.passwordError;
      }

      // confirm_password never reaches handleSignUp: Amplify strips it from the
      // sign-up input because it is not a Cognito attribute. Its own check only
      // fires on a mismatch, so without the blank case an account goes through
      // on a single typed password.
      this.confirmPasswordError = !confirmPassword.trim()
        ? 'Please confirm your password.'
        : password !== confirmPassword
          ? 'Passwords do not match.'
          : '';
      if (this.confirmPasswordError) {
        errors['confirm_password'] = this.confirmPasswordError;
      }

      this.updateErrorSummary();

      // Only these three are Amplify's to render. A bad address field is left
      // to handleSignUp, which refuses the submit with the same message its
      // own error line is already showing.
      return Object.keys(errors).length ? errors : null;
    },

    handleConfirmSignUp: (input: Parameters<typeof confirmSignUp>[0]) =>
      this.withGenericError(() => confirmSignUp(input),
        'We could not confirm your account. Check the code and try again.'),

    handleForgotPassword: (input: Parameters<typeof resetPassword>[0]) =>
      this.withGenericError(() => resetPassword(input),
        'We could not start a password reset. Please try again.'),

    handleForgotPasswordSubmit: (input: Parameters<typeof confirmResetPassword>[0]) =>
      this.withGenericError(() => confirmResetPassword(input),
        'We could not reset your password. Check the code and try again.'),
  };

  // One place that turns the form's raw values into validation messages on the
  // component, so the submit path and the live checks can't disagree.
  private showErrors(
    email: string,
    password: string,
    attributes: Record<string, unknown>
  ): SignUpValidationErrors {
    const value = (key: string) => String(attributes[key] ?? '');
    const errors = this.validationService.validateSignUp({
      email,
      password,
      givenName: value('given_name'),
      familyName: value('family_name'),
      mobilePhone: value('custom:mobilePhone'),
      homePhone: value('custom:secondaryNumber'),
      streetAddress: value('custom:streetAddress'),
      city: value('custom:city'),
      province: value('custom:province'),
      postalCode: value('custom:postalCode'),
      country: value('custom:country'),
    });

    Object.entries(errors).forEach(([key, message]) => {
      (this as unknown as Record<string, string>)[key] = message;
    });
    this.updateErrorSummary();

    return errors;
  }

  // Cognito only reports a duplicate account (including an alias of an
  // existing address) at submit, and the generic wrapper turned that into an
  // unactionable message at the foot of the form (#685). Amplify v6 errors
  // carry `name`, not `code` — matching on `code` silently matches nothing.
  private failSignUp(error: unknown, email = ''): never {
    console.error('Auth error:', error);
    const name = (error as { name?: string })?.name ?? '';
    const message = LoginComponent.SIGN_UP_ERRORS[name] ?? LoginComponent.SIGN_UP_GENERIC_ERROR;

    if (name === 'UsernameExistsException') {
      this.emailError = message;
      this.takenEmail = email;
      this.updateErrorSummary();
      // Re-runs the validators so the message lands on the email field itself,
      // not only in the error line under the credentials.
      this.authenticator.updateForm({ name: 'email', value: email });
    }

    throw new Error(message);
  }

  private async withGenericError<T>(run: () => Promise<T>, message: string): Promise<T> {
    try {
      return await run();
    } catch (error) {
      console.error('Auth error:', error);
      throw new Error(message);
    }
  }

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private authenticator: AuthenticatorService,
    private validationService: AuthValidationService,
    private el: ElementRef<HTMLElement>
  ) {}
  currentDate = '';

  ngAfterViewInit(): void {
    // Capture phase, on our own element: the machine reads submitAttempted
    // while validating, and Amplify's handler on the form itself would
    // otherwise get there first on the very first press.
    this.el.nativeElement.addEventListener(
      'submit',
      () => { this.submitAttempted = true; },
      true
    );
  }

  ngAfterViewChecked(): void {
    const form = this.el.nativeElement.querySelector<HTMLFormElement>('amplify-sign-up form');
    if (form === this.signUpForm) {
      return;
    }
    this.signUpForm = form;
    if (form) {
      // The browser's own check refuses the submit and only moves focus to the
      // first bad field, so handleSignUp never runs and the user is left with
      // no message at all. This form reports its own errors (#685).
      form.noValidate = true;
    }
  }

  ngOnInit() {
    // Force authenticator reset by updating key
    this.authKey = Date.now();
    this.loginReason = this.route.snapshot.queryParamMap.get('reason');

    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };
    this.currentDate = new Intl.DateTimeFormat('en-US', options).format(now).replace(',', '').replace(' ', '-');
  }

  get user() {
    return this.authService.user(); // Directly bind to the signal
  }

  get isFormInvalid(): boolean {
    return !!this.summaryError;
  }

  signInWithRedirect() {
    return this.authService.federatedSignIn(); // Default to Cognito-hosted UI
  }
  logCurrentDate() {
    console.log('Current Date:', this.currentDate);
  }
  
  onLogin(provider: string) {
    this.authService.loginWithProvider(provider);
  }
  
  showBCParksLogin() {
    this.submitAttempted = false;
    this.initialState = 'signIn';
    this.showAmplifyAuth = true;
    this.authenticator.toSignIn();
  }

  showBCParksSignUp() {
    this.submitAttempted = false;
    this.initialState = 'signUp';
    this.showAmplifyAuth = true;
    this.authenticator.toSignUp();
  }
  
  goBack() {
    this.submitAttempted = false;
    this.showAmplifyAuth = false;
  }

  // Blur validation methods for real-time field validation
  validateGivenName(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.givenNameError = this.validationService.validateName(input, 'Given name');
    this.updateErrorSummary();
  }

  validateFamilyName(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.familyNameError = this.validationService.validateName(input, 'Surname');
    this.updateErrorSummary();
  }

  validateMobilePhone(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.mobilePhoneError = this.validationService.validateMobilePhone(input);
    this.updateErrorSummary();
  }

  validateHomePhone(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.homePhoneError = this.validationService.validatePhoneNumber(input, 'Home phone');
    this.updateErrorSummary();
  }

  validateStreetAddress(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.streetAddressError = this.validationService.validateStreetAddress(input);
    this.updateErrorSummary();
  }

  validateCity(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.cityError = this.validationService.validateCity(input);
    this.updateErrorSummary();
  }

  validateProvince(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.provinceError = this.validationService.validateProvince(input);
    this.updateErrorSummary();
  }

  validatePostalCode(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.postalCodeError = this.validationService.validatePostalCode(input);
    this.updateErrorSummary();
  }

  validateCountry(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.countryError = this.validationService.validateCountry(input);
    this.updateErrorSummary();
  }
}
