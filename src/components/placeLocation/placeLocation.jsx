import { useState } from "react";
import { useTranslation } from "react-i18next";
import apiRequest from "../../lib/apiRequest";
import { readPhotoGps } from "../../lib/readPhotoGps";
import "./placeLocation.scss";

function PlaceLocation({ onPlace, onError, disabled = false }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const fail = (text) => {
    setMessage(text);
    onError?.(text);
  };

  const succeed = (point) => {
    setMessage("");
    onError?.("");
    onPlace(point);
  };

  const placeQuery = async () => {
    const value = query.trim();
    if (!value) {
      fail(t("mapPlace.empty"));
      return;
    }

    try {
      setBusy(true);
      const res = await apiRequest.post("/geo/place", { query: value });
      const latitude = Number(res.data?.latitude);
      const longitude = Number(res.data?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        fail(t("mapPlace.notFound"));
        return;
      }
      succeed({ latitude, longitude });
    } catch (error) {
      fail(error.response?.data?.message || t("mapPlace.notFound"));
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isJpeg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
    if (!isJpeg) {
      fail(t("mapPlace.badFile"));
      return;
    }

    try {
      setBusy(true);
      const buffer = await file.arrayBuffer();
      const point = readPhotoGps(buffer);
      if (!point) {
        fail(t("mapPlace.noGps"));
        return;
      }
      succeed(point);
    } catch {
      fail(t("mapPlace.noGps"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="placeLocation">
      <div className="placeLocationRow">
        <input
          type="text"
          value={query}
          disabled={disabled || busy}
          placeholder={t("mapPlace.placeholder")}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              placeQuery();
            }
          }}
        />
        <button type="button" onClick={placeQuery} disabled={disabled || busy}>
          {busy ? t("mapPlace.placing") : t("mapPlace.place")}
        </button>
        <label className={disabled || busy ? "isDisabled" : ""}>
          {t("mapPlace.upload")}
          <input
            type="file"
            accept="image/jpeg,image/jpg,.jpg,.jpeg"
            disabled={disabled || busy}
            onChange={onUpload}
          />
        </label>
      </div>
      {message ? <p>{message}</p> : null}
    </div>
  );
}

export default PlaceLocation;
