import { TestBed } from '@angular/core/testing';

import { ConfirmationModalComponent } from './confirmation-modal.component';

describe('ConfirmationModalComponent', () => {
  it('renders each note as its own paragraph after the body', () => {
    const fixture = TestBed.createComponent(ConfirmationModalComponent);
    fixture.componentRef.setInput('body', 'Confirm remove this booking from your cart?');
    fixture.componentRef.setInput('notes', ['First note.', 'Second note.']);
    fixture.detectChanges();

    const paragraphs = Array.from(fixture.nativeElement.querySelectorAll('.modal-body p'))
      .map((p: any) => p.textContent.trim());
    expect(paragraphs).toEqual(['Confirm remove this booking from your cart?', 'First note.', 'Second note.']);
  });
});
