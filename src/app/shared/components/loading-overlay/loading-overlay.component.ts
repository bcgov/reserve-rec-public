import { Component, effect, signal } from '@angular/core';

import { LoadingService } from '../../../services/loading.service';

// Centered spinner overlay shown whenever LoadingService reports an outstanding
// fetch. Layered on top of the slim infinite-loading-bar so users see a clear
// signal during slow navigations (e.g. OpenSearch-backed facility resolves).
@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [],
  template: `
    @if (loading()) {
      <div class="loading-overlay" role="status" aria-live="polite">
        <div class="spinner-border text-primary" aria-hidden="true"></div>
        <span class="visually-hidden">Loading…</span>
      </div>
    }
    `,
  styles: [`
    .loading-overlay {
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1080;
    }
  `],
})
export class LoadingOverlayComponent {
  loading = signal(false);

  constructor(private loadingService: LoadingService) {
    effect(() => {
      this.loading.set(this.loadingService.getLoadingStatus());
    });
  }
}
