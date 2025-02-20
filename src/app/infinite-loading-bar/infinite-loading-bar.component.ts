import { CommonModule } from '@angular/common';
import { Component, effect } from '@angular/core';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-infinite-loading-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './infinite-loading-bar.component.html',
  styleUrl: './infinite-loading-bar.component.scss'
})
export class InfiniteLoadingBarComponent {
  public loading = false;

  constructor(protected loadingService: LoadingService) {
    effect(() => {
      this.loading = this.loadingService.getLoadingStatus();
    });
  }
}
