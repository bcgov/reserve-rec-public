import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PolicyAccordionsComponent } from './policy-accordions.component';

describe('PolicyAccordionsComponent', () => {
  let component: PolicyAccordionsComponent;
  let fixture: ComponentFixture<PolicyAccordionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolicyAccordionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PolicyAccordionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
