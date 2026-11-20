import { ChangeDetectorRef, ElementRef, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { ReservationFlowComponent } from './reservation-flow.component';
import { CartItem, CartService } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { BookingService } from '../services/booking.service';
import { FeatureFlagService } from '../services/feature-flag.service';
import { StepperService } from './services/stepper.service';

describe('ReservationFlowComponent', () => {
  const createCartItem = (): CartItem => ({
    id: 'item-1',
    geozoneName: 'Test Park',
    activityId: 'activity-1',
    activityName: 'Test Activity',
    collectionId: 'collection-1',
    activityType: 'dayuse',
    dateRange: ['2026-11-06', '2026-11-06'],
    startDate: '2026-11-06',
    endDate: '2026-11-06',
    namedOccupant: { firstName: 'Test', lastName: 'User' },
    occupants: { totalAdult: 1, totalSenior: 0, totalYouth: 0, totalChild: 0 },
    vehicleInformation: [{ licensePlate: '', licensePlateRegistrationRegion: '' }],
    feeInformation: { registrationFees: 0, transactionFees: 0, tax: 0, total: 25 },
    detailsStepCompleted: true,
    visitorDetailsStepCompleted: true,
    equipmentStepCompleted: true,
    paymentStepCompleted: false,
    areAllStepsCompleted: false,
    bookingId: 'booking-1',
    sessionId: 'session-1'
  });

  const createFlow = (currentStep: number, paymentsEnabled: boolean) => {
    const item = createCartItem();
    const stepperService = {
      currentStepIndex: signal(currentStep),
      currentStep$: new BehaviorSubject({} as any),
      canGoNext: jasmine.createSpy('canGoNext').and.returnValue(currentStep < 3),
      goNext: jasmine.createSpy('goNext').and.returnValue(true),
      getCurrentStep: jasmine.createSpy('getCurrentStep').and.returnValue({ isValid: true }),
    };
    const cartService = {
      items: () => [item],
      updateCartItem: jasmine.createSpy('updateCartItem'),
      cartTimerIsActive: signal(true)
    };
    const bookingService = jasmine.createSpyObj<BookingService>('BookingService', ['completeBooking']);
    bookingService.completeBooking.and.resolveTo({});
    const featureFlagService = {
      isEnabled: jasmine.createSpy('isEnabled').and.returnValue(paymentsEnabled)
    };
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const changeDetectorRef = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    const elementRef = { nativeElement: { remove: jasmine.createSpy('remove') } };
    const authService = { getCurrentUser: () => ({ sub: 'user-1' }) };

    const component = new ReservationFlowComponent(
      changeDetectorRef,
      elementRef as unknown as ElementRef,
      router,
      stepperService as unknown as StepperService,
      cartService as unknown as CartService,
      authService as unknown as AuthService,
      bookingService,
      featureFlagService as unknown as FeatureFlagService
    );
    component.cartItems = [item];
    const redirect = spyOn(component as any, 'redirectToConfirmation');

    return { component, item, stepperService, cartService, bookingService, redirect };
  };

  it('finalizes and redirects after Equipment when payment is not required', async () => {
    const { component, bookingService, redirect } = createFlow(2, false);

    await component.onStepCompleted(true);

    expect(bookingService.completeBooking).toHaveBeenCalledWith(
      'booking-1',
      jasmine.objectContaining({ sessionId: 'session-1' })
    );
    expect(redirect).toHaveBeenCalledOnceWith('booking-1');
  });

  it('advances to Payment from Equipment when a positive payment is required', async () => {
    const { component, stepperService, bookingService, item } = createFlow(2, true);

    await component.onStepCompleted(true);

    expect(item.equipmentStepCompleted).toBeTrue();
    expect(stepperService.goNext).toHaveBeenCalled();
    expect(bookingService.completeBooking).not.toHaveBeenCalled();
  });

  it('redirects after successful payment without completing the booking twice', async () => {
    const { component, item, bookingService, redirect, cartService } = createFlow(3, true);
    component.currentBookingId = item.bookingId;

    await component.onStepCompleted(true);

    expect(item.paymentStepCompleted).toBeTrue();
    expect(component.canProceed()).toBeFalse();
    expect(bookingService.completeBooking).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledOnceWith('booking-1');
    expect(cartService.cartTimerIsActive()).toBeFalse();
  });

  it('delegates Finish on the Payment step to the payment component', () => {
    const { component } = createFlow(3, true);
    const onSubmit = jasmine.createSpy('onSubmit');
    (component as any).paymentStepComponent = { onSubmit };

    component.proceedToNext();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(component.isSubmitting).toBeFalse();
  });
});
