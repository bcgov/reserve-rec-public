import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingService } from '../services/booking.service';
import { ApiService } from '../services/api.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-payment-retry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-retry.component.html',
  styleUrl: './payment-retry.component.scss'
})
export class PaymentRetryComponent implements OnInit {
  bookingId = signal<string>('');
  sessionId = signal<string>('');
  email = signal<string>('');
  errorMessage = signal<string>('');
  isProcessing = signal<boolean>(false);
  booking = signal<any>(null);
  bookingError = signal<string>('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.bookingId.set(params['bookingId'] || '');
      this.sessionId.set(params['sessionId'] || '');
      this.email.set(params['email'] || '');
      this.errorMessage.set(params['error'] || 'Payment was not completed');
      
      if (this.bookingId()) {
        this.loadBooking();
      } else {
        this.bookingError.set('No booking ID provided');
      }
    });
  }

  async loadBooking() {
    try {
      const response: any = await lastValueFrom(
        this.apiService.get(`bookings/${this.bookingId()}`, {})
      );
      this.booking.set(response?.data);
      
      // Check if booking is still valid
      if (response?.data?.bookingStatus === 'confirmed') {
        this.bookingError.set('This booking has already been paid.');
      } else if (response?.data?.bookingStatus === 'cancelled') {
        this.bookingError.set('This booking has been cancelled.');
      } else if (response?.data?.sessionExpiry) {
        const expiryTime = new Date(response.data.sessionExpiry).getTime();
        const now = Date.now();
        if (now > expiryTime) {
          this.bookingError.set('Your booking session has expired. Please create a new booking.');
        }
      }
    } catch (error: any) {
      console.error('Error loading booking:', error);
      if (error?.status === 404) {
        this.bookingError.set('Booking not found.');
      } else {
        this.bookingError.set('Unable to load booking details. Please try again.');
      }
    }
  }

  async retryPayment() {
    if (!this.bookingId() || !this.sessionId() || this.isProcessing() || this.bookingError()) {
      return;
    }
    
    this.isProcessing.set(true);
    
    try {
      const body = {
        trnAmount: this.booking()?.feeInformation?.total || 0,
        bookingId: this.bookingId(),
        sessionId: this.sessionId(),
        email: this.email()
      };
      
      const response: any = await lastValueFrom(
        this.apiService.post('transactions', body, {})
      );
      const transactionUrl = response?.data?.response?.transaction?.data?.transactionUrl;
      
      if (transactionUrl) {
        // Redirect to Worldline payment page
        window.location.href = transactionUrl;
      } else {
        throw new Error('No transaction URL returned');
      }
    } catch (error: any) {
      console.error('Error retrying payment:', error);
      
      if (error?.error?.message?.includes('expired')) {
        this.bookingError.set('Your booking session has expired. Please create a new booking.');
      } else if (error?.error?.message?.includes('Unauthorized')) {
        this.bookingError.set('You do not have permission to pay for this booking.');
      } else {
        alert('Failed to retry payment. Please try again or contact support.');
      }
      this.isProcessing.set(false);
    }
  }

  async cancelBooking() {
    if (!this.bookingId() || this.isProcessing()) {
      return;
    }
    
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    
    this.isProcessing.set(true);
    
    try {
      await lastValueFrom(
        this.bookingService.cancelBooking(this.bookingId())
      );
      alert('Booking cancelled successfully.');
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking. Please contact support.');
      this.isProcessing.set(false);
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
