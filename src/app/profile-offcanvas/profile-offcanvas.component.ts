import { CommonModule } from '@angular/common';
import { Component, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService, ToastTypes } from '../services/toast.service';

@Component({
  selector: 'app-profile-offcanvas',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './profile-offcanvas.component.html',
  styleUrl: './profile-offcanvas.component.scss'
})
export class ProfileOffcanvasComponent {
  public user = null;

  constructor(private authService: AuthService, private toastService: ToastService) {
    effect(() => {
      this.user = this.authService.user();
    });
  }

  async logout() {
    await this.authService.logout();
    this.toastService.addMessage("", 'Logged out successfully', ToastTypes.SUCCESS);
  }
}
