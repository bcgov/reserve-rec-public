import { BookingMainCardComponent } from "./bookings-main-card.component";
import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";

describe('BookingMainCardComponent', () => {
  let component: BookingMainCardComponent;
  let fixture: ComponentFixture<BookingMainCardComponent>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [
      CommonModule,
      BookingMainCardComponent
    ],
    providers: [
      { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) }
    ]
  });

    fixture = TestBed.createComponent(BookingMainCardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate with correct state', () => {
    const mapObj = { some: 'value' };
    const bookingId = 'abc123';

    component.navigate(bookingId, mapObj);

    expect(router.navigate).toHaveBeenCalledWith(
      ['/booking-details', bookingId],
      { state: { mapObj } }
    );
  });
});
