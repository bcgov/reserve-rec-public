import { AfterViewInit, Component, effect, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { Map } from 'maplibre-gl';

@Component({
  standalone: true,
  selector: 'app-search-map',
  templateUrl: './search-map.component.html',
  styleUrls: ['./search-map.component.scss'],
})
export class SearchMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('searchMap')
  private mapContainer!: ElementRef<HTMLElement>;
  private map: Map | undefined;
  private markerArray = [];

  public data = [];

  constructor(private dataService: DataService) {
    effect(() => {
      this.data = this.dataService.watchItem(Constants.dataIds.SEARCH_RESULTS)() || [];
      this.updateMap();
    });
  }

  updateMap() {
    this.markerArray.forEach(marker => marker.remove());

    this.data.forEach(item => {
      if (item._source.location && item._source.location.coordinates) {
        if (item._source?.boundary?.type === 'MultiPolygon') {
          console.log(JSON.stringify(item._source?.boundary.coordinates[0]))
          this.map.addSource(`source-${item._id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: item._source?.boundary?.coordinates[0]
              },
              properties: item._source
            }
          });
          this.map.addLayer({
            'id': `source-${item._id}`,
            'type': 'fill',
            'source': `source-${item._id}`,
            'layout': {},
            'paint': {
              'fill-color': '#088',
              'fill-opacity': 0.8
            }
          });
          const content = `<strong>${item._source.displayName}</strong><p><img src='${item._source.imageUrl}' style='max-width: 225px; max-height: 225px; cursor: pointer;' onclick="window.open('${item._source.imageUrl}', '_blank')"/></p><p>ID: ${item._id.split('#')[1]}</p>`;
          this.map.on('click', `source-${item._id}`, (e) => {
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(content)
              .addTo(this.map);
          });
        }
        const popupContent = Object.entries(item._source)
          .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
          .join('<br>');
        const marker = new maplibregl.Marker()
          .setLngLat([item._source.location.coordinates[0], item._source.location.coordinates[1]])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent))

        this.markerArray.push(marker)
        marker.addTo(this.map);
      }
    });
  }

  ngAfterViewInit() {
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-123.19, 48.24],
      zoom: 5,
      // maxBounds: [
      //   [-141.06, 46.30], // Southwest coordinates of BC (approximate)
      //   [-112.03, 62.00]  // Northeast coordinates of BC (approximate)
      // ]
    });

    this.map.addControl(new maplibregl.NavigationControl());
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}