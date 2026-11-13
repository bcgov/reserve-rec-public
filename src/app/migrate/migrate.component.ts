import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-migrate',
  imports: [],
  templateUrl: './migrate.component.html',
})
export class MigrateComponent {
  readonly migrateId: string | null;

  constructor(private router: Router) {
    const state = this.router.currentNavigation()?.extras.state || window.history.state;
    const migrateId = state?.['migrateId'];
    this.migrateId = typeof migrateId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(migrateId)
      ? migrateId
      : null;
  }

  onCancel() {
    this.router.navigate(['/login']);
  }

  onLoginToBcparks() {
    this.router.navigate(['/login'], { queryParams: { reason: 'migration' } });
  }
}
