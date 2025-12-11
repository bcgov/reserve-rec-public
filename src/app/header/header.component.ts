import { CommonModule } from '@angular/common';
import { Component} from '@angular/core';
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

  constructor(private authService: AuthService, private router: Router, private configService: ConfigService) {
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

  cart(){
    this.router.navigate(['/cart']);
  }
}
