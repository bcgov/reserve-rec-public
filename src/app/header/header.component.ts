import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { RouterModule, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';

@Component({
    selector: 'app-header',
    imports: [CommonModule, RouterModule],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss'
})
export class HeaderComponent {
  public envName: string;
  public showBanner = true;
  public hamburgerIcon = true;

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private configService: ConfigService,
    private el: ElementRef
  ) {
    this.envName = this.configService.config['ENVIRONMENT'] || 'local';
    // Hide banner in production
    if (this.envName === 'prod') {
      this.showBanner = false;
    }
  }
  get user() {
    return this.authService.getCurrentUser(); // Directly bind to the signal
  }

  logout() {
    this.authService.logout(); // Call the sign-out logic
  }
  
  toggleHamburger() {
    this.hamburgerIcon = !this.hamburgerIcon;  
  }

  // Binds to the CSS class
  closeMenu() {
    this.hamburgerIcon = true;
  }

  // Useful way to check if click was outside the entire component,
  // for closing the mobile menu automatically
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target) && !this.hamburgerIcon) {
      this.closeMenu();
    }
  }

}
