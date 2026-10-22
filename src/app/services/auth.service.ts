import { Injectable, signal } from '@angular/core';
import { Amplify } from "aws-amplify";
import { ConfigService } from './config.service';
import { Hub, I18n } from 'aws-amplify/utils';
import { fetchAuthSession, signOut, signInWithRedirect, fetchUserAttributes, sendUserAttributeVerificationCode, updateUserAttributes, confirmUserAttribute } from 'aws-amplify/auth';
import { LoggerService } from './logger.service';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';
import { Constants } from '../constants';
import { ToastService, ToastTypes } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user = signal<any>(null); // Observable for user updates
  public session = signal(null);
  public redirectValues;
  jwtToken: any;
  private static readonly TOKEN_MIN_LIFE_MS = 60_000;
  private pendingRefresh: Promise<void> | null = null;

  constructor(
    private configService: ConfigService, 
    private loggerService: LoggerService, 
    private router: Router, 
    private loadingService: LoadingService,
    private toastService: ToastService)
  {}

  async init() {
    console.log('this.configService.config:', this.configService.config);
    if (this.configService.config.ENVIRONMENT === 'local' || !this.configService.config['COGNITO_REDIRECT_URI']) {
      this.redirectValues = 'http://localhost:4300';
    } else {
      this.redirectValues = this.configService.config['COGNITO_REDIRECT_URI'];
    }
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: this.configService.config['PUBLIC_USER_POOL_ID'],
          userPoolClientId: this.configService.config['PUBLIC_USER_POOL_CLIENT_ID'],
          identityPoolId: this.configService.config['PUBLIC_IDENTITY_POOL_ID'],
          loginWith: {
            oauth: {
              domain: this.configService.config['PUBLIC_USER_POOL_DOMAIN_URL'],
              scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
              redirectSignIn: [this.redirectValues],
              redirectSignOut: [this.redirectValues],
              responseType: 'code',
            }
          },
        },
      }
    });

    // Sign-up is verified by email only, but Amplify UI falls back to SMS wording when
    // Cognito's delivery medium is unknown; force the email wording.
    I18n.putVocabularies({
      en: {
        'We Texted You': 'We Emailed You',
        'Your code is on the way. To log in, enter the code we texted to': 'Your code is on the way. To log in, enter the code we emailed to',
      },
    });

    // When a redirect sign-in fails (e.g. the user cancels BCSC), Amplify can leave the
    // first token read waiting forever, which blocks app start. Read again once it fails.
    const redirectFailed = new Promise<void>((resolve) => {
      const stop = Hub.listen('auth', ({ payload }) => {
        if (payload.event === 'signInWithRedirect_failure') {
          stop();
          resolve();
        }
      });
    });
    await this.listenToAuthEvents();
    await Promise.race([this.checkIfSignedIn(), redirectFailed.then(() => this.checkIfSignedIn())]);
    if (this.user()) {
      await this.setRefresh();
    }
  }

  async signUp({
    username,
    password,
    email,
    phone_number
  }: {
    username: string;
    password: string;
    email: string;
    phone_number: string;
  }) {
    try {
      const { isSignUpComplete, userId, nextStep } = await this.signUp({
        username,
        password,
        email,
        phone_number
      });


      console.log('Sign-up successful:', userId);
      return { isSignUpComplete, userId, nextStep };
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  private async listenToAuthEvents() {
    Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn': {
          const userAttributes = await fetchUserAttributes(); // Await the user attributes
          this.updateUser(userAttributes); // Set the resolved user attributes
          this.loggerService.info('User has signed in successfully.');
          const session = await fetchAuthSession();
          this.jwtToken = session.credentials.sessionToken;
          await this.setRefresh();
          
          // Check for returnUrl in sessionStorage (set by guard)
          const returnUrl = sessionStorage.getItem('returnUrl');
          if (returnUrl) {
            sessionStorage.removeItem('returnUrl');
            this.router.navigateByUrl(returnUrl);
          } else {
            this.router.navigate(['/']);
          }
          break;
        }
        case 'signedOut': {
          this.loggerService.info('User has signed out successfully.');
          this.updateUser(null);
          this.session.set(null);
          break;
        }
        case 'tokenRefresh': {
          this.loggerService.info('Auth tokens have been refreshed.');
          break;
        }
        case 'tokenRefresh_failure': {
          this.loggerService.info('Failure while refreshing auth tokens.');
          break;
        }
        case 'signInWithRedirect': {
          this.loggerService.info('signInWithRedirect API has successfully been resolved.');
          break;
        }
        case 'signInWithRedirect_failure': {
          this.loggerService.error(`Failure while trying to resolve signInWithRedirect API: ${payload.data?.error}`);
          this.toastService.addMessage(
            Constants.bcscLoginIncompleteMessage,
            'Login failed',
            ToastTypes.ERROR
          );
          break;
        }
      }
    });
  }


  /** Refreshes the session and schedules the next refresh at half the token's remaining life. */
  async setRefresh(forceRefresh = false) {
    try {
      this.session.set(await fetchAuthSession({ forceRefresh: forceRefresh }));
      const accessToken = this.session()?.tokens?.accessToken;
      // Amplify returns no tokens rather than throwing once the refresh token expires
      if (!accessToken) {
        this.loggerService.info('Session expired. Logging out...');
        await this.logout();
        this.router.navigate(['/login']);
        return;
      }
      this.jwtToken = accessToken.toString();
      const refreshInterval = ((accessToken.payload.exp * 1000) - Date.now()) / 2;
      if (refreshInterval > 0) {
        setTimeout(() => this.setRefresh(true), refreshInterval);
      }
    } catch (error) {
      console.error('Error setting refresh token:', error);
      await this.logout(); // Log out on error
      this.router.navigate(['/login']); // Redirect to login
    }
  }

  /** Access token with at least TOKEN_MIN_LIFE_MS left (background tabs throttle the scheduled
   *  refresh); null when signed out or the refresh logged the user out. */
  async getFreshToken(): Promise<string | null> {
    if (!this.jwtToken) {
      return null;
    }
    const exp = this.session()?.tokens?.accessToken?.payload?.exp;
    if (exp && exp * 1000 - Date.now() > AuthService.TOKEN_MIN_LIFE_MS) {
      return this.jwtToken;
    }
    // Share one refresh between concurrent requests
    this.pendingRefresh ??= this.setRefresh(true).finally(() => (this.pendingRefresh = null));
    await this.pendingRefresh;
    return this.jwtToken || null;
  }

  //Use this to ensure signal gets cleared
  async logout() {
    await signOut();
    this.updateUser(null);
    this.session.set(null);
    this.jwtToken = null;
    console.log('User logged out', this.user);
    this.router.navigate(['/']);
  }

  updateUser(user: any) {
    this.user.set(user); // update the signal anytime user changes
  }

  //Just use to confirm is user is logged
  getCurrentUser() {
    try {
      return this.user() || null;
    } catch (error) {
      this.loggerService.error(`Error fetching current user: ${error}`);
      return null;
    }
  }

  async checkIfSignedIn() {
    try {
      this.updateUser(await fetchUserAttributes()); //Fetch the attributes - Has all of the current user data plus the additional attributes
      this.session.set(await fetchAuthSession());
      this.jwtToken = this.session()?.credentials?.sessionToken;
    } catch (error) {
      console.log('User is not signed in:', error);
      // Clear authenticated user state
      this.updateUser(null);
      this.session.set(null);
    }
  }

  //Setup to match logic for admin. Gives opprotunity to add BCEID in future.
  loginWithProvider(provider: string) {
    let idpName = '';
    if (provider === 'bcsc') idpName = 'BCSC';
    //else if (provider === 'bceid') idpName = 'BCEID';
    else return;
    // Use Amplify's signInWithRedirect method to initiate the OAuth flow instead of custome method
    signInWithRedirect({ provider: { custom: idpName } });
  }

  // Check if the user's email is verified
  async checkEmailVerification() {
    try {
      const attributes = await fetchUserAttributes();
      const isVerified = attributes.email_verified === 'true';
      return isVerified;
    } catch (error) {
      console.error('Error fetching attributes:', error);
      return false;
    }
  }

  /** Whether the user signed in with BC Services Card; BCSC-sourced name and address
   *  must not be edited here. */
  isBcscUser(): boolean {
    try {
      const payload: any = this.session()?.tokens?.idToken?.payload;
      const identities = payload?.identities;
      if (Array.isArray(identities) && identities.some((i: any) => `${i?.providerName}`.toUpperCase() === 'BCSC')) {
        return true;
      }
      // Fallback: federated usernames are prefixed with the IdP name (e.g. "BCSC_...").
      const username = `${payload?.['cognito:username'] || ''}`.toUpperCase();
      return username.startsWith('BCSC_') || username.startsWith('BCSC-');
    } catch {
      return false;
    }
  }

  /** Saves attribute changes to Cognito, then refreshes the user signal. */
  async updateUserProfile(attributes: Record<string, string>): Promise<void> {
    try {
      this.loadingService.addToFetchList(Constants.dataIds.USER_UPDATE);
      await updateUserAttributes({ userAttributes: attributes });
      
      // Force Cognito to issue new tokens, which invokes the Pre Token Generation trigger
      // so any changes to a user's session is updated to DynamoDB right away
      const refreshedSession = await fetchAuthSession({ forceRefresh: true });
      this.session.set(refreshedSession);
      this.jwtToken = refreshedSession.tokens?.accessToken?.toString();
      
      this.updateUser(await fetchUserAttributes());
    } catch (error) {
      console.error("Error with updating user profile: ", error)
      throw error;
    } finally {
      this.loadingService.removeFromFetchList(Constants.dataIds.USER_UPDATE);
    }
  }

  // Resend the verification code to the user's email
  async handleResendAttributeCodeToEmail() {
    try {
      const output = await sendUserAttributeVerificationCode({
        userAttributeKey: 'email'
      });
      console.log('Verification code resent successfully', output);
    } catch (error) {
      console.error('Error resending attribute code:', error);
    }
  }

  // Submit activation code
  async handleConfirmAttributeCode(code: string) {
    try {
      await confirmUserAttribute({
        userAttributeKey: 'email',
        confirmationCode: code
      });
      console.log('Email attribute verified successfully');
      return true
    } catch (error) {
      console.error('Error verifying email attribute code:', error);
      throw error;
    }
  }
}
