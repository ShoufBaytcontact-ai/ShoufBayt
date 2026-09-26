import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { listingRequestApi } from "../../lib/services";
import PhoneField from "../../components/phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";
import "./requestListingPage.scss";
import "../../components/map/map.scss";

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
import { locksRoomCounts, withCategoryChange } from "../../lib/propertyKind";

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

const PROPERTY_OPTIONS = [
  "apartment",
  "house",
  "villa",
  "land",
  "building",
  "office",
  "shop",
];

const initialForm = {
  title: "",
  price: "",
  address: "",
  city: "",
  bedroom: "1",
  bathroom: "1",
  garage: "",
  size: "",
  type: "sale",
  property: "apartment",
  description: "",
  contactPhone: "",
};

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

    map.setView(
      [position.latitude, position.longitude],
      isSatellite ? 17 : 16
    );
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

function LocationPicker({ location, onSelectLocation }) {
  const { t } = useTranslation();

  useMapEvents({
    click(e) {
      onSelectLocation({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });

  if (!location) return null;

  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={locationIcon}
    >
      <Popup>{t("requestListing.location.popup")}</Popup>
    </Marker>
  );
}

function RequestListingPage() {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();

  const [step, setStep] = useState("details");
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [verificationImages, setVerificationImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resultMeta, setResultMeta] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [verificationPreviews, setVerificationPreviews] = useState([]);
  const [mapType, setMapType] = useState("map");

  const isBuildingProperty = form.property === "building";
  const roomsLocked = locksRoomCounts(form.property);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  useEffect(() => {
    const urls = verificationImages.map((file) => URL.createObjectURL(file));
    setVerificationPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [verificationImages]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  const summary = useMemo(
    () => ({
      title: form.title.trim(),
      city: form.city.trim(),
      type: form.type,
      property: form.property,
      price: form.price,
      photos: images.length,
      address: form.address.trim(),
      size: form.size,
      bedroom: form.bedroom,
      bathroom: form.bathroom,
      garage: form.garage,
    }),
    [form, images]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => withCategoryChange(prev, name, value));

    setError("");
  };

  const handleImages = (e) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      String(file.type || "").startsWith("image/")
    );
    setImages((prev) => [...prev, ...files].slice(0, 20));
    e.target.value = "";
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVerificationImages = (e) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      String(file.type || "").startsWith("image/")
    );
    setVerificationImages((prev) => [...prev, ...files].slice(0, 2));
    e.target.value = "";
  };

  const removeVerificationImage = (index) => {
    setVerificationImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectLocation = (nextLocation) => {
    setLocation(nextLocation);
    setError("");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t("requestListing.validation.locationNotSupported"));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setError("");
        setLocating(false);
      },
      () => {
        setError(t("requestListing.validation.locationFailed"));
        setLocating(false);
      }
    );
  };

  const validateDetails = () => {
    if (!form.title.trim() || !form.address.trim() || !form.city.trim()) {
      return t("requestListing.validation.requiredFields");
    }
    if (!form.price || Number(form.price) <= 0) {
      return t("requestListing.validation.price");
    }
    if (!roomsLocked) {
      if (form.bedroom === "" || Number(form.bedroom) < 0) {
        return t("requestListing.validation.bedrooms");
      }
      if (form.bathroom === "" || Number(form.bathroom) < 0) {
        return t("requestListing.validation.bathrooms");
      }
    }
    if (
      isBuildingProperty &&
      (form.garage === "" || Number(form.garage) < 0)
    ) {
      return t("requestListing.validation.garage");
    }
    if (!form.description.trim() || form.description.trim().length < 20) {
      return t("requestListing.validation.description");
    }
    if (!location) {
      return t("requestListing.validation.location");
    }
    if (images.length === 0) {
      return t("requestListing.validation.images");
    }
    if (verificationImages.length !== 2) {
      return t("requestListing.validation.verificationImages");
    }
    if (form.contactPhone.trim() && !isValidPhone(form.contactPhone, { allowEmpty: true })) {
      return t("phoneField.errors.invalid");
    }
    return "";
  };

  const goToConfirm = (e) => {
    e.preventDefault();
    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      setStep("details");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const requestData = {
        title: form.title,
        price: form.price,
        address: form.address,
        city: form.city,
        bedroom: roomsLocked ? 0 : form.bedroom,
        bathroom: roomsLocked ? 0 : form.bathroom,
        garage: isBuildingProperty ? Number(form.garage) : null,
        area: form.size,
        type: form.type,
        property: form.property,
        description: form.description,
        latitude: location.latitude,
        longitude: location.longitude,
        contactPhone: form.contactPhone,
        contactEmail: currentUser.email,
        contactName: currentUser.username,
      };

      const formData = new FormData();
      formData.append("requestData", JSON.stringify(requestData));
      formData.append(
        "postDetail",
        JSON.stringify({ description: form.description, size: form.size })
      );
      images.forEach((file) => formData.append("images", file));
      verificationImages.forEach((file) =>
        formData.append("verificationImages", file)
      );

      const res = await listingRequestApi.create(formData);
      setResultMeta({
        notifiedCount: res.data?.notifiedCount ?? 0,
        maxProposals: res.data?.maxProposals ?? 10,
        id: res.data?.id,
        number: res.data?.number,
      });
      setSuccess(t("requestListing.success.submitted"));
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const offline = !err.response || err.code === "ERR_NETWORK";
      setError(
        apiMessage ||
          (offline
            ? t("requestListing.errors.apiOffline")
            : t("requestListing.errors.submit"))
      );
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <main className="requestListingPage pageFade">
      <section className="requestHero">
        <div>
          <p className="requestEyebrow">{t("requestListing.hero.badge")}</p>
          <h1>{t("requestListing.hero.title")}</h1>
          <span>{t("requestListing.hero.description")}</span>
        </div>

        <div className="requestHeroActions">
          <Link to="/offers" className="requestGhostBtn">
            {t("requestListing.hero.myRequests")}
          </Link>
        </div>
      </section>

      <section className="requestStats">
        <div>
          <span>{t("requestListing.stats.brief")}</span>
          <strong>{t("requestListing.stats.briefValue")}</strong>
        </div>
        <div>
          <span>{t("requestListing.stats.agents")}</span>
          <strong>{t("requestListing.stats.agentsValue")}</strong>
        </div>
        <div>
          <span>{t("requestListing.stats.choice")}</span>
          <strong>{t("requestListing.stats.choiceValue")}</strong>
        </div>
      </section>

      <nav className="requestTabs" aria-label={t("requestListing.hero.badge")}>
        <button type="button" className={step === "details" ? "isActive" : ""}>
          {t("requestListing.steps.details")}
        </button>
        <button
          type="button"
          className={step === "confirm" || step === "done" ? "isActive" : ""}
        >
          {t("requestListing.steps.confirm")}
        </button>
      </nav>

      {step === "details" && (
        <form className="requestForm" onSubmit={goToConfirm}>
          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("requestListing.details.badge")}</p>
              <h2>{t("requestListing.details.title")}</h2>
              <p>{t("requestListing.details.description")}</p>
            </header>

            <div className="requestGrid">
              <label className="requestField">
                {t("requestListing.form.title")}
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder={t("requestListing.form.titlePlaceholder")}
                  required
                />
              </label>

              <label className="requestField">
                {t("requestListing.form.price")}
                <input
                  name="price"
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="150000"
                  required
                />
              </label>

              <label className="requestField">
                {t("requestListing.form.city")}
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder={t("requestListing.form.cityPlaceholder")}
                  required
                />
              </label>

              <label className="requestField">
                {t("requestListing.form.address")}
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder={t("requestListing.form.addressPlaceholder")}
                  required
                />
              </label>

              <label className="requestField">
                {t("requestListing.form.listingType")}
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="sale">{t("requestListing.options.sale")}</option>
                  <option value="rent">{t("requestListing.options.rent")}</option>
                </select>
              </label>

              <label className="requestField">
                {t("requestListing.form.category")}
                <select
                  name="property"
                  value={form.property}
                  onChange={handleChange}
                >
                  {PROPERTY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`requestListing.options.${option}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className={
                  roomsLocked ? "requestField isLocked" : "requestField"
                }
              >
                {t("requestListing.form.bedrooms")}
                {roomsLocked && (
                  <small>
                    {t(
                      isBuildingProperty
                        ? "requestListing.form.buildingLocked"
                        : "requestListing.form.landLocked"
                    )}
                  </small>
                )}
                <input
                  name="bedroom"
                  type="number"
                  min="0"
                  value={roomsLocked ? "0" : form.bedroom}
                  onChange={handleChange}
                  disabled={roomsLocked}
                  placeholder={roomsLocked ? "—" : "2"}
                />
              </label>

              <label
                className={
                  roomsLocked ? "requestField isLocked" : "requestField"
                }
              >
                {t("requestListing.form.bathrooms")}
                {roomsLocked && (
                  <small>
                    {t(
                      isBuildingProperty
                        ? "requestListing.form.buildingLocked"
                        : "requestListing.form.landLocked"
                    )}
                  </small>
                )}
                <input
                  name="bathroom"
                  type="number"
                  min="0"
                  value={roomsLocked ? "0" : form.bathroom}
                  onChange={handleChange}
                  disabled={roomsLocked}
                  placeholder={roomsLocked ? "—" : "1"}
                />
              </label>

              {isBuildingProperty && (
                <label className="requestField">
                  {t("requestListing.form.garage")}
                  <input
                    name="garage"
                    type="number"
                    min="0"
                    value={form.garage}
                    onChange={handleChange}
                    placeholder="1"
                  />
                </label>
              )}

              <label className="requestField">
                {t("requestListing.form.size")}
                <input
                  name="size"
                  type="number"
                  min="0"
                  value={form.size}
                  onChange={handleChange}
                  placeholder="120"
                />
              </label>

              <label className="requestField" htmlFor="listing-phone">
                {t("requestListing.form.phone")}
                <PhoneField
                  id="listing-phone"
                  value={form.contactPhone}
                  onChange={(contactPhone) =>
                    setForm((prev) => ({
                      ...prev,
                      contactPhone,
                    }))
                  }
                  allowEmpty
                />
              </label>

              <label className="requestField wide">
                {t("requestListing.form.description")}
                <textarea
                  name="description"
                  rows={6}
                  value={form.description}
                  onChange={handleChange}
                  placeholder={t("requestListing.form.descriptionPlaceholder")}
                  required
                  minLength={20}
                />
              </label>
            </div>
          </section>

          <section className="requestCard">
            <header className="requestCardHeader mapHeader">
              <div>
                <p className="requestEyebrow">
                  {t("requestListing.location.badge")}
                </p>
                <h2>{t("requestListing.location.title")}</h2>
                <p>{t("requestListing.location.description")}</p>
              </div>
              <button
                type="button"
                className="requestPrimaryBtn"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating
                  ? t("requestListing.location.locating")
                  : t("requestListing.location.useMyLocation")}
              </button>
            </header>

            {location && (
              <div className="requestCoords">
                <span>
                  {t("requestListing.location.lat")}:{" "}
                  {location.latitude.toFixed(6)}
                </span>
                <span>
                  {t("requestListing.location.lng")}:{" "}
                  {location.longitude.toFixed(6)}
                </span>
              </div>
            )}

            <div className="requestMapBox">
              <div
                className={
                  mapType === "satellite" ? "mapWrapper isSatellite" : "mapWrapper"
                }
              >
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
                  scrollWheelZoom={true}
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
                  <LocationPicker
                    location={location}
                    onSelectLocation={handleSelectLocation}
                  />
                </MapContainer>

                <div
                  className="mapTypeSwitch"
                  role="group"
                  aria-label={t("list.map.title")}
                >
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

                {location && (
                  <div className="mapInfoBadge">
                    {t("requestListing.location.pinSet")}
                  </div>
                )}

                {!location && (
                  <div className="mapEmptyOverlay mapEmptySoft">
                    <div>
                      <p>{t("requestListing.location.clickHint")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("requestListing.media.badge")}</p>
              <h2>{t("requestListing.media.title")}</h2>
              <p>{t("requestListing.media.description")}</p>
            </header>

            <label className="requestDrop">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImages}
              />
              <strong>{t("requestListing.media.upload")}</strong>
              <span>{t("requestListing.media.hint")}</span>
            </label>

            {images.length > 0 && (
              <div className="requestThumbs">
                {images.map((file, index) => (
                  <figure key={`${file.name}-${index}`}>
                    <img src={imagePreviews[index]} alt={file.name} />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={t("requestListing.media.remove")}
                    >
                      {t("requestListing.media.remove")}
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("requestListing.verification.badge")}</p>
              <h2>{t("requestListing.verification.title")}</h2>
              <p>{t("requestListing.verification.description")}</p>
            </header>

            <label className="requestDrop">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleVerificationImages}
              />
              <strong>{t("requestListing.verification.upload")}</strong>
              <span>{t("requestListing.verification.hint")}</span>
            </label>

            {verificationImages.length > 0 && (
              <div className="requestThumbs">
                {verificationImages.map((file, index) => (
                  <figure key={`${file.name}-${index}`}>
                    <img src={verificationPreviews[index]} alt={file.name} />
                    <button
                      type="button"
                      onClick={() => removeVerificationImage(index)}
                      aria-label={t("requestListing.media.remove")}
                    >
                      {t("requestListing.media.remove")}
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>

          {error && <div className="requestAlert error">{error}</div>}

          <div className="requestActions">
            <button type="submit" className="requestPrimaryBtn">
              {t("requestListing.actions.continue")}
            </button>
            <Link to="/profile" className="requestTextLink">
              {t("requestListing.actions.cancel")}
            </Link>
          </div>
        </form>
      )}

      {step === "confirm" && (
        <form className="requestForm" onSubmit={handleSubmit}>
          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("requestListing.confirm.badge")}</p>
              <h2>{t("requestListing.confirm.title")}</h2>
              <p>
                {t("requestListing.confirm.description", {
                  city: summary.city || t("requestListing.confirm.yourArea"),
                  property: t(`requestListing.options.${summary.property}`),
                })}
              </p>
            </header>

            <ul className="requestSummary">
              <li>
                <span>{t("requestListing.form.title")}</span>
                <strong>{summary.title}</strong>
              </li>
              <li>
                <span>{t("requestListing.form.address")}</span>
                <strong>
                  {summary.address}, {summary.city}
                </strong>
              </li>
              <li>
                <span>{t("requestListing.form.price")}</span>
                <strong>${Number(summary.price || 0).toLocaleString()}</strong>
              </li>
              <li>
                <span>{t("requestListing.confirm.deal")}</span>
                <strong>
                  {t(`requestListing.options.${summary.type}`)} ·{" "}
                  {t(`requestListing.options.${summary.property}`)}
                </strong>
              </li>
              {!roomsLocked && (
                <li>
                  <span>{t("requestListing.confirm.layout")}</span>
                  <strong>
                    {t("requestListing.confirm.bedsBaths", {
                      beds: summary.bedroom || 0,
                      baths: summary.bathroom || 0,
                    })}
                  </strong>
                </li>
              )}
              {isBuildingProperty && (
                <li>
                  <span>{t("requestListing.form.garage")}</span>
                  <strong>{summary.garage || 0}</strong>
                </li>
              )}
              {summary.size && (
                <li>
                  <span>{t("requestListing.form.size")}</span>
                  <strong>{summary.size} m²</strong>
                </li>
              )}
              <li>
                <span>{t("requestListing.media.title")}</span>
                <strong>{summary.photos}</strong>
              </li>
            </ul>
          </section>

          {error && <div className="requestAlert error">{error}</div>}

          <div className="requestActions">
            <button
              type="submit"
              className="requestPrimaryBtn"
              disabled={loading}
            >
              {loading
                ? t("requestListing.actions.submitting")
                : t("requestListing.actions.submit")}
            </button>
            <button
              type="button"
              className="requestGhostBtn"
              onClick={() => setStep("details")}
            >
              {t("requestListing.actions.back")}
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <section className="requestCard requestDone">
          <header className="requestCardHeader">
            <p className="requestEyebrow">{t("requestListing.done.badge")}</p>
            <h2>{t("requestListing.done.title")}</h2>
            {resultMeta?.number ? (
              <p className="requestNumber">#{resultMeta.number}</p>
            ) : null}
            <p>
              {t("requestListing.done.description", {
                count: resultMeta?.notifiedCount ?? 0,
              })}
            </p>
          </header>

          {success && <div className="requestAlert success">{success}</div>}

          <div className="requestActions">
            <Link to="/offers" className="requestPrimaryBtn">
              {t("requestListing.actions.viewRequests")}
            </Link>
            <button
              type="button"
              className="requestGhostBtn"
              onClick={() => navigate("/")}
            >
              {t("requestListing.actions.home")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default RequestListingPage;
