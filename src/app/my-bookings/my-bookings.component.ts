import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-my-bookings',
    imports: [CommonModule],
    templateUrl: './my-bookings.component.html',
    styleUrl: './my-bookings.component.scss'
})
export class MyBookingsComponent {
  constructor(private authService: AuthService) {}

  get user() {
    return this.authService.getCurrentUser(); // Directly bind to the signal
  }

  logout() {
    this.authService.logout(); // Call the sign-out logic
  }
}
