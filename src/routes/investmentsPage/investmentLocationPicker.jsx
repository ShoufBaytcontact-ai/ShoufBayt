import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_TILES, SATELLITE_LABELS, SATELLITE_TILES } from "../../lib/mapTiles";
import PlaceLocation from "../../components/placeLocation/placeLocation";
import "../../components/map/map.scss";

const locationIcon = L.divIcon({
  className: "propertyMarker",
  html: `
    <svg class="mapPinSvg" viewBox="0 0 32 42" aria-hidden="true">
      <path d="M16 1.5C8.5 1.5 2.5 7.6 2.5 15.3c0 8.9 9.4 18.6 13.5 24.4a1.2 1.2 0 0 0 1.9 0c4.1-5.8 13.6-15.5 13.6-24.4C29.5 7.6 23.5 1.5 16 1.5Z"/>
      <circle cx="16" cy="15.2" r="5.2"/>
    </svg>
  `,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -38],
});

const defaultMapCenter = [33.8938, 35.5018];

function ChangeMapCenter({ position, mapType }) {
  const map = useMap();
  const isSatellite = mapType === "satellite";

  useEffect(() => {
    map.setMaxZoom(isSatellite ? 19 : MAP_TILES.maxZoom);
    if (isSatellite && map.getZoom() < 16) {
      map.setZoom(Math.min(18, map.getZoom() + 3));
    }
  }, [map, isSatellite]);

  useEffect(() => {
    if (!position) return;
    map.setView([position.latitude, position.longitude], isSatellite ? 17 : 16);
    const timeout = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timeout);
  }, [map, position, isSatellite]);

  return null;
}

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

function PinDrop({ location, onSelectLocation }) {
  const { t } = useTranslation();

  useMapEvents({
    click(event) {
      onSelectLocation({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  if (!location) return null;

  return (
    <Marker position={[location.latitude, location.longitude]} icon={locationIcon}>
      <Popup>{t("newPost.location.popup")}</Popup>
    </Marker>
  );
}

function InvestmentLocationPicker({ location, onChange, onError }) {
  const { t } = useTranslation();
  const [mapType, setMapType] = useState("map");
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      onError?.(t("newPost.validation.locationNotSupported"));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        onError?.("");
        setLocating(false);
      },
      () => {
        onError?.(t("newPost.validation.locationFailed"));
        setLocating(false);
      }
    );
  };

  return (
    <div className="investLocation">
      <div className="investLocationHead">
        <div>
          <p className="investEyebrow">{t("newPost.location.badge")}</p>
          <strong>{t("newPost.location.title")}</strong>
          <span>{t("newPost.location.description")}</span>
        </div>
        <button type="button" className="investLocate" onClick={useMyLocation} disabled={locating}>
          {locating ? t("newPost.location.locating") : t("newPost.location.useMyLocation")}
        </button>
      </div>

      <PlaceLocation onPlace={onChange} onError={onError} />

      <div className="investMapBox">
        <div className={mapType === "satellite" ? "mapWrapper isSatellite" : "mapWrapper"}>
          <MapContainer
            className="map"
            center={
              location
                ? [location.latitude, location.longitude]
                : defaultMapCenter
            }
            zoom={location ? 16 : 12}
            minZoom={5}
            maxZoom={mapType === "satellite" ? 19 : MAP_TILES.maxZoom}
            scrollWheelZoom
            zoomControl={false}
          >
            <ZoomControl position="topright" />
            {mapType === "satellite" ? (
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
            <ChangeMapCenter position={location} mapType={mapType} />
            <PinDrop location={location} onSelectLocation={onChange} />
          </MapContainer>

          <div className="mapTypeSwitch" role="group" aria-label={t("list.map.title")}>
            <button
              type="button"
              className={mapType !== "satellite" ? "isActive" : ""}
              onClick={() => setMapType("map")}
            >
              {t("list.map.mapView")}
            </button>
            <button
              type="button"
              className={mapType === "satellite" ? "isActive" : ""}
              onClick={() => setMapType("satellite")}
            >
              {t("list.map.satellite")}
            </button>
          </div>

          {location ? (
            <div className="mapInfoBadge">{t("newPost.location.pinSet")}</div>
          ) : (
            <div className="mapEmptyOverlay mapEmptySoft">
              <div>
                <p>{t("newPost.location.clickHint")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InvestmentLocationPicker;
