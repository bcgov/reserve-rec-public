import { Component, effect } from '@angular/core';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';


@Component({
    selector: 'app-login',
    imports: [AmplifyAuthenticatorModule, CommonModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})

export class LoginComponent {
  constructor(private authService: AuthService) {}

  get user() {
    return this.authService.user(); // Directly bind to the signal
  }

  signInWithRedirect() {
    return this.authService.federatedSignIn(); // Default to Cognito-hosted UI
  }
}
