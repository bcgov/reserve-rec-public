import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';

/**
 * Server time for gating the booking window. Every API response carries
 * `serverTime`; the offset from the device clock is kept so time keeps
 * running between calls.
 */
@Injectable({ providedIn: 'root' })
export class ServerTimeService {
  private offsetMs = 0;

  // A body without a usable serverTime (older API, non-JSON) leaves the offset alone.
  public record(body: any): void {
    const serverTime = body?.serverTime;
    if (typeof serverTime !== 'number' || !isFinite(serverTime)) {
      return;
    }
    this.offsetMs = serverTime - Date.now();
  }

  /** Server time, falling back to the device clock until a response arrives. */
  public now(): DateTime {
    return DateTime.fromMillis(Date.now() + this.offsetMs);
  }
}
