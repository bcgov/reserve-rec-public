import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { CartService } from '../services/cart.service';
import { WaitingRoomService } from '../services/waiting-room.service';

@Injectable({ providedIn: 'root' })
export class WaitingRoomGuard implements CanActivate {
  constructor(
    private cartService: CartService,
    private waitingRoomService: WaitingRoomService
  ) {}

  canActivate(): boolean {
    const items = this.cartService.items();
    const waitingRoomItem = items.find(item => item.waitingRoomActive);

    if (!waitingRoomItem) {
      return true; // No waiting room required for any cart item
    }

    const facilityKey = `${waitingRoomItem.collectionId}#${waitingRoomItem.activityType}#${waitingRoomItem.activityId}`;
    const dateKey = waitingRoomItem.startDate;

    if (this.waitingRoomService.hasValidAdmission(facilityKey, dateKey)) {
      return true;
    }

    // Queue was closed — waiting room set this flag before redirecting here
    if (sessionStorage.getItem('wr_bypass_guard') === '1') {
      sessionStorage.removeItem('wr_bypass_guard');
      return true;
    }

    // No valid admission — send user back to the waiting room
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
