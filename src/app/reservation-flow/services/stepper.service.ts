import { Injectable, signal, WritableSignal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  isValid: boolean;
  isActive: boolean;
  canNavigateTo: boolean;
}

export interface CartItemProgress {
  id: string | number;
  bookingConfirmed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StepperService {
  private cartItemProgress: Map<string | number, CartItemProgress> = new Map<string | number, CartItemProgress>();
  private completedSteps: Map<string | number, Set<number>> = new Map<string | number, Set<number>>();
  private currentCartItemId: string | number | null = null;
  private isTransitioning = false;

  private readonly steps: StepConfig[] = [
    {
      id: 'confirm-details',
      title: 'Confirm Details',
      description: 'Entry/exit points and activity details',
      isCompleted: false,
      isValid: false,
      isActive: true,
      canNavigateTo: true
    },
    {
      id: 'policy-review',
      title: 'Policy Review',
      description: 'Review and accept policies',
      isCompleted: false,
      isValid: false,
      isActive: false,
      canNavigateTo: false
    },
    {
      id: 'camping-party',
      title: 'Camping Party',
      description: 'Party details and occupants',
      isCompleted: false,
      isValid: false,
      isActive: false,
      canNavigateTo: false
    },
    {
      id: 'equipment',
      title: 'Equipment',
      description: 'Equipment and additional needs',
      isCompleted: false,
      isValid: false,
      isActive: false,
      canNavigateTo: false
    },
    {
      id: 'payment',
      title: 'Review & Payment',
      description: 'Final review and payment processing',
      isCompleted: false,
      isValid: false,
      isActive: false,
      canNavigateTo: false
    }
  ];

  public currentStepIndex = signal(0);
  public stepsSignal: WritableSignal<StepConfig[]> = signal([...this.steps]);
  public currentStep$ = new BehaviorSubject<StepConfig>(this.steps[0]);

  constructor() {
    this.updateCurrentStep();
  }

  setCurrentCartItem(itemId: string | number): void {
    this.currentCartItemId = itemId;
  }

  getCurrentStep(): StepConfig {
    return this.stepsSignal()[this.currentStepIndex()];
  }

  getSteps(): StepConfig[] {
    return this.stepsSignal();
  }

  canGoNext(): boolean {
    const currentStep = this.getCurrentStep();
    return currentStep.isValid && this.currentStepIndex() < this.steps.length - 1;
  }

  canGoPrevious(): boolean {
    return this.currentStepIndex() > 0;
  }

  goNext(): boolean {
    if (this.isTransitioning || !this.canGoNext()) {
      return false;
    }
    
    this.isTransitioning = true;
    this.markStepCompleted(this.currentStepIndex());
    this.currentStepIndex.set(this.currentStepIndex() + 1);
    this.updateStepNavigation();
    this.updateCurrentStep();
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, 50);
    
    return true;
  }

  goPrevious(): boolean {
    if (this.isTransitioning || !this.canGoPrevious()) {
      return false;
    }
    
    this.isTransitioning = true;
    this.currentStepIndex.set(this.currentStepIndex() - 1);
    this.updateStepNavigation();
    this.updateCurrentStep();
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, 50);
    
    return true;
  }

  goToStep(stepIndex: number): boolean {
    if (this.isTransitioning) {
      return false;
    }
    
    const steps = [...this.stepsSignal()];
    for (let i = 0; i <= stepIndex; i++) {
      steps[i].canNavigateTo = true;
    }
    this.stepsSignal.set(steps);
    
    this.isTransitioning = true;
    this.currentStepIndex.set(stepIndex);
    this.updateStepNavigation();
    this.updateCurrentStep();
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, 50);
    
    return true;
  }

  markStepValid(stepIndex: number, isValid: boolean): void {
    const steps = [...this.stepsSignal()];
    if (steps[stepIndex]) {
      steps[stepIndex].isValid = isValid;
      this.stepsSignal.set(steps);
    }
  }

  markStepCompleted(stepIndex: number): void {
    const steps = [...this.stepsSignal()];
    if (steps[stepIndex]) {
      steps[stepIndex].isCompleted = true;
      steps[stepIndex].isValid = true;
      
      if (this.currentCartItemId) {
        if (!this.completedSteps.has(this.currentCartItemId)) {
          this.completedSteps.set(this.currentCartItemId, new Set());
        }
        this.completedSteps.get(this.currentCartItemId)?.add(stepIndex);
      }
      
      if (stepIndex + 1 < steps.length) {
        steps[stepIndex + 1].canNavigateTo = true;
      }
      
      this.stepsSignal.set(steps);
    }
  }

  isStepCompletedForItem(itemId: string | number, stepIndex: number): boolean {
    const itemSteps = this.completedSteps.get(itemId);
    return itemSteps?.has(stepIndex) || false;
  }

  markCartItemComplete(itemId: string | number): void {
    this.cartItemProgress.set(itemId, {
      id: itemId,
      bookingConfirmed: true
    });
  }

  isCartItemComplete(itemId: string | number): boolean {
    return this.cartItemProgress.get(itemId)?.bookingConfirmed || false;
  }

  resetCartItemProgress(): void {
    this.cartItemProgress.clear();
  }

  private updateStepNavigation(): void {
    const steps = [...this.stepsSignal()];
    steps.forEach(step => step.isActive = false);
    
    if (steps[this.currentStepIndex()]) {
      steps[this.currentStepIndex()].isActive = true;
    }
    
    this.stepsSignal.set(steps);
  }

  private updateCurrentStep(): void {
    this.currentStep$.next(this.getCurrentStep());
  }

reset(): void {
  const resetSteps = this.steps.map((step, index) => ({
    ...step,
    // Only show completed if the step is completed for current cart item
    isCompleted: this.currentCartItemId ? this.isStepCompletedForItem(this.currentCartItemId, index) : false,
    isValid: false,
    isActive: index === 0,
    canNavigateTo: true
  }));
  
  this.stepsSignal.set(resetSteps);
  this.currentStepIndex.set(0);
  this.updateCurrentStep();
}

  clearCompletedSteps(itemId: string | number): void {
  this.completedSteps.delete(itemId);
  
  // If this is the current cart item, reset the step display
  if (itemId === this.currentCartItemId) {
    const steps = [...this.stepsSignal()];
    steps.forEach(step => {
      step.isCompleted = false;
      step.isValid = false;
    });
    this.stepsSignal.set(steps);
  }
}
}