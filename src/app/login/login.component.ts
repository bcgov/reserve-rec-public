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

  private updateErrorSummary(): void {
    // Check if there are any remaining errors
    const errors = [
      this.emailError,
      this.passwordError,
      this.givenNameError,
      this.familyNameError,
      this.mobilePhoneError,
      this.homePhoneError,
      this.streetAddressError,
      this.cityError,
      this.provinceError,
      this.postalCodeError,
      this.countryError
    ].filter(e => e);

    if (errors.length === 0) {
      this.summaryError = '';
    } else {
      const fieldNameMap: Record<string, string> = {
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

      // Find which fields have errors
      const errorFields = [];
      if (this.givenNameError) errorFields.push(fieldNameMap['givenNameError']);
      if (this.familyNameError) errorFields.push(fieldNameMap['familyNameError']);
      if (this.mobilePhoneError) errorFields.push(fieldNameMap['mobilePhoneError']);
      if (this.homePhoneError) errorFields.push(fieldNameMap['homePhoneError']);
      if (this.streetAddressError) errorFields.push(fieldNameMap['streetAddressError']);
      if (this.cityError) errorFields.push(fieldNameMap['cityError']);
      if (this.provinceError) errorFields.push(fieldNameMap['provinceError']);
      if (this.postalCodeError) errorFields.push(fieldNameMap['postalCodeError']);
      if (this.countryError) errorFields.push(fieldNameMap['countryError']);
    }
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
      // Check if there are any existing field validation errors
      if (this.summaryError) {
        throw new Error(this.summaryError);
      }

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
        const fieldNameMap: Record<string, string> = {
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
        
        const invalidFields = errorEntries.map(([key]) => fieldNameMap[key]).join(', ');
        throw new Error(`Invalid fields: ${invalidFields}`);
      }

      return this.withGenericError(() => signUp(input),
        'We could not create your account. Please check your details and try again.');
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
