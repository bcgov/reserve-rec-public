import { CommonModule } from '@angular/common';
import { Component, effect, signal } from '@angular/core';
import { LoadingService } from '../services/loading.service';

@Component({
    selector: 'app-infinite-loading-bar',
    imports: [CommonModule],
    templateUrl: './infinite-loading-bar.component.html',
    styleUrl: './infinite-loading-bar.component.scss'
})
export class InfiniteLoadingBarComponent {
  public loading = signal(false);

  constructor(protected loadingService: LoadingService) {
    effect(() => {
      this.loading.set(this.loadingService.getLoadingStatus());
    });
  }
}
