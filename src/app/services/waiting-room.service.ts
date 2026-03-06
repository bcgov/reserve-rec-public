import { Injectable } from '@angular/core';
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

  constructor(private apiService: ApiService) {}

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

  buildWaitingRoomUrl(collectionId: string, activityType: string, activityId: string, startDate: string, returnUrl: string): string {
    const params = new URLSearchParams({ collectionId, activityType, activityId, startDate, returnUrl });
    return `/waitingroom.html?${params.toString()}`;
  }
}
