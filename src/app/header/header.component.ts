import { CommonModule } from '@angular/common';
import { Component} from '@angular/core';
import { ProfileOffcanvasComponent } from '../profile-offcanvas/profile-offcanvas.component';
import { AuthService } from '../services/auth.service';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-header',
    imports: [CommonModule, ProfileOffcanvasComponent, RouterModule],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss'
})
export class HeaderComponent { 

  constructor(private authService: AuthService) {}

  get user() {
    return this.authService.getCurrentUser(); // Directly bind to the signal
  }

  logout() {
    this.authService.logout(); // Call the sign-out logic
  }

  cart(){
    //Leaving this in for now as it is a great button for debugging login stuff prior to cart actualy being implemented
    console.log("cart time");
    console.log("user", this.user);
  }
}
