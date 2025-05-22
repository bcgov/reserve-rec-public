import { Injectable, signal } from '@angular/core';
import { Amplify } from "aws-amplify";
import { ConfigService } from './config.service';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession, signOut, signInWithRedirect, fetchUserAttributes} from 'aws-amplify/auth';
import { LoggerService } from './logger.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user = signal<any>(null); // Observable for user updates
  public session = signal(null);
  jwtToken: any;

  constructor(private configService: ConfigService, private loggerService: LoggerService, private router: Router) { }

  async init() {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: this.configService.config['PUBLIC_USER_POOL_ID'],
          userPoolClientId: this.configService.config['PUBLIC_USER_POOL_CLIENT_ID'],
          identityPoolId: this.configService.config['PUBLIC_IDENTITY_POOL_ID'],
         loginWith:{
             oauth: {
              domain: this.configService.config['PUBLIC_USER_POOL_DOMAIN_URL'],
              scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
              redirectSignIn: ['http://localhost:4200'],
              redirectSignOut: ['http://localhost:4200'],
              responseType: 'code',
            }
        },
      },
    }
    });

    await this.listenToAuthEvents();
    await this.checkIfSignedIn();
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

  async federatedSignIn(): Promise<void> {
    try {
        await signInWithRedirect();
    } catch (error) {
      this.loggerService.error(`Error during federated sign-in: ${error}`);
      throw error;
    }
  }
  /**
   * Listens to authentication events and handles them accordingly.
   *
   * This method sets up a listener for various authentication events such as
   * user sign-in, sign-out, token refresh, and sign-in with redirect. Depending
   * on the event type, it logs the event and performs necessary actions like
   * checking if the user is signed in, setting a refresh token, or clearing the
   * user data.
   *
   * @private
   * @async
   * @returns {Promise<void>} A promise that resolves when the event handling is complete.
   */
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
          this.router.navigate(['/']);
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
        case 'tokenRefresh_failure':{
          this.loggerService.info('Failure while refreshing auth tokens.');
          break;
        }
        case 'signInWithRedirect':{
          this.loggerService.info('signInWithRedirect API has successfully been resolved.');
          break;
        }
        case 'signInWithRedirect_failure':{
          this.loggerService.info('Failure while trying to resolve signInWithRedirect API.');
          break;
        }
      }
    });
  }


  /**
   * Sets the refresh token and schedules the next refresh based on the token's expiration time.
   *
   * @param {boolean} [forceRefresh=false] - Whether to force a refresh of the authentication session.
   * @returns {Promise<void>} - A promise that resolves when the refresh operation is complete.
   *
   * @throws {Error} - Throws an error if the token refresh fails.
   */
  async setRefresh(forceRefresh = false) {
    try{
      this.session.set(await fetchAuthSession({ forceRefresh: forceRefresh }));
      if (this.session().tokens) {
        this.jwtToken = this.session().tokens.accessToken.toString();
        this.loggerService.debug(JSON.stringify(this.session(), null, 2));
        const refreshInterval = ((this.session().tokens.accessToken.payload.exp * 1000) - Date.now()) / 2;
        if (refreshInterval > 0) {
          setTimeout(async () => {
            try {
              await this.setRefresh(true);
              this.loggerService.info('Token refreshed successfully.');
            } catch (error) {
              console.error('Error refreshing token:', error);
              const currentTime = Date.now() / 1000;
              const refreshTokenExp = this.session().tokens.refreshToken.payload.exp;
              //This is just kicking user out to login page. TODO: Add a modal to confirm logout or stay logged in?
              if (currentTime >= refreshTokenExp) {
                this.loggerService.info('Refresh token expired. Logging out...');
                await this.logout(); 
                this.router.navigate(['/login']); 
              }
            }
          }, refreshInterval);
        }
      } 
    }catch (error) {
      console.error('Error setting refresh token:', error);
      await this.logout(); // Log out on error
      this.router.navigate(['/login']); // Redirect to login
    }
  }

  //Use this to ensure signal gets cleared
  async logout() {
    await signOut();
    this.updateUser(null); 
    this.session.set(null);
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
      this.logout();
    }
  }
}