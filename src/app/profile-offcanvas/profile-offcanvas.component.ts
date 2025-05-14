import { CommonModule } from '@angular/common';
import { Component, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { ToastService, ToastTypes } from '../services/toast.service';

@Component({
    selector: 'app-profile-offcanvas',
    imports: [
        CommonModule,
        RouterModule,
    ],
    templateUrl: './profile-offcanvas.component.html',
    styleUrl: './profile-offcanvas.component.scss'
})
export class ProfileOffcanvasComponent {

  constructor(private authService: AuthService) {}

  get user() {
    return this.authService.user();
  }


  logout() {
    this.authService.updateUser(null); // Clear the user
    this.authService.logout(); // Call the sign-out logic
  }
}
