import { Component, OnInit } from '@angular/core';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';


@Component({
    selector: 'app-login',
    imports: [AmplifyAuthenticatorModule, CommonModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})

export class LoginComponent implements OnInit{
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  currentDate = '';
  ngOnInit() {
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
}
