import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlphaPageComponent } from './alpha-page.component';

describe('AlphaPageComponent', () => {
  let component: AlphaPageComponent;
  let fixture: ComponentFixture<AlphaPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlphaPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlphaPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
