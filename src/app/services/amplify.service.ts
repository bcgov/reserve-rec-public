import { Injectable } from '@angular/core';
import { Amplify } from "aws-amplify";
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AmplifyService {
  constructor(private configService: ConfigService) {
  }

  init() {
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
  }
}
