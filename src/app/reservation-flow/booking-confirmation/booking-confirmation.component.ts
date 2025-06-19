import { DatePipe } from '@angular/common';
import { Component, effect, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PolicyAccordionsComponent } from '../policy-accordions/policy-accordions.component';

@Component({
  selector: 'app-booking-confirmation',
  imports: [DatePipe, PolicyAccordionsComponent],
  templateUrl: './booking-confirmation.component.html',
  styleUrl: './booking-confirmation.component.scss'
})
export class BookingConfirmationComponent {
  public _bookingDataSignal: WritableSignal<any[]> = signal([]);
  public bookingData;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router
  ) {
    this.route.data.subscribe((data) => {
      if (data?.['booking']?.data) {
        this._bookingDataSignal.set(data['booking'].data);
      }
    })
    effect(() => {
      this.bookingData = this._bookingDataSignal();
    })
  }

  navigate() {
    this.router.navigate(['/']);
  }

  calculateTotalNights(): number {
    const startDate = this.bookingData.startDate || null;
    const endDate = this.bookingData.endDate || null;
    if (!startDate || !endDate) {
      return 0;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return totalNights;
  }

  calculateTotalOccupants(): number {
    return (parseInt(this.bookingData?.partyInformation?.adult) || 0) +
      (parseInt(this.bookingData?.partyInformation?.senior) || 0) +
      (parseInt(this.bookingData?.partyInformation?.youth) || 0) +
      (parseInt(this.bookingData?.partyInformation?.child) || 0);
  }
}
