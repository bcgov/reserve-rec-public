import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { RouterModule, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { CartService } from '../services/cart.service';
import { ApiService } from '../services/api.service';
import { LoggerService } from '../services/logger.service';
import { lastValueFrom } from 'rxjs';

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
  public migrationEmailSending = false;
  private sentMigrationId: string | null = null;
  private migrationRequestError: { migrateId: string | null; message: string } | null = null;

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private configService: ConfigService,
    private el: ElementRef,
    private cartService: CartService,
    private apiService: ApiService,
    private loggerService: LoggerService,
  ) {
    this.envName = (this.configService.config['ENVIRONMENT'] || 'local').toLowerCase();
    // Hide banner in production
    if (this.envName === 'prod' || this.envName === 'production') {
      this.showBanner = false;
    }
  }
  get user() {
    return this.authService.getCurrentUser(); // Directly bind to the signal
  }


  // check if the user has a pending migration request
  get migrationPending() {
    return this.user?.['custom:migrationPending'] === 'true';
  }

  // check if the user has already sent a migration confirmation email
  get migrationEmailSent() {
    return this.sentMigrationId === this.user?.['custom:migrationId'];
  }

  get migrationEmailError() {
    return this.migrationRequestError?.migrateId === (this.user?.['custom:migrationId'] || null)
      ? this.migrationRequestError.message
      : '';
  }

  get userInitials() {
    const u = this.user;
    if (!u) return '';
    return `${u.given_name?.[0] || ''}${u.family_name?.[0] || ''}`.toUpperCase();
  }

  logout() {
    this.authService.logout(); // Call the sign-out logic
  }

  get cartItemCount() {
    return this.cartService.itemCount();
  }

  get cartLabel() {
    const n = this.cartItemCount;
    return n > 0 ? `Cart, ${n} item${n === 1 ? '' : 's'}` : 'Cart';
  }

  navigateToCart() {
    this.router.navigate(['/cart']);
    this.closeMenu();
  }

  // Request a migration confirmation email for the user
  async requestMigrationConfirmation() {
    const migrateId = this.user?.['custom:migrationId'];
    if (this.migrationEmailSending || !this.migrationPending) return;
    if (typeof migrateId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(migrateId)) {
      const message = 'We could not find a valid migration request. Please try signing in with BCSC again.';
      this.migrationRequestError = {
        migrateId: typeof migrateId === 'string' ? migrateId : null,
        message,
      };
      this.loggerService.error(message);
      return;
    }

    this.migrationEmailSending = true;
    this.migrationRequestError = null;
    try {
      await lastValueFrom(this.apiService.post(`migrate/${migrateId}/email`, {}));
      this.sentMigrationId = migrateId;
    } catch (error) {
      this.loggerService.error(error);
      const response = (error as { error?: Record<string, unknown> })?.error;
      const message = [
        response?.['msg'],
        response?.['message'],
      ].find((message): message is string => typeof message === 'string')
        || 'We could not send the confirmation email. Please try again.';
      this.migrationRequestError = { migrateId, message };
    } finally {
      this.migrationEmailSending = false;
    }
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
