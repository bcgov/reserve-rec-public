import { Component, OnInit } from '@angular/core';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { AuthService } from '../services/auth.service';
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
    imports: [AmplifyAuthenticatorModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit{
  showAmplifyAuth = false;
  authKey = Date.now();
  initialState: 'signIn' | 'signUp' = 'signIn';

  loginReason: string | null = null;

  // Amplify surfaces the raw Cognito error in the authenticator's alert, which
  // leaked infrastructure detail to end users — e.g. "User pool client
  // <id> does not exist." (#628). Wrapping the handlers keeps Cognito's own
  // wording out of the UI: users get an actionable generic message, and the
  // original error is still logged for debugging.
  public services = {
    handleSignIn: (input: Parameters<typeof signIn>[0]) =>
      this.withGenericError(() => signIn(input),
        'We could not sign you in. Check your email and password and try again.'),

    handleSignUp: (input: Parameters<typeof signUp>[0]) =>
      this.withGenericError(() => signUp(input),
        'We could not create your account. Please check your details and try again.'),

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
    private router: Router
  ) {}
  currentDate = '';
  ngOnInit() {
    // Force authenticator reset by updating key
    this.authKey = Date.now();
    this.loginReason = this.route.snapshot.queryParamMap.get('reason');
    // If user is already authenticated, redirect to home
    if (this.authService.user()) {
      this.router.navigate(['/']);
      return;
    }

    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };
    this.currentDate = new Intl.DateTimeFormat('en-US', options).format(now).replace(',', '').replace(' ', '-');
  }

  get user() {
    return this.authService.user(); // Directly bind to the signal
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
  }

  showBCParksSignUp() {
    this.initialState = 'signUp';
    this.showAmplifyAuth = true;
  }
  
  goBack() {
    this.showAmplifyAuth = false;
  }
}
