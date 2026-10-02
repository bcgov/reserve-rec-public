import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { DateTime } from 'luxon';
import { Constants } from '../../../constants';
import { ServerTimeService } from '../../../services/server-time.service';

export function holdRetryMessage(retryAt: DateTime, now: DateTime): string {
  const local = retryAt.setZone(Constants.timeZoneIANA);
  const time = `${local.toFormat('h:mm')} ${local.hour < 12 ? 'a.m.' : 'p.m.'} Pacific time`;
  const when = local.hasSame(now.setZone(Constants.timeZoneIANA), 'day') ? time : `${time} on ${local.toFormat('LLLL d')}`;
  return `You've changed this booking several times. You can try again at ${when}.`;
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

// The live region stays in the DOM so the message is announced once when set;
// the per-second countdown is hidden from screen readers.
@Component({
  selector: 'app-hold-retry-notice',
  standalone: true,
  imports: [NgClass],
  templateUrl: './hold-retry-notice.component.html',
})
export class HoldRetryNoticeComponent implements OnChanges, OnDestroy {
  @Input() retryAt: DateTime | null = null;
  @Input() noticeId = 'hold-retry-notice';
  @Output() elapsed = new EventEmitter<void>();

  public message = '';
  public countdown = '';

  private timer: ReturnType<typeof setInterval> | undefined;
  private serverTime = inject(ServerTimeService);
  private cdr = inject(ChangeDetectorRef);

  ngOnChanges(): void {
    this.stop();
    this.message = '';
    this.countdown = '';
    if (!this.retryAt) return;
    const ms = this.remainingMs();
    if (ms > 0) {
      this.message = holdRetryMessage(this.retryAt, this.serverTime.now());
      this.countdown = formatCountdown(ms);
    }
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const ms = this.remainingMs();
    if (ms > 0) {
      this.countdown = formatCountdown(ms);
    } else {
      this.stop();
      this.message = '';
      this.countdown = '';
      this.elapsed.emit();
    }
    this.cdr.markForCheck();
  }

  private remainingMs(): number {
    return (this.retryAt?.toMillis() ?? 0) - this.serverTime.now().toMillis();
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
