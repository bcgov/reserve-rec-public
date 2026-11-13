import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MigrateComponent } from './migrate.component';
import { Router } from '@angular/router';

describe('MigrateComponent', () => {
  let component: MigrateComponent;
  let fixture: ComponentFixture<MigrateComponent>;
  const router = jasmine.createSpyObj<Router>('Router', ['currentNavigation', 'navigate']);

  beforeEach(async () => {
    router.navigate.calls.reset();
    router.currentNavigation.and.returnValue(null);
    window.history.replaceState(
      { migrateId: '4e707c5a-68f1-4728-b09e-2b5b691b86e6' },
      '',
      '/',
    );
    await TestBed.configureTestingModule({
      imports: [MigrateComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();

    fixture = TestBed.createComponent(MigrateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with the migration ID from navigation state', () => {
    expect(component).toBeTruthy();
    expect(component.migrateId).toBe('4e707c5a-68f1-4728-b09e-2b5b691b86e6');
  });

  it('prompts the user to sign in to BC Parks', () => {
    component.onLoginToBcparks();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'],
      { queryParams: { reason: 'migration' } },
    );
  });

  it('cancels without confirming and returns to the regular login flow', () => {
    component.onCancel();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('rejects invalid migration IDs', () => {
    window.history.replaceState({ migrateId: 'not-a-uuid' }, '', '/');
    const componentWithInvalidId = new MigrateComponent(router);
    expect(componentWithInvalidId.migrateId).toBeNull();
  });
});
