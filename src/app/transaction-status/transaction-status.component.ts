import { Component, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../services/loading.service';
import { Constants } from '../constants';
import { BookingService } from '../services/booking.service';

@Component({
  selector: 'app-transaction-status',
  imports: [CommonModule],
  templateUrl: './transaction-status.component.html',
  styleUrl: './transaction-status.component.scss'
})
export class TransactionStatusComponent {
  public queryResponse: any;
  public _queryResponseSignal = signal<any>(null);
  private lastProcessedResponse: any = null;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected apiService: ApiService,
    protected bookingService: BookingService,
    protected loadingService: LoadingService
  ) {
    const params = this.route.snapshot.queryParams;
    const clientTransactionId = params['trnOrderNumber'];
    const sessionId = params['ref2'];
    this.queryTransaction(clientTransactionId, sessionId);
  }

  transactionEffect = effect(() => {
    const response = this._queryResponseSignal();
    if (response && response !== this.lastProcessedResponse) {
      this.queryResponse = response;
      this.lastProcessedResponse = response;

      // If transaction comes back as paid and the booking is complete, continue
      if (response?.trnApproved == 1) {
        // Pass all query params to booking confirmation
        const queryParams = this.route.snapshot.queryParams;
        this.router.navigate(['/booking-confirmation', response?.ref1], { 
          queryParams: queryParams 
        });
      } else {
        // Payment failed - redirect to payment retry page with booking info
        const bookingId = response?.ref1 || this.route.snapshot.queryParams['ref1'];
        const sessionId = response?.ref2 || this.route.snapshot.queryParams['ref2'];
        const email = response?.ref3 || this.route.snapshot.queryParams['ref3'];
        const errorMsg = response?.messageText || 'Payment was not completed';
        
        console.log('Payment failed, redirecting to payment-retry page...');
        
        // Preserve booking info for retry (don't clear cart yet)
        if (bookingId) {
          sessionStorage.setItem('failedBookingId', bookingId);
        }
        
        this.router.navigate(['/payment-retry'], {
          queryParams: {
            bookingId: bookingId,
            sessionId: sessionId,
            email: email,
            error: errorMsg
          }
        });
      }
    }
  });

  async queryTransaction(clientTransactionId: string, sessionId: string) {
    try {
      this.loadingService.addToFetchList(Constants.dataIds.TRANSACTION_STATUS_RESULTS);
      const queryParams = {
        clientTransactionId,
        sessionId
      };
      const res: any = await lastValueFrom(
        this.apiService.get(`transactions`, queryParams)
      );
      console.log('Transaction res:', res);
      this._queryResponseSignal.set(res?.data);
    } catch (error) {
      console.error('Failed to query transaction details:', error);
    } finally {
      this.loadingService.removeFromFetchList(Constants.dataIds.TRANSACTION_STATUS_RESULTS);
    }
  }
}
