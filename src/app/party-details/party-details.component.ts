import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';

@Component({
  selector: 'app-party-details',
  imports: [NgdsFormsModule],
  templateUrl: './party-details.component.html',
  styleUrl: './party-details.component.scss'
})
export class PartyDetailsComponent implements AfterViewInit {
  @Input() occupantsForm;
  @Output() occupantsFormChange: EventEmitter<UntypedFormGroup> = new EventEmitter<UntypedFormGroup>();

  constructor(
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.occupantsForm?.valueChanges.subscribe(() => {
      this.changeDetectorRef.detectChanges();
      this.occupantsFormChange.emit(this.occupantsForm.value);
    });
  }

  ngAfterViewInit(): void {
    // Ensure the change detection runs after the view is initialized
    this.occupantsForm.setValue(this.occupantsForm.value);
    this.changeDetectorRef.detectChanges();
  }

  getTotalOccupants() {
    let total = 0;
    for (const control in this.occupantsForm?.['controls']) {
      if (this.occupantsForm?.['controls'][control]?.value) {
        total += this.occupantsForm?.['controls'][control]?.value;
      }
    }
    return total;
  }

  increment(field, value) {
    const currentValue = this.occupantsForm.get(field)?.value;
    const totalOccupants = this.getTotalOccupants();
    if (value < 0 && totalOccupants + value >= 0) {
      // Prevent decrementing below zero
      this.occupantsForm?.get(field)?.setValue(currentValue + value);
    }
    if (value > 0 && totalOccupants + value <= 10) {
      // Prevent incrementing above 10
      this.occupantsForm?.get(field)?.setValue(currentValue + value);
    }
  }

}
