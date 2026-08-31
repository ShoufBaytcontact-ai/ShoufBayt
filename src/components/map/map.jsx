import "./map.scss";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import Pin from "../pin/pin";
import { getMapCoordinates } from "../../lib/mapCoordinates";
import { MAP_TILES, SATELLITE_LABELS, SATELLITE_TILES } from "../../lib/mapTiles";

const defaultCenter = [33.8938, 35.5018];

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const timeouts = [80, 250, 700].map((ms) =>
      setTimeout(() => map.invalidateSize(), ms)
    );

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => map.invalidateSize())
        : null;

    observer?.observe(container);

    return () => {
      timeouts.forEach(clearTimeout);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function ChangeMapView({ validItems, mapType }) {
  const map = useMap();

  useEffect(() => {
    const isSatellite = mapType === "satellite";
    map.setMaxZoom(isSatellite ? 19 : MAP_TILES.maxZoom);

    if (isSatellite && map.getZoom() < 16) {
      map.setZoom(Math.min(18, map.getZoom() + 3));
    }
  }, [map, mapType]);

  useEffect(() => {
    map.invalidateSize();

    if (!validItems || validItems.length === 0) {
      map.setView(defaultCenter, 9);
      return;
    }

    if (validItems.length === 1) {
      map.setView([validItems[0].latitude, validItems[0].longitude], 16);
      return;
    }

    const bounds = L.latLngBounds(
      validItems.map((item) => [item.latitude, item.longitude])
    );

    map.fitBounds(bounds, {
      padding: [56, 56],
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

function Map({ items, item, className = "" }) {
  const { t } = useTranslation();
  const [mapType, setMapType] = useState("map");

  const mapItems = useMemo(() => {
    return normalizeMapSource(items, item)
      .filter(Boolean)
      .map((post) => {
        const coords = getMapCoordinates(post);

        if (!coords) {
          return null;
        }

        return {
          ...post,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      })
      .filter(Boolean);
  }, [items, item]);

  const hasValidLocations = mapItems.length > 0;
  const isSatellite = mapType === "satellite";

  return (
    <div
      className={[
        "mapWrapper",
        isSatellite ? "isSatellite" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <MapContainer
        key={hasValidLocations ? "listings" : "empty"}
        className="map"
        center={
          hasValidLocations
            ? [mapItems[0].latitude, mapItems[0].longitude]
            : defaultCenter
        }
        zoom={hasValidLocations ? 13 : 9}
        minZoom={5}
        maxZoom={isSatellite ? 19 : MAP_TILES.maxZoom}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        {isSatellite ? (
          <>
            <TileLayer
              key="satellite"
              attribution={SATELLITE_TILES.attribution}
              url={SATELLITE_TILES.url}
              maxZoom={SATELLITE_TILES.maxZoom}
              maxNativeZoom={19}
            />
            <TileLayer
              key="satellite-labels"
              url={SATELLITE_LABELS}
              attribution=""
              maxZoom={19}
              pane="overlayPane"
            />
          </>
        ) : (
          <TileLayer
            key="street"
            attribution={MAP_TILES.attribution}
            url={MAP_TILES.url}
            maxZoom={MAP_TILES.maxZoom}
            subdomains={MAP_TILES.subdomains}
          />
        )}

        <FixMapSize />
        <ChangeMapView validItems={mapItems} mapType={mapType} />

        {mapItems.map((post, index) => (
          <Pin
            item={post}
            key={post.id || `${post.latitude}-${post.longitude}-${index}`}
          />
        ))}
      </MapContainer>

      <div className="mapTypeSwitch" role="group" aria-label={t("list.map.title")}>
        <button
          type="button"
          className={!isSatellite ? "isActive" : ""}
          onClick={() => setMapType("map")}
        >
          {t("list.map.mapView")}
        </button>
        <button
          type="button"
          className={isSatellite ? "isActive" : ""}
          onClick={() => setMapType("satellite")}
        >
          {t("list.map.satellite")}
        </button>
      </div>

      {hasValidLocations && (
        <div className="mapInfoBadge">
          {mapItems.length === 1
            ? t("list.map.oneListing", { count: mapItems.length })
            : t("list.map.manyListings", { count: mapItems.length })}
        </div>
      )}

      {!hasValidLocations && (
        <div className="mapEmptyOverlay mapEmptySoft">
          <div>
            <p>{t("list.map.emptyMessage")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Map;
