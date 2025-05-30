import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { Map } from 'maplibre-gl';
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
  
  @ViewChild('bookingMap', { static: true })
  private mapContainer!: ElementRef<HTMLElement>;
  private map: Map | undefined;
  private markerArray = [];

  private _data: any;

  constructor(private router: Router) {}

  updateMap() {
    this.markerArray.forEach(marker => marker.remove());

    if (this.data.coordinates) {
      if (this.data.type === 'MultiPolygon') {
        console.log(JSON.stringify(this.data?.boundary.coordinates[0]))
        this.map.addSource(`source-${this.data._id}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: this.data.coordinates[0]
            },
            properties: this.data
          }
        });
        this.map.addLayer({
          'id': `source-${this.data._id}`,
          'type': 'fill',
          'source': `source-${this.data._id}`,
          'layout': {},
          'paint': {
            'fill-color': '#088',
            'fill-opacity': 0.8
          }
        });
        const content = `<strong>${this.data.displayName}</strong><p><img src='${this.data.imageUrl}' style='max-width: 225px; max-height: 225px; cursor: pointer;' onclick="window.open('${this.data.imageUrl}', '_blank')"/></p><p>ID: ${this.data._id.split('#')[1]}</p>`;
        this.map.on('click', `source-${this.data._id}`, (e) => {
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(content)
            .addTo(this.map);
        });
      }
      const popupContent = Object.entries(this.data)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join('<br>');
      const marker = new maplibregl.Marker()
        .setLngLat([this.data.location.coordinates[0], this.data.location.coordinates[1]])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent))

      this.markerArray.push(marker)
      marker.addTo(this.map);
    }
  }

  ngAfterViewInit() {
  this.map = new Map({
    container: this.mapContainer.nativeElement,
    style: 'https://demotiles.maplibre.org/style.json',
    center: [-123.19, 48.24],
    zoom: 4,
  });

  this.map.addControl(new maplibregl.NavigationControl());

  this.map.on('load', () => {
    if (this._data) {
      this.updateMap();
    }
  });
}

  ngOnDestroy() {
    this.map?.remove();
  }
}
