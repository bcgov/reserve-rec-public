import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaitingRoomService } from '../../services/waiting-room.service';

@Component({
  selector: 'app-admission-countdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div class="admission-countdown" [class.admission-countdown--warning]="isWarning()">
        <i class="fa-regular fa-clock me-2"></i>
        <span class="me-1">Admission expires in:</span>
        <strong>{{ display() }}</strong>
      </div>
    }
  `,
  styles: [`
    .admission-countdown {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      padding: 8px 16px;
      display: inline-flex;
      align-items: center;
      font-size: 0.9rem;
      color: #155724;
    }
    .admission-countdown--warning {
      background: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }
  `]
})
export class AdmissionCountdownComponent implements OnInit, OnDestroy {
  visible = signal(false);
  display = signal('');
  isWarning = signal(false);

  private tickInterval: any;
  private heartbeatInterval: any;

  constructor(private waitingRoomService: WaitingRoomService) {}

  ngOnInit(): void {
    const admission = this.waitingRoomService.getAdmission();
    if (!admission) return;
    // Don't show if already expired at init time — just clean up
    if (admission.tokenExpiry <= Math.floor(Date.now() / 1000)) {
      this.waitingRoomService.clearAdmission();
      return;
    }
    this.visible.set(true);
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), 1000);
    // Send heartbeat every 5 minutes to keep admission alive
    this.heartbeatInterval = setInterval(() => this.waitingRoomService.sendHeartbeat(), 5 * 60 * 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.tickInterval);
    clearInterval(this.heartbeatInterval);
  }

  private tick(): void {
    const admission = this.waitingRoomService.getAdmission();
    if (!admission) {
      this.visible.set(false);
      return;
    }
    const remaining = admission.tokenExpiry - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      this.waitingRoomService.clearAdmission();
      this.visible.set(false);
      clearInterval(this.tickInterval);
      clearInterval(this.heartbeatInterval);
      return;
    }
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    this.display.set(`${mins}:${secs.toString().padStart(2, '0')}`);
    this.isWarning.set(remaining < 120);
  }
}
