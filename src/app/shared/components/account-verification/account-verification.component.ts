import { Component, ChangeDetectorRef, EventEmitter, Output, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService, ToastTypes } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';

const TIMEOUT = 60;

@Component({
  selector: 'app-account-verification',
  templateUrl: './account-verification.component.html',
  styleUrls: ['./account-verification.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule]
})

export class AccountVerificationComponent {
  @Output() emailVerified = new EventEmitter<boolean>();
  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  public verifyForm: FormGroup;
  public verificationEmailSent = false;
  public readonly digitControlNames = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
  public resendTimeout = TIMEOUT;

  constructor(
    private authService: AuthService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder
  ) {
    const groupConfig: Record<string, any> = {};
    this.digitControlNames.forEach(name => {
      groupConfig[name] = ['', [Validators.required, Validators.pattern('^[0-9]$')]];
    });
    this.verifyForm = this.fb.group(groupConfig);
  }

  // Handle single typing, auto-advance, and multi-digit auto-fill
  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Mobile OS Auto-fill dumps all 6 digits into the first input at once
    if (value.length > 1) {
      this.distributeCode(value);
      return;
    }

    // Single digit typed -> advance focus to next box
    if (value && index < 5) {
      this.digitInputs.toArray()[index + 1]?.nativeElement.focus();
    }
  }

  // Handle Backspace navigation across boxes
  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.verifyForm.get(this.digitControlNames[index])?.value && index > 0) {
      const prevInput = this.digitInputs.toArray()[index - 1]?.nativeElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
  }

  // Handle manual paste events
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text').trim() || '';
    this.distributeCode(pastedData);
  }

  // Distributes 6-digit code across form controls
  private distributeCode(code: string): void {
    // Strip non-numeric characters and limit to 6 digits
    const digits = code.replace(/\D/g, '').slice(0, 6).split('');

    // Clear all inputs first so we don't leave stale digits behind
    this.digitControlNames.forEach(name => {
      this.verifyForm.get(name)?.setValue('', { emitEvent: false });
    });

    // Distribute the new digits
    digits.forEach((digit, i) => {
      this.verifyForm.get(this.digitControlNames[i])?.setValue(digit);
    });

    // Focus the correct box (the last filled box, or the end)
    // If digits.length is 6, we want to focus index 5 (the last box).
    const targetIndex = digits.length > 0 ? Math.min(digits.length, 5) : 0;

    // Use setTimeout to allow Angular to finish rendering the formControl updates
    // before we force focus on the DOM element. This (supposedly) solves a common iOS glitch.
    setTimeout(() => {
      this.digitInputs.toArray()[targetIndex]?.nativeElement.focus();
    }, 0);

    this.cdr.detectChanges();
  }

  countdown() {
    if (this.resendTimeout > 0) {
      setTimeout(() => {
        this.resendTimeout--;
        this.countdown();
      }, 1000);
    }
  }

  async onConfirmVerificationCode(): Promise<void> {
    if (this.verifyForm.invalid) return;

    // Combine form controls into a single 6-digit string
    const verificationCode = Object.values(this.verifyForm.value).join('');

    try {
      const result = await this.authService.handleConfirmAttributeCode(verificationCode);
      if (result) {
        this.toastService.addMessage('Your email has been successfully verified.', 'Email verified', ToastTypes.SUCCESS);
        this.emailVerified.emit(true);
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      this.toastService.addMessage('Failed to verify email. Please try again later.', 'Error', ToastTypes.ERROR);
      this.cdr.detectChanges();
    }
  }

  async resendVerification(): Promise<void> {
    try {
      await this.authService.handleResendAttributeCodeToEmail();
      this.toastService.addMessage('Verification email sent. Please check your inbox.', 'Email sent', ToastTypes.SUCCESS);
      this.verificationEmailSent = true;
    } catch (error) {
      console.error('Error resending email:', error);
      this.toastService.addMessage('Failed to send verification email. Please try again.', 'Error', ToastTypes.ERROR);
    } finally {
      this.resendTimeout = TIMEOUT;
      this.countdown();
      this.cdr.detectChanges();
    }
  }
}
