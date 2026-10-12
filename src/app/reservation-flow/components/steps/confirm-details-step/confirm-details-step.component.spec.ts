import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { CartItemComponent } from '../../../../cart/cart-item/cart-item.component';
import { CartItem } from '../../../../services/cart.service';
import { StepperService } from '../../../services/stepper.service';
import { ConfirmDetailsStepComponent } from './confirm-details-step.component';

@Component({
  selector: 'app-cart-item',
  standalone: true,
  template: ''
})
class MockCartItemComponent {
  @Input() item: CartItem | null = null;
}

describe('ConfirmDetailsStepComponent', () => {
  let fixture: ComponentFixture<ConfirmDetailsStepComponent>;
  let form: FormGroup;

  beforeEach(async () => {
    const stepperService = jasmine.createSpyObj<StepperService>('StepperService', ['markStepValid']);

    await TestBed.configureTestingModule({
      imports: [ConfirmDetailsStepComponent],
      providers: [{ provide: StepperService, useValue: stepperService }]
    })
      .overrideComponent(ConfirmDetailsStepComponent, {
        remove: { imports: [CartItemComponent] },
        add: { imports: [MockCartItemComponent] }
      })
      .compileComponents();

    form = new FormGroup({ acknowledgeDetails: new FormControl(false) });
    fixture = TestBed.createComponent(ConfirmDetailsStepComponent);
    fixture.componentInstance.form = form;
    fixture.detectChanges();
  });

  it('toggles the acknowledgement form control when its visible text is clicked', () => {
    const checkbox = fixture.nativeElement.querySelector('#acknowledgeDetails') as HTMLInputElement;
    const visibleText = fixture.nativeElement.querySelector('.form-check-label') as HTMLElement;

    expect(form.get('acknowledgeDetails')?.value).toBeFalse();
    expect(checkbox.checked).toBeFalse();

    visibleText.click();
    fixture.detectChanges();

    expect(form.get('acknowledgeDetails')?.value).toBeTrue();
    expect(checkbox.checked).toBeTrue();

    visibleText.click();
    fixture.detectChanges();

    expect(form.get('acknowledgeDetails')?.value).toBeFalse();
    expect(checkbox.checked).toBeFalse();
  });
});
