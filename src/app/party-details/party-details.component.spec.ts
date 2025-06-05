import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartyDetailsComponent } from './party-details.component';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';

const mockupantsForm = new UntypedFormGroup({
  totalAdult: new UntypedFormControl(0),
  totalSenior: new UntypedFormControl(0),
  totalYouth: new UntypedFormControl(0),
  totalChild: new UntypedFormControl(0),
});

describe('PartyDetailsComponent', () => {
  let component: PartyDetailsComponent;
  let fixture: ComponentFixture<PartyDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartyDetailsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PartyDetailsComponent);
    component = fixture.componentInstance;
    component.occupantsForm = mockupantsForm;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
