import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BookingMapComponent } from '../../booking-map/booking-map.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-booking-details',
  templateUrl: './booking-details.component.html',
  styleUrls: ['./booking-details.component.scss'],
  imports: [CommonModule, BookingMapComponent, RouterModule],
})
export class BookingDetailsComponent implements OnInit {
  booking: any = null;
  mapObj: any = null;
  user: any = null;
  startDate = '';
  endDate = '';
  bookedDate = '';
  viewMap = true;
  zoomValue = 12;

  
constructor(
  private apiService: ApiService,
  private route: ActivatedRoute,
  private authService: AuthService,
  private router: Router
) {}
  async ngOnInit() {
    try {
      const bookingId = this.route.snapshot.paramMap.get('id');
      const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`));
      this.booking = res.data;
      this.booking.nights = this.calculateNights(this.booking.startDate, this.booking.endDate);
      this.booking.totalParty = this.formatParty(this.booking.partyInformation);
      this.mapObj = this.formatMapCoords(this.booking);
      this.user = this.authService.getCurrentUser();

      if(this.user.sub != this.booking.user){
        console.error('User does not match booking user');
        this.router.navigate(['/']); 
        return;
      }

    } catch (error) {
      console.error('Failed to fetch booking details:', error);
    }
  }

  formatParty(partyInfo: Record<string, number>) {
    const partyKeys = Object.keys(partyInfo)
    let totalParty = 0;
    for (const partyKey of partyKeys) {
      totalParty += partyInfo[partyKey];
    }
    return totalParty;
  }

  formatMapCoords(item: { sk: any; entryPoint: any; coordinates: any; location: { type: any; }; }) {
    return {
      _id: item.sk,
      displayName: item.entryPoint,
      imageUrl: "",
      coordinates: item.coordinates,
      type: item.location.type,
      location: item.location
    };
  }

  calculateNights(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

}