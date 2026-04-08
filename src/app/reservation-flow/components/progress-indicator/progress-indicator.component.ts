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
    const currentItemProgress = this.currentStepIndex / 3; // Changed from 5 to 3 steps
    return Math.round(((completedItems + currentItemProgress) / this.totalItems) * 100);
  }

  // Payment step is not included in the 3-step flow
  isPaymentStep(stepIndex: number): boolean {
    return false; // No payment step in current flow
  }

  canAccessPayment(): boolean {
    return false; // No payment step in current flow
  }

  getStepClasses(step: StepConfig): string {
    return step.isActive ? 'bg-white border border-2 border-primary' : 'bg-light';
  }

  getStepBadgeClasses(step: StepConfig, index: number): string {
    if (this.isStepCompletedForCurrentItem(step, index)) return 'bg-success text-white';
    if (step.isActive) return 'bg-primary text-white';
    return 'bg-secondary text-white';
  }

  getStepTitle(step: StepConfig, index: number): string {
    return step.title;
  }

  getStepDescription(step: StepConfig, index: number): string | null {
    return step.description || null;
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
    this.stepperService.goToStep(stepIndex);
  }

  switchToItem(index: number): void {
    this.itemSwitched.emit(index);
  }

  isStepCompletedForCurrentItem(step: StepConfig, stepIndex: number): boolean {
    const currentItem = this.queueItems[this.currentItemIndex];
    if (!currentItem) return false;

    // Updated to 3 steps (removed step2 - policy review, step5 - payment)
    const stepCompletionMap = [
      currentItem.detailsStepCompleted,  // Step 1: Details
      currentItem.visitorDetailsStepCompleted,  // Step 2: Visitor Details
      currentItem.equipmentStepCompleted,  // Step 3: Equipment
    ];

    return stepCompletionMap[stepIndex] || false;
  }
}