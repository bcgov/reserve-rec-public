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
        this.router.navigate(['/booking-confirmation', response?.ref1]);
      } else {
        // TODO: if fails, redirect to checkout with sessionIds
        console.log('Redirecting to home...');
        this.router.navigate(['/']);
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
