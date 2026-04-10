import { Injectable, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface AdmissionContext {
  facilityKey: string;
  dateKey: string;
  tokenExpiry: number;
  admittedAt: number;
}

@Injectable({ providedIn: 'root' })
export class WaitingRoomService {
  private readonly STORAGE_KEY = 'wr_admission';

  /** True when a Mode 2 (site-wide) queue is currently active. */
  public mode2Active = signal<boolean>(false);

  constructor(private apiService: ApiService) {}

  /** Called once at app startup to hydrate the mode2Active signal. */
  async loadMode2Status(): Promise<void> {
    try {
      const res: any = await lastValueFrom(
        this.apiService.get('waiting-room/mode2/status', {})
      );
      this.mode2Active.set(res?.data?.active === true);
    } catch {
      // Fail open — if the status check errors, don't block the whole app.
      this.mode2Active.set(false);
    }
  }

  getAdmission(): AdmissionContext | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  hasValidAdmission(facilityKey: string, dateKey: string): boolean {
    const admission = this.getAdmission();
    if (!admission) return false;
    const now = Math.floor(Date.now() / 1000);
    if (admission.facilityKey === 'MODE2#global#1') {
      return admission.tokenExpiry > now;
    }
    return (
      admission.facilityKey === facilityKey &&
      admission.dateKey === dateKey &&
      admission.tokenExpiry > now
    );
  }

  clearAdmission(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  async sendHeartbeat(): Promise<void> {
    try {
      const res: any = await lastValueFrom(
        this.apiService.post('waiting-room/heartbeat', {}, {})
      );
      const newExpiry = res?.data?.tokenExpiry;
      if (newExpiry) {
        const admission = this.getAdmission();
        if (admission) {
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify({ ...admission, tokenExpiry: newExpiry }));
        }
      }
    } catch (err) {
      console.warn('Waiting room heartbeat failed:', err);
    }
  }

  buildWaitingRoomUrl(collectionId: string, activityType: string, activityId: string, startDate: string, returnUrl: string, facilityName?: string): string {
    const p: Record<string, string> = { collectionId, activityType, activityId, startDate, returnUrl };
    if (facilityName) p['facilityName'] = facilityName;
    return `/waitingroom.html?${new URLSearchParams(p).toString()}`;
  }
}
