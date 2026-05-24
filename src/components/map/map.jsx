import "./map.scss";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Pin from "../pin/pin";

const defaultCenter = [33.8938, 35.5018];

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

function ChangeMapView({ validItems }) {
  const map = useMap();

  useEffect(() => {
    if (!validItems || validItems.length === 0) {
      map.setView(defaultCenter, 9);
      return;
    }

    if (validItems.length === 1) {
      map.setView([validItems[0].latitude, validItems[0].longitude], 15);
      return;
    }

    const bounds = L.latLngBounds(
      validItems.map((item) => [item.latitude, item.longitude])
    );

    map.fitBounds(bounds, {
      padding: [70, 70],
      maxZoom: 14,
    });
  }, [map, validItems]);

  return null;
}

function normalizeMapSource(items, item) {
  if (Array.isArray(items)) {
    return items;
  }

  if (items && typeof items === "object") {
    return [items];
  }

  if (Array.isArray(item)) {
    return item;
  }

  if (item && typeof item === "object") {
    return [item];
  }

  return [];
}

function Map({ items, item }) {
  const mapItems = useMemo(() => {
    const source = normalizeMapSource(items, item);

    return source
      .filter(Boolean)
      .map((post) => {
        const latitude = Number(post.latitude);
        const longitude = Number(post.longitude);

        return {
          ...post,
          latitude,
          longitude,
        };
      })
      .filter((post) => {
        const validLatitude =
          Number.isFinite(post.latitude) &&
          post.latitude >= -90 &&
          post.latitude <= 90;

        const validLongitude =
          Number.isFinite(post.longitude) &&
          post.longitude >= -180 &&
          post.longitude <= 180;

        return validLatitude && validLongitude;
      });
  }, [items, item]);

  const hasValidLocations = mapItems.length > 0;

  return (
    <div className="mapWrapper">
      <MapContainer
        className="map"
        center={
          hasValidLocations
            ? [mapItems[0].latitude, mapItems[0].longitude]
            : defaultCenter
        }
        zoom={hasValidLocations ? 13 : 9}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FixMapSize />
        <ChangeMapView validItems={mapItems} />

        {mapItems.map((post, index) => (
          <Pin
            item={post}
            key={post.id || `${post.latitude}-${post.longitude}-${index}`}
          />
        ))}
      </MapContainer>

      {!hasValidLocations && (
        <div className="mapEmptyOverlay">
          <div>
            <span>📍</span>
            <h3>No Location Available</h3>
            <p>This property does not have valid map coordinates yet.</p>
          </div>
        </div>
      )}

      {hasValidLocations && (
        <div className="mapInfoBadge">
          {mapItems.length} location{mapItems.length === 1 ? "" : "s"} shown
        </div>
      )}
    </div>
  );
}

export default Map;