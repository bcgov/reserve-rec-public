import { TestBed } from '@angular/core/testing';

import { StepperService } from './stepper.service';
import { FeatureFlagService } from '../../services/feature-flag.service';

describe('StepperService', () => {
  const createService = (paymentsEnabled: boolean): StepperService => {
    TestBed.configureTestingModule({
      providers: [{
        provide: FeatureFlagService,
        useValue: { isEnabled: () => paymentsEnabled }
      }]
    });
    return TestBed.inject(StepperService);
  };

  it('does not allow advancing from Equipment when Payment is disabled', () => {
    const service = createService(false);
    service.markStepValid(2, true);
    service.currentStepIndex.set(2);

    expect(service.getSteps().length).toBe(3);
    expect(service.canGoNext()).toBeFalse();
  });

  it('allows advancing from Equipment to Payment when Payment is enabled', () => {
    const service = createService(true);
    service.markStepValid(2, true);
    service.currentStepIndex.set(2);

    expect(service.getSteps().length).toBe(4);
    expect(service.canGoNext()).toBeTrue();

    service.currentStepIndex.set(3);
    service.markStepValid(3, true);
    expect(service.canGoNext()).toBeFalse();
  });
});
