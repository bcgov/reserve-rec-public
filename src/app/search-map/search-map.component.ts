import { AfterViewInit, Component, effect, ElementRef, Input, OnDestroy, Signal, signal, ViewChild } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { Map } from 'maplibre-gl';

@Component({
  standalone: true,
  selector: 'app-search-map',
  templateUrl: './search-map.component.html',
  styleUrls: ['./search-map.component.scss'],
})
export class SearchMapComponent implements AfterViewInit, OnDestroy {
  @Input() _dataSignal: Signal<any[]> = signal([]);
  @Input() displayGeozones = false; // Whether to display geozones on the map
  @ViewChild('searchMap') mapContainer!: ElementRef<HTMLElement>;
  private map: Map | undefined;
  private markerArray = [];
  private mapLoaded = signal(false);
  private flyToLocation = true;


  public data;

  constructor(
  ) {
    effect(() => {
      this.data = this._dataSignal();
      if (this.data?.items) {
        this.data = this.data.items;
      } else if (!this.data?.length) {
        this.data = [this.data];
      }
      if (this.mapLoaded()) {
        this.updateMap();
      }
    });
  }

  ngAfterViewInit() {
    this.createMap();
  }


  updateMap() {

    this.markerArray.forEach(marker => marker.remove());

    const bounds = new maplibregl.LngLatBounds();

    this.data?.forEach(item => {
      if (item?._source) {
        // flatten the _source object to make it easier to access properties
        item = {
          ...item,
          ...item._source
        };
        delete item._source; // remove _source to avoid confusion
      }
      if (item?.location && item?.location?.coordinates) {
        if (item?.boundary?.type === 'MultiPolygon') {
          this.map.addSource(`source-${item._id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: item?.boundary?.coordinates[0]
              },
              properties: item
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
          const content = `<strong>${item.displayName}</strong><p><img src='${item.imageUrl}' style='max-width: 225px; max-height: 225px; cursor: pointer;' onclick="window.open('${item.imageUrl}', '_blank')"/></p><p>ID: ${item._id.split('#')[1]}</p>`;
          this.map.on('click', `source-${item._id}`, (e) => {
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(content)
              .addTo(this.map);
          });
        }
        const popupContent = Object.entries(item)
          .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
          .join('<br>');
        const marker = new maplibregl.Marker()
          .setLngLat([item.location.coordinates[0], item.location.coordinates[1]])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupContent));
        this.markerArray.push(marker);
        marker.addTo(this.map);

        bounds.extend(item.location.coordinates);
      }
      if (item?.envelope && item?.envelope?.coordinates && this.displayGeozones) {
        bounds.extend(item.envelope.coordinates);
        const polygon = this.makeBoxFromEnvelope(item.envelope);
          this.map.addSource(`source-${item._id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [polygon]
              },
              properties: item
            }
          });
          this.map.addLayer({
            'id': `source-${item._id}`,
            'type': 'fill',
            'source': `source-${item._id}`,
            'layout': {},
            'paint': {
              'fill-color': '#088',
              'fill-opacity': 0.2
            }
          });
          const content = `<strong>${item?.displayName}</strong><p><img src='${item?.imageUrl}' style='max-width: 225px; max-height: 225px; cursor: pointer;' onclick="window.open('${item?.imageUrl}', '_blank')"/></p><p>ID: ${JSON.stringify(item, null, 2)}</p>`;
          this.map.on('click', `source-${item._id}`, (e) => {
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(content)
              .addTo(this.map);
          });
        }
    });
    // fly to location
    if (this.flyToLocation && !bounds.isEmpty()) {
      this.map.fitBounds(bounds, {
        padding: 75,
        maxZoom: 13,
      });
    }
  }


  createMap() {
    if (this.mapContainer) {

      this.map = new Map({
        container: this.mapContainer?.nativeElement,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        // simple style
        // style: 'https://demotiles.maplibre.org/style.json',
        center: [-123.19, 48.24],
        zoom: 5,
        // maxBounds: [
        //   [-141.06, 46.30], // Southwest coordinates of BC (approximate)
        //   [-112.03, 62.00]  // Northeast coordinates of BC (approximate)
        // ]
      });

      this.map.addControl(new maplibregl.NavigationControl());
    }
    this.mapLoaded.set(true);
  }


  // Must be closed
  makeBoxFromEnvelope(envelope) {
    if (!envelope || !envelope.coordinates || envelope.coordinates.length < 1) {
      return null;
    }
    return [
      [envelope.coordinates[0][0], envelope.coordinates[0][1]],
      [envelope.coordinates[0][0], envelope.coordinates[1][1]],
      [envelope.coordinates[1][0], envelope.coordinates[1][1]],
      [envelope.coordinates[1][0], envelope.coordinates[0][1]],
      [envelope.coordinates[0][0], envelope.coordinates[0][1]],
    ];
  }

  ngOnDestroy() {
    this.markerArray.forEach(marker => marker.remove());
    this.map?.remove();
  }
}