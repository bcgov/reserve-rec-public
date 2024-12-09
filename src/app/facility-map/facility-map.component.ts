import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Map } from 'maplibre-gl';

@Component({
  selector: 'app-facility-map',
  standalone: true,
  imports: [],
  templateUrl: './facility-map.component.html',
  styleUrl: './facility-map.component.scss'
})
export class FacilityMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('facilityMap')
  private mapContainer!: ElementRef<HTMLElement>;
  private map: Map | undefined;

  constructor() { }

  ngAfterViewInit() {
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-123.19, 48.24],
      zoom: 5,
    });

  }

  ngOnDestroy() {
    this.map?.remove();
  }
}
