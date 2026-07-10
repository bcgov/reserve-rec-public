import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';
import { WaitingRoomService } from '../services/waiting-room.service';

const MODE2_FACILITY_KEY = 'MODE2#global#1';

@Injectable({ providedIn: 'root' })
export class WaitingRoomGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private cartService: CartService,
    private router: Router,
    private waitingRoomService: WaitingRoomService
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // --- Mode 2 (site-wide gate) ---
    if (this.waitingRoomService.mode2Active()) {
      if (this.waitingRoomService.hasValidAdmission(MODE2_FACILITY_KEY, '')) {
        return true;
      }
      if (sessionStorage.getItem('wr_bypass_guard') === '1') {
        sessionStorage.removeItem('wr_bypass_guard');
        return true;
      }
      // The waiting room requires a signed-in user. Send unauthenticated users to
      // login (with a reason) instead of silently bouncing them off the standalone
      // waiting room page back to the landing page.
      if (!this.requireLogin(state)) {
        return false;
      }
      const today = new Date().toISOString().slice(0, 10);
      window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
        'MODE2', 'global', '1', today, state.url
      );
      return false;
    }

    // --- Mode 1 (per-facility gate) ---
    const items = this.cartService.items();
    const waitingRoomItem = items.find(item => item.waitingRoomActive);

    if (!waitingRoomItem) {
      return true;
    }

    const facilityKey = `${waitingRoomItem.collectionId}#${waitingRoomItem.activityType}#${waitingRoomItem.activityId}`;
    const dateKey = waitingRoomItem.startDate;

    if (this.waitingRoomService.hasValidAdmission(facilityKey, dateKey)) {
      return true;
    }

    if (sessionStorage.getItem('wr_bypass_guard') === '1') {
      sessionStorage.removeItem('wr_bypass_guard');
      return true;
    }

    if (!this.requireLogin(state)) {
      return false;
    }

    window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
      waitingRoomItem.collectionId,
      waitingRoomItem.activityType,
      waitingRoomItem.activityId,
      waitingRoomItem.startDate,
      '/checkout'
    );
    return false;
  }

  /**
   * Ensures a user is signed in. Returns true when authenticated. When not,
   * stashes the return URL, routes to login with a waiting-room reason, and
   * returns false so the caller can abort.
   */
  private requireLogin(state: RouterStateSnapshot): boolean {
    if (this.authService.getCurrentUser()) {
      return true;
    }
    sessionStorage.setItem('returnUrl', state.url);
    this.router.navigate(['/login'], { queryParams: { reason: 'waiting-room' } });
    return false;
  }
}
