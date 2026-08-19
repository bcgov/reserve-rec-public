import { Component, ChangeDetectorRef, EventEmitter, Output, ViewChildren, QueryList, ElementRef, AfterViewChecked } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService, ToastTypes } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';

const TIMEOUT = 60;

@Component({
  selector: 'app-account-verification',
  templateUrl: './account-verification.component.html',
  styleUrls: ['./account-verification.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, NgdsFormsModule]
})

export class AccountVerificationComponent implements AfterViewChecked {
  @Output() emailVerified = new EventEmitter<boolean>();
  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  public verifyForm: FormGroup;
  public verificationEmailSent = false;
  public resendTimeout = TIMEOUT;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.verifyForm = this.fb.group({
      number: ['', [
        Validators.pattern(/^\d{6}$/)
      ]]
    });
  }

  // TODO: this is a temporary fix to error prevent error message stacking
  ngAfterViewChecked(): void {
    this.cdr.detectChanges()
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
