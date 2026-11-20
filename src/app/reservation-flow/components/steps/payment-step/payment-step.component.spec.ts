import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';

import { PaymentStepComponent } from './payment-step.component';
import { StepperService } from '../../../services/stepper.service';
import { ApiService } from '../../../../services/api.service';

describe('PaymentStepComponent', () => {
  let component: PaymentStepComponent;
  let apiService: jasmine.SpyObj<ApiService>;
  let checkoutInstance: { createToken: jasmine.Spy };

  const setValidCardDetails = (): void => {
    component.cardholderName = 'Test Cardholder';
    component.cardNumberComplete.set(true);
    component.cardExpiryComplete.set(true);
    component.cardCVVComplete.set(true);
  };

  beforeEach(() => {
    apiService = jasmine.createSpyObj<ApiService>('ApiService', ['post']);
    checkoutInstance = {
      createToken: jasmine.createSpy('createToken')
    };

    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new PaymentStepComponent(
      {} as StepperService,
      apiService,
      {} as ChangeDetectorRef
    ));

    component.cartItem = { feeInformation: { total: 25.5 } } as any;
    component.bookingId = 'booking-1';
    component.sessionId = 'session-1';
    component.user = {
      sub: 'user-1',
      given_name: 'Test',
      family_name: 'User',
      email: 'test@example.com',
      'custom:streetAddress': '1 Test Street',
      'custom:city': 'Victoria',
      'custom:province': 'British Columbia',
      'custom:postalCode': 'V8W 1A1',
      'custom:country': 'Canada',
      'custom:mobilePhone': '+12505550123',
    };
    (component as any).checkoutInstance = checkoutInstance;
    setValidCardDetails();
  });

  it('does not tokenize or submit when card details are invalid', () => {
    component.cardCVVComplete.set(false);

    component.onSubmit();

    expect(checkoutInstance.createToken).not.toHaveBeenCalled();
    expect(apiService.post).not.toHaveBeenCalled();
    expect(component.paymentError()).toContain('complete all card fields');
  });

  it('submits the booking total and emits completion after payment succeeds', () => {
    apiService.post.and.returnValue(of({ data: { response: { success: true } } }) as any);
    checkoutInstance.createToken.and.callFake((callback: (result: any) => void) => {
      callback({ token: 'token-1' });
    });

    const completed: boolean[] = [];
    const processing: boolean[] = [];
    component.stepCompleted.subscribe(value => completed.push(value));
    component.processingChange.subscribe(value => processing.push(value));

    component.onSubmit();

    expect(apiService.post).toHaveBeenCalledWith('transactions', jasmine.objectContaining({
      bookingId: 'booking-1',
      sessionId: 'session-1',
      trnAmount: 25.5,
      token: 'token-1',
      userId: 'user-1',
      cardholderName: 'Test Cardholder'
    }));
    expect(completed).toEqual([true]);
    expect(processing).toEqual([true, false]);
    expect(component.isProcessing()).toBeFalse();
    expect(component.paymentSucceeded()).toBeTrue();

    component.onSubmit();

    expect(checkoutInstance.createToken).toHaveBeenCalledTimes(1);
    expect(apiService.post).toHaveBeenCalledTimes(1);
  });

  it('allows another attempt when the transaction is declined', () => {
    apiService.post.and.returnValues(
      of({ success: false }) as any,
      of({ success: true }) as any
    );
    checkoutInstance.createToken.and.callFake((callback: (result: any) => void) => {
      callback({ token: 'token-1' });
    });

    component.onSubmit();
    component.onSubmit();

    expect(checkoutInstance.createToken).toHaveBeenCalledTimes(2);
    expect(apiService.post).toHaveBeenCalledTimes(2);
    expect(component.paymentSucceeded()).toBeTrue();
  });

  it('uses the Cognito profile for the account billing address', () => {
    component.user = {
      sub: 'user-1',
      given_name: 'Ada',
      family_name: 'Lovelace',
      email: 'ada@example.com',
      'custom:streetAddress': '12 Main Street',
      'custom:unitNumber': 'Unit 4',
      'custom:city': 'Victoria',
      'custom:province': 'British Columbia',
      'custom:postalCode': 'V8W 1A1',
      'custom:country': 'Canada',
      'custom:mobilePhone': '+12505550123',
    };
    apiService.post.and.returnValue(of({ success: true }) as any);
    checkoutInstance.createToken.and.callFake((callback: (result: any) => void) => {
      callback({ token: 'token-1' });
    });

    component.onSubmit();

    expect(apiService.post).toHaveBeenCalledWith('transactions', jasmine.objectContaining({
      billingName: 'Ada Lovelace',
      email: 'ada@example.com',
      address1: '12 Main Street',
      address2: 'Unit 4',
      city: 'Victoria',
      province: 'BC',
      postalCode: 'V8W 1A1',
      country: 'CA',
      phoneNumber: '+12505550123',
    }));
  });

  it('requires complete account billing details before tokenizing', () => {
    component.user = {
      sub: 'user-1',
      given_name: 'Ada',
      family_name: 'Lovelace',
      email: 'ada@example.com',
    };

    component.onSubmit();

    expect(checkoutInstance.createToken).not.toHaveBeenCalled();
    expect(apiService.post).not.toHaveBeenCalled();
    expect(component.paymentError()).toContain('billing information');
  });

  it('requires valid separate billing details before tokenizing', () => {
    component.billingAddressOption = 'different';
    component.alternateBillingDetails = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'not-an-email',
      address1: '12 Main Street',
      address2: '',
      city: 'Victoria',
      province: 'British Columbia',
      postalCode: 'V8W 1A1',
      country: 'Canada',
      phoneNumber: '+12505550123',
    };

    component.onSubmit();

    expect(checkoutInstance.createToken).not.toHaveBeenCalled();
    expect(apiService.post).not.toHaveBeenCalled();
    expect(component.paymentError()).toContain('billing information');
  });

  it('submits independently entered billing details when selected', () => {
    component.billingAddressOption = 'different';
    component.alternateBillingDetails = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      address1: '12 Main Street',
      address2: 'Unit 4',
      city: 'Victoria',
      province: 'British Columbia',
      postalCode: 'V8W 1A1',
      country: 'Canada',
      phoneNumber: '+12505550123',
    };
    apiService.post.and.returnValue(of({ success: true }) as any);
    checkoutInstance.createToken.and.callFake((callback: (result: any) => void) => {
      callback({ token: 'token-1' });
    });

    component.onSubmit();

    expect(apiService.post).toHaveBeenCalledWith('transactions', jasmine.objectContaining({
      billingName: 'Ada Lovelace',
      email: 'ada@example.com',
      address1: '12 Main Street',
      province: 'BC',
      country: 'CA',
      phoneNumber: '+12505550123',
      cardholderName: 'Test Cardholder',
    }));
  });

  it('clears processing state and reports tokenization errors', () => {
    checkoutInstance.createToken.and.callFake((callback: (result: any) => void) => {
      callback({ error: { message: 'Invalid card' } });
    });
    const processing: boolean[] = [];
    component.processingChange.subscribe(value => processing.push(value));

    component.onSubmit();

    expect(processing).toEqual([true, false]);
    expect(component.isProcessing()).toBeFalse();
    expect(component.paymentError()).toBe('Invalid card');
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('clears processing state when the transaction request fails', () => {
    apiService.post.and.returnValue(throwError(() => ({
      error: { message: 'Transaction rejected' }
    })) as any);
    checkoutInstance.createToken.and.callFake((callback: (result: any) => void) => {
      callback({ token: 'token-1' });
    });
    const processing: boolean[] = [];
    component.processingChange.subscribe(value => processing.push(value));

    component.onSubmit();

    expect(processing).toEqual([true, false]);
    expect(component.isProcessing()).toBeFalse();
    expect(component.paymentError()).toBe('Transaction rejected');
  });

  it('ignores repeated submits while tokenization is in progress', () => {
    component.onSubmit();
    component.onSubmit();

    expect(checkoutInstance.createToken).toHaveBeenCalledTimes(1);
    expect(component.isProcessing()).toBeTrue();
  });
});
