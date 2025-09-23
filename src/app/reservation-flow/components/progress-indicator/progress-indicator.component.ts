import { Component, Input, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepperService, StepConfig } from '../../services/stepper.service';

@Component({
  selector: 'app-progress-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-indicator.component.html',
  styleUrl: './progress-indicator.component.scss'
})
export class ProgressIndicatorComponent {
  @Input() totalItems = 1;
  @Input() currentItemIndex = 0;
  @Input() currentItemName = '';
  @Input() queueItems: any[] = [];
  @Output() itemSwitched = new EventEmitter<number>();
  stepperService = inject(StepperService);

  get currentStepIndex(): number {
    return this.stepperService.currentStepIndex();
  }

  get overallProgressPercentage(): number {
    if (this.totalItems <= 1) return 0;
    const completedItems = this.currentItemIndex;
    const currentItemProgress = this.currentStepIndex / 5; 
    return Math.round(((completedItems + currentItemProgress) / this.totalItems) * 100);
  }

  isPaymentStep(stepIndex: number): boolean {
    return stepIndex === 4; 
  }

  canAccessPayment(): boolean {
    const currentItem = this.queueItems[this.currentItemIndex];
    if (!currentItem) return false;

    return (
      currentItem.step1Completed &&
      currentItem.step2Completed &&
      currentItem.step3Completed &&
      currentItem.step4Completed
    );
  }

  getStepClasses(step: StepConfig, index: number): string {
    return step.isActive ? 'bg-white border border-2 border-primary' : 'bg-light';
  }

  getStepBadgeClasses(step: StepConfig, index: number): string {
    if (this.isStepCompletedForCurrentItem(step, index)) return 'bg-success text-white';
    if (step.isActive) return 'bg-primary text-white';
    if (this.isPaymentStep(index)) return 'bg-warning text-dark';
    return 'bg-secondary text-white';
  }

  getStepTitle(step: StepConfig, index: number): string {
    return this.isPaymentStep(index) && this.totalItems > 1
      ? 'Payment (All Items)'
      : step.title;
  }

  getStepDescription(step: StepConfig, index: number): string | null {
    return this.isPaymentStep(index) && this.totalItems > 1
      ? `Pay for ${this.totalItems} items`
      : step.description || null;
  }

  getQueueItemBadgeClasses(index: number): string {
    const item = this.queueItems[index];
    if (item.areAllStepsCompleted) return 'bg-success';
    if (index === this.currentItemIndex) return 'bg-primary';
    return index > this.currentItemIndex ? 'bg-secondary' : 'bg-danger';
  }

  getQueueItemStatus(index: number): string {
    const item = this.queueItems[index];
    if (item.areAllStepsCompleted) return 'Completed';
    if (index === this.currentItemIndex) return 'In Progress';
    return index > this.currentItemIndex ? 'Pending' : 'Not Complete';
  }

  onStepClick(stepIndex: number): void {
    if (this.isPaymentStep(stepIndex) && !this.canAccessPayment()) {
      return;
    }
    this.stepperService.goToStep(stepIndex);
  }

  switchToItem(index: number): void {
    this.itemSwitched.emit(index);
  }

  isStepCompletedForCurrentItem(step: StepConfig, stepIndex: number): boolean {
    const currentItem = this.queueItems[this.currentItemIndex];
    if (!currentItem) return false;

    const stepCompletionMap = [
      currentItem.step1Completed,
      currentItem.step2Completed,
      currentItem.step3Completed,
      currentItem.step4Completed,
      currentItem.step5Completed,
    ];

    return stepCompletionMap[stepIndex] || false;
  }
}