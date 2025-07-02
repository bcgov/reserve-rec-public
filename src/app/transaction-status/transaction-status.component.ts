import { Component, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../services/loading.service';
import { Constants } from '../constants';
import { BookingService } from '../services/booking.service';

const TRANSACTION_PARAMS = [
  'trnId', 'messageId', 'messageText', 'authCode', 'responseType',
  'trnAmount', 'trnDate', 'trnOrderNumber', 'trnLanguage',
  'trnCustomerName', 'trnEmailAddress', 'trnPhoneNumber', 'avsProcessed',
  'avsId', 'avsResult', 'avsAddrMatch', 'avsPostalMatch', 'avsMessage',
  'cvdId', 'cardType', 'trnType', 'paymentMethod',
  'ref1', 'ref2', 'ref3', 'ref4', 'ref5', 'hashValue'
];

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
    this.route.queryParamMap.subscribe((params) => {
      const queryParams = this.parseQueryParams(params);
      this.queryTransaction(queryParams);
    });
  }

  transactionEffect = effect(() => {
    const response = this._queryResponseSignal();
    if (response && response !== this.lastProcessedResponse) {
      this.queryResponse = response;
      this.lastProcessedResponse = response;

      const transactionStatus = response?.transaction?.data?.status;
      const bookingStatus = response?.booking?.data?.bookingStatus;
      
      // If transaction comes back as paid and the booking is complete, continue
      if (transactionStatus === 'paid' && bookingStatus === 'completed') {
        this.router.navigate(['/booking-confirmation', response?.transaction?.data?.ref1]);
      } else {
        // TODO: if fails, redirect to checkout with sessionId
        // this.router.navigate(['/checkout'], { queryParams: { id: response?.transaction?.data?.ref2 } });
        console.log('Redirecting to home...');
        this.router.navigate(['/']);
      }
    }
  });

  private parseQueryParams(paramMap): Record<string, string | null> {
    return Object.fromEntries(
      TRANSACTION_PARAMS.map((param) => [param, paramMap.get(param)])
    );
  }

  async queryTransaction(queryParams: Record<string, string | null>) {
    try {
      this.loadingService.addToFetchList(Constants.dataIds.TRANSACTION_STATUS_RESULTS);
      const res: any = await lastValueFrom(
        this.apiService.put(`transactions`, {}, queryParams)
      );
      console.log('Transaction res:', res);
      this._queryResponseSignal.set(res.data?.response);
    } catch (error) {
      console.error('Failed to query transaction details:', error);
    } finally {
      this.loadingService.removeFromFetchList(Constants.dataIds.TRANSACTION_STATUS_RESULTS);
    }
  }
}
