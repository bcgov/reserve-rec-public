import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterContentChecked} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { BookingService } from '../services/booking.service';
import { Utils } from '../utils/utils';

@Component({
  selector: 'app-find-booking',
  imports: [CommonModule, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './find-booking.component.html',
  styleUrls: ['./find-booking.component.scss']
})
export class FindBookingComponent implements OnInit, AfterContentChecked, OnDestroy {

  public form: UntypedFormGroup;
  public isLoading = false;
  public errorMessage: string | null = null;

  constructor(
    private bookingService: BookingService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.form = new UntypedFormGroup({
      email: new UntypedFormControl(null, [Validators.required, Validators.email]),
      bookingRef: new UntypedFormControl(null, [Validators.required]),
    });
  }

  ngAfterContentChecked(): void {
    this.changeDetectorRef.detectChanges();
  }

  async findBooking(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const email = this.form.get('email')?.value?.toLowerCase().trim();
      const bookingRef = this.form.get('bookingRef')?.value?.trim();

      const bookingData = await this.bookingService.getBookingByGlobalIdAndEmail(
        bookingRef,
        email,
        true
      );

      const bookingId = (bookingData as any)?.data.bookingId;
      const mapObj = Utils.formatMapCoords((bookingData as any)?.data);

      await this.router.navigate(
        ['/booking', bookingId],
        { queryParams: { email: email }, state: { mapObj } }
      );
      this.isLoading = false;
    } catch (error) {
      console.error('Error finding booking:', error);
      this.errorMessage = 'Booking not found. Please check your email and booking reference number.';
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.changeDetectorRef.detectChanges();
    this.changeDetectorRef.detach();
  }
}
