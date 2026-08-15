# Map provider interface

The Fieldbook map (`artifacts/blickling-fieldbook/src/pages/MapView.tsx`) uses
Leaflet with the public OpenStreetMap raster tile service:

- Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Attribution: `© OpenStreetMap contributors`
- Licence: ODbL (data); tile usage governed by the
  [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## Constraints honoured

- **No bulk prefetch.** The service worker caches only tiles actually viewed
  (`fieldbook-map-tiles-v1`, capped at 500 entries). Bulk downloading tiles for
  offline use violates the OSM tile policy and is deliberately not implemented.
- **Offline fallback.** When the device is offline, MapView replaces the map
  with a cached-records list and an explicit "Offline map not downloaded"
  message, reading from the structured offline store.

## Swapping the provider

To integrate an offline-licensed source (e.g. an approved Blickling vector or
MBTiles package):

1. Replace the `L.tileLayer(...)` call in MapView's initialisation effect with
   the new layer (raster tile URL template, or a vector-tile Leaflet plugin).
2. Update the service-worker tile cache hostname check in
   `public/service-worker.js` (`tile.openstreetmap.org`).
3. If the source is fully offline-capable, the offline fallback list can be
   made conditional on layer availability rather than `navigator.onLine`.

## External blocker

No offline-licensed map source for the Blickling estate exists in this
project. Procuring one (licence + data package) is an external decision and is
reported as a blocker rather than worked around.
