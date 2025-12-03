import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BookingMapComponent } from '../../booking-map/booking-map.component';
import { AuthService } from '../../services/auth.service';
import { Utils } from '../../utils/utils';

@Component({
  selector: 'app-booking-details',
  templateUrl: './booking-details.component.html',
  styleUrls: ['./booking-details.component.scss'],
  imports: [CommonModule, BookingMapComponent, RouterModule],
})
export class BookingDetailsComponent implements OnInit {
  booking: any = null;
  transaction: any = null;
  mapObj: any = null;
  user: any = null;
  startDate = '';
  endDate = '';
  bookedDate = '';
  viewMap = true;
  zoomValue = 12;
  loading = true;


  
constructor(
  private apiService: ApiService,
  private route: ActivatedRoute,
  private authService: AuthService,
  private router: Router
) {}
  async ngOnInit() {
    try {
      const bookingId = this.route.snapshot.paramMap.get('id');
      const email = this.route.snapshot.queryParamMap.get('email');
      const queryParams: any = {};
      if (email) {
        queryParams.email = email;
      }
      
      const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`, queryParams));

      // Fetch transaction details
      const transactionId = res.data?.clientTransactionId;
      const transactionRes: any = await lastValueFrom(this.apiService.get(`transactions/${transactionId}`, queryParams));
      this.transaction = transactionRes.data;

      this.booking = res.data;

      // Add calculated fields to the booking object
      this.booking.nights = this.calculateNights(this.booking.startDate, this.booking.endDate);
      this.booking.totalParty = this.formatParty(this.booking.partyInformation);
      
      // Only create map object if we have location data
      if (this.booking.coordinates || this.booking.location) {
        this.mapObj = Utils.formatMapCoords(this.booking);
      } else {
        console.warn('No map data available for this booking');
        this.mapObj = null;
      }
      
      this.user = this.authService.getCurrentUser();

      if(this.user.sub != this.booking.userId && !this.user.sub.startsWith('guest')) {
        console.error('User does not match booking userId');
        this.router.navigate(['/']); 
        return;
      }
      this.loading = false;
    } catch (error) {
      console.error('Failed to fetch booking details:', error);
    }
  }

  formatParty(partyInfo: Record<string, number>) {
    if (!partyInfo || typeof partyInfo !== 'object') {
      console.warn('Invalid partyInfo:', partyInfo);
      return 0;
    }
    
    const partyKeys = Object.keys(partyInfo);
    let totalParty = 0;
    for (const partyKey of partyKeys) {
      totalParty += partyInfo[partyKey];
    }
    return totalParty;
  }

  calculateNights(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  navigate(bookingId: string): void {
    this.router.navigate(
      ['/account/bookings/cancel', bookingId], {}
    );
  }
}
