import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-account-details',
    imports: [CommonModule],
    templateUrl: './account-details.component.html',
    styleUrl: './account-details.component.scss'
})
export class AccountDetailsComponent {
  constructor(private authService: AuthService) {}

  get user() {
    return this.authService.getCurrentUser(); // Directly bind to the signal
  }

  logout() {
    this.authService.logout(); // Call the sign-out logic
  }

  edit() {
    console.log('IMPLEMENT EDIT LATER');
  }

  scrollToElement(element: HTMLElement): void {
    element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  }
}
