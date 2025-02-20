import { Injectable, signal } from '@angular/core';
import { Amplify } from "aws-amplify";
import { ConfigService } from './config.service';
import { getCurrentUser } from 'aws-amplify/auth/cognito';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public user = signal(null);
  public session = signal(null);
  jwtToken: any;

  constructor(private configService: ConfigService, private loggerService: LoggerService) { }

  async init() {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: this.configService.config['USER_POOL_ID'],
          userPoolClientId: this.configService.config['USER_POOL_CLIENT_ID'],
          identityPoolId: this.configService.config['IDENTITY_POOL_ID'],
          loginWith: {
            oauth: {
              domain: this.configService.config['OAUTH_DOMAIN'],
              scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
              redirectSignIn: ['http://localhost:4200'],
              redirectSignOut: ['http://localhost:4200'],
              responseType: 'code',
            }
          },
        },
      },
    });

    await this.listenToAuthEvents();
    await this.checkIfSignedIn();
    if (this.user()) {
      await this.setRefresh();
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
        case 'signedIn':
          this.loggerService.info('User has signed in successfully.');
          await this.checkIfSignedIn();
          this.jwtToken = this.session().credentials.sessionToken;
          await this.setRefresh();
          break;
        case 'signedOut':
          this.loggerService.info('User has signed out successfully.');
          this.user.set(null);
          this.session.set(null);
          break;
        case 'tokenRefresh':
          this.loggerService.info('Auth tokens have been refreshed.');
          break;
        case 'tokenRefresh_failure':
          this.loggerService.info('Failure while refreshing auth tokens.');
          break;
        case 'signInWithRedirect':
          this.loggerService.info('signInWithRedirect API has successfully been resolved.');
          break;
        case 'signInWithRedirect_failure':
          this.loggerService.info('Failure while trying to resolve signInWithRedirect API.');
          break;
      }
    });
  }

  /**
   * Checks if the user is signed in.
   * 
   * This method attempts to retrieve the current user and set it to the `user` property.
   * If the user is signed in, it logs an informational message and a debug message with the user details.
   * If the user is not signed in, it sets the `user` property to `null`.
   * 
   * @returns {Promise<void>} A promise that resolves when the check is complete.
   * @throws Will throw an error if the user is not signed in.
   */
  async checkIfSignedIn() {
    // check if there's a current user first
    try {
      this.user.set(await getCurrentUser());
      this.session.set(await fetchAuthSession());
      this.jwtToken = this.session()?.credentials?.sessionToken;
    } catch (error) {
      this.loggerService.debug('No user is currently signed in.');
      this.loggerService.debug(error);
      this.user.set(null);
      this.session.set(null);
    }

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
    this.session.set(await fetchAuthSession({ forceRefresh: forceRefresh }));
    if (this.session().tokens) {
      this.jwtToken = this.session().tokens.accessToken.toString();
      this.loggerService.debug(JSON.stringify(this.session(), null, 2));
      // Set refresh to half the expiry time
      const refreshInterval = ((this.session().tokens.accessToken.payload.exp * 1000) - Date.now()) / 2;
      if (refreshInterval > 0) {
        setTimeout(async () => {
          try {
            await this.setRefresh(true);
            this.loggerService.info('Token refreshed successfully.');
          } catch (error) {
            console.error('Error refreshing token:', error);
          }
        }, refreshInterval);
      }
    }
  }

  async logout() {
    await signOut();
  }
}
