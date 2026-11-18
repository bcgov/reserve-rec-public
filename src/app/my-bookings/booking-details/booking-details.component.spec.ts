import { BookingDetailsComponent } from './booking-details.component';

describe('BookingDetailsComponent', () => {
  const component = new BookingDetailsComponent(null as any, null as any, null as any, null as any);

  // Only a paid payment gets the "Total paid" card; older transactions use transactionStatus.
  it('isPaid only for paid payments', () => {
    const cases: [any, boolean][] = [
      [{ status: 'paid' }, true],
      [{ transactionStatus: 'paid' }, true],
      [{ status: 'failed' }, false],
      [{ status: 'refunded' }, false],
      [null, false],
    ];
    for (const [payment, expected] of cases) {
      component.payment = payment;
      expect(component.isPaid()).withContext(JSON.stringify(payment)).toBe(expected);
    }
  });
});
