import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import maplibregl, { Map } from 'maplibre-gl';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-booking-map',
  templateUrl: './booking-map.component.html',
  styleUrls: ['./booking-map.component.scss'],
})
export class BookingMapComponent implements AfterViewInit, OnDestroy {
  @Input()
  set data(value: any) {
    this._data = value;
    if (this.map) {
      this.updateMap();
    }
  }

  get data(): any {
    return this._data;
  }

  @Input() defaultZoom = 4;

  @ViewChild('bookingMap', { static: true })
  private mapContainer!: ElementRef<HTMLElement>;
  private map: Map | undefined;
  private markerArray = [];
  private _data: any;

  constructor(private router: Router) {}

  updateMap() {
    this.markerArray.forEach(marker => marker.remove());
    this.markerArray = [];

    if (
      this.data?.location?.coordinates &&
      Array.isArray(this.data.location.coordinates) &&
      this.data.location.coordinates.length === 2
    ) {
      const markerCoords: [number, number] = [
        Number(this.data.location.coordinates[0]),
        Number(this.data.location.coordinates[1])
      ];
      const popupContent = Object.entries(this.data)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join('<br>');
      const marker = new maplibregl.Marker()
        .setLngLat(markerCoords)
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent));
      this.markerArray.push(marker);
      marker.addTo(this.map);
      // Center Map at the markers location
      this.map.setCenter(markerCoords);
      this.map.setZoom(this.defaultZoom);
    }
  }

  ngAfterViewInit() {
    // Initialize the map with a fallback center (if no marker, use a default)
    const fallbackCenter: [number, number] = [-123.19, 48.24];
    let center = fallbackCenter;

    if (
      this._data?.location?.coordinates &&
      Array.isArray(this._data.location.coordinates) &&
      this._data.location.coordinates.length === 2
    ) {
      center = [
        Number(this._data.location.coordinates[0]),
        Number(this._data.location.coordinates[1])
      ];
    }

    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'https://demotiles.maplibre.org/style.json',
      center: center,
      zoom: this.defaultZoom,
    });

    this.map.addControl(new maplibregl.NavigationControl());
    this.map.on('load', () => {
      this.map?.resize();
      if (this._data) {
        this.updateMap();
      }
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}