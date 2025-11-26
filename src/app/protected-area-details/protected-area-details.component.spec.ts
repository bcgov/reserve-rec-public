import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Signal } from '@angular/core';

import { ProtectedAreaDetailsComponent } from './protected-area-details.component';
import { SearchMapComponent } from '../search-map/search-map.component';

@Component({
  selector: 'app-search-map',
  template: '',
  standalone: true
})
class MockSearchMapComponent {
  @Input() _dataSignal: Signal<any[]>;
  @Input() displayGeozones = false;
}
import { ConfigService } from '../services/config.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ProtectedAreaDetailsComponent', () => {
  let component: ProtectedAreaDetailsComponent;
  let fixture: ComponentFixture<ProtectedAreaDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProtectedAreaDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'protected-area/:orcs/', component: ProtectedAreaDetailsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(ProtectedAreaDetailsComponent, {
      remove: { imports: [SearchMapComponent] },
      add: { imports: [MockSearchMapComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProtectedAreaDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
