import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';

import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-account',
    imports: [RouterModule],
    templateUrl: './account.component.html',
    styleUrl: './account.component.scss'
})
export class AccountComponent {
  constructor(private authService: AuthService) {}

  get user() {
    return this.authService.getCurrentUser(); // Directly bind to the signal
  }

  logout() {
    this.authService.logout(); // Call the sign-out logic
  }
  
}
