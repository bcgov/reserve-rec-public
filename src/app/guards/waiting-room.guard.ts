import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot } from '@angular/router';
import { CartService } from '../services/cart.service';
import { WaitingRoomService } from '../services/waiting-room.service';

const MODE2_FACILITY_KEY = 'MODE2#global#1';

@Injectable({ providedIn: 'root' })
export class WaitingRoomGuard implements CanActivate {
  constructor(
    private cartService: CartService,
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

    window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
      waitingRoomItem.collectionId,
      waitingRoomItem.activityType,
      waitingRoomItem.activityId,
      waitingRoomItem.startDate,
      '/checkout'
    );
    return false;
  }
}
