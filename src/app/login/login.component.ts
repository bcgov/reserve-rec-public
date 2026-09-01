import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';
import { AuthService } from '../services/auth.service';
import { AuthValidationService, SignUpFormData } from '../services/auth-validation.service';
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

export class LoginComponent implements OnInit{
  showAmplifyAuth = false;
  authKey = Date.now();
  initialState: 'signIn' | 'signUp' = 'signIn';

  loginReason: string | null = null;

  // Error message variables to display under each html input field
  emailError = '';
  passwordError = '';
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

  // Amplify's built-in sign-up fields default to `required`, which makes the
  // browser block submit with no visible message: Amplify's own validators
  // never check blank required fields, so handleSignUp never runs and none of
  // the per-field errors below can render. Turning the native required off for
  // all three hands the checking to validateSignUp/validateCustomSignUp (#685).
  // Placeholders are a single space to suppress Amplify's default placeholder.
  formFields = {
    signUp: {
      email: { isRequired: false, placeholder: ' ' },
      password: { isRequired: false, placeholder: ' ' },
      confirm_password: { isRequired: false, placeholder: ' ' },
    },
  };

  // Error-property name -> the label the user sees, for both the summary and
  // the "invalid fields" message. One map so the two can't drift apart.
  private readonly fieldLabels: Record<string, string> = {
    emailError: 'Email',
    passwordError: 'Password',
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
    console.log('Clearing all errors');
    this.emailError = '';
    this.passwordError = '';
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
      
      // Convert Amplify's input format to our SignUpInput interface
      const attributes = input.options?.userAttributes ?? {};
      const attrRecord = attributes as Record<string, unknown>;
      
      const signUpData: SignUpFormData = {
        email: input.username ?? '',
        password: input.password ?? '',
        givenName: String(attrRecord['given_name'] ?? ''),
        familyName: String(attrRecord['family_name'] ?? ''),
        mobilePhone: String(attrRecord['custom:mobilePhone'] ?? ''),
        homePhone: String(attrRecord['custom:secondaryNumber'] ?? ''),
        streetAddress: String(attrRecord['custom:streetAddress'] ?? ''),
        city: String(attrRecord['custom:city'] ?? ''),
        province: String(attrRecord['custom:province'] ?? ''),
        postalCode: String(attrRecord['custom:postalCode'] ?? ''),
        country: String(attrRecord['custom:country'] ?? ''),
      };

      const errors = this.validationService.validateSignUp(signUpData);
      
      // Assign all errors to component properties for display
      this.emailError = errors.emailError;
      this.passwordError = errors.passwordError;
      this.givenNameError = errors.givenNameError;
      this.familyNameError = errors.familyNameError;
      this.mobilePhoneError = errors.mobilePhoneError;
      this.homePhoneError = errors.homePhoneError;
      this.streetAddressError = errors.streetAddressError;
      this.cityError = errors.cityError;
      this.provinceError = errors.provinceError;
      this.postalCodeError = errors.postalCodeError;
      this.countryError = errors.countryError;

      // Update summary error
      this.updateErrorSummary();

      // Check if there are any errors and throw if so
      const errorEntries = Object.entries(errors).filter(([, message]) => message);
      if (errorEntries.length) {
        const invalidFields = errorEntries.map(([key]) => this.fieldLabels[key]).join(', ');
        throw new Error(`Invalid fields: ${invalidFields}`);
      }

      try {
        return await signUp(input);
      } catch (error) {
        this.failSignUp(error);
      }
    },

    // confirm_password never reaches handleSignUp: Amplify strips it from the
    // sign-up input because it is not a Cognito attribute, so the match check
    // has to live here, the only hook that sees the raw form values. Without it
    // clearing isRequired above would let an account through on a single typed
    // password, because Amplify's own check skips a blank, untouched confirm.
    validateCustomSignUp: async (formData: Record<string, string>) => {
      const password = formData?.['password'] ?? '';
      const confirmPassword = formData?.['confirm_password'] ?? '';
      if (!confirmPassword.trim()) {
        return { confirm_password: 'Please confirm your password.' };
      }
      if (password !== confirmPassword) {
        return { confirm_password: 'Passwords do not match.' };
      }
      return null;
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

  // Cognito only reports a duplicate account (including an alias of an
  // existing address) at submit, and the generic wrapper turned that into an
  // unactionable message at the foot of the form (#685). Amplify v6 errors
  // carry `name`, not `code` — matching on `code` silently matches nothing.
  private failSignUp(error: unknown): never {
    console.error('Auth error:', error);
    const name = (error as { name?: string })?.name ?? '';
    const message = LoginComponent.SIGN_UP_ERRORS[name] ?? LoginComponent.SIGN_UP_GENERIC_ERROR;

    if (name === 'UsernameExistsException') {
      this.emailError = message;
      this.updateErrorSummary();
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
    private validationService: AuthValidationService
  ) {}
  currentDate = '';
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
    this.initialState = 'signIn';
    this.showAmplifyAuth = true;
    this.authenticator.toSignIn();
  }

  showBCParksSignUp() {
    this.initialState = 'signUp';
    this.showAmplifyAuth = true;
    this.authenticator.toSignUp();
  }
  
  goBack() {
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
    this.mobilePhoneError = this.validationService.validatePhoneNumber(input, 'Mobile phone');
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
