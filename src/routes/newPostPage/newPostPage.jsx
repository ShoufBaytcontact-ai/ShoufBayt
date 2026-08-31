import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import { subscriptionApi } from "../../lib/services";
import "../requestListingPage/requestListingPage.scss";
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
  size: "",
  type: "sale",
  property: "apartment",
  description: "",
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
      <Popup>{t("newPost.location.popup")}</Popup>
    </Marker>
  );
}

function NewPostPage() {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();

  const role = String(currentUser?.role || "").toUpperCase();
  const isSelfList = role === "USER";

  const [step, setStep] = useState("details");
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newPostId, setNewPostId] = useState("");
  const [imagePreviews, setImagePreviews] = useState([]);
  const [mapType, setMapType] = useState("map");
  const [quota, setQuota] = useState(null);

  const isLandProperty = form.property === "land";

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!isSelfList) {
      setQuota(null);
      return undefined;
    }

    let cancelled = false;
    subscriptionApi
      .me()
      .then((res) => {
        if (!cancelled) {
          setQuota(res.data?.listingQuota || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuota(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSelfList]);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

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
    }),
    [form, images]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      if (name === "property" && value === "land") {
        return {
          ...prev,
          property: value,
          bedroom: "0",
          bathroom: "0",
        };
      }

      if (name === "property" && prev.property === "land") {
        return {
          ...prev,
          property: value,
          bedroom: prev.bedroom === "0" ? "1" : prev.bedroom,
          bathroom: prev.bathroom === "0" ? "1" : prev.bathroom,
        };
      }

      return { ...prev, [name]: value };
    });

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

  const handleSelectLocation = (nextLocation) => {
    setLocation(nextLocation);
    setError("");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t("newPost.validation.locationNotSupported"));
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
        setError(t("newPost.validation.locationFailed"));
        setLocating(false);
      }
    );
  };

  const validateDetails = () => {
    if (!form.title.trim() || !form.address.trim() || !form.city.trim()) {
      return t("newPost.validation.requiredFields");
    }
    if (!form.price || Number(form.price) <= 0) {
      return t("newPost.validation.price");
    }
    if (!isLandProperty) {
      if (form.bedroom === "" || Number(form.bedroom) < 0) {
        return t("newPost.validation.bedrooms");
      }
      if (form.bathroom === "" || Number(form.bathroom) < 0) {
        return t("newPost.validation.bathrooms");
      }
    }
    if (!form.description.trim() || form.description.trim().length < 20) {
      return t("newPost.validation.description");
    }
    if (!location) {
      return t("newPost.validation.location");
    }
    if (images.length === 0) {
      return t("newPost.validation.images");
    }
    return "";
  };

  const listingBlocked = Boolean(isSelfList && quota && !quota.allowed);

  const goToConfirm = (e) => {
    e.preventDefault();
    if (listingBlocked) {
      setError(t("listingPlan.limitError"));
      return;
    }
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

    if (listingBlocked) {
      setError(t("listingPlan.limitError"));
      setStep("details");
      return;
    }

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

      const postData = {
        title: form.title.trim(),
        price: Number(form.price),
        address: form.address.trim(),
        city: form.city.trim(),
        bedroom: isLandProperty ? 0 : Number(form.bedroom),
        bathroom: isLandProperty ? 0 : Number(form.bathroom),
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        type: form.type,
        property: form.property,
      };

      const postDetail = {
        desc: form.description.trim(),
        description: form.description.trim(),
        size: form.size ? Number(form.size) : null,
      };

      const data = new FormData();
      data.append("postData", JSON.stringify(postData));
      data.append("postDetail", JSON.stringify(postDetail));
      images.forEach((file) => data.append("images", file));

      const res = await apiRequest.post("/posts", data, {
        withCredentials: true,
      });

      const createdId = res.data?.id || res.data?.post?.id || "";
      setNewPostId(createdId);
      setSuccess(
        t(isSelfList ? "newPost.moderation.success" : "newPost.success.added")
      );
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || t("newPost.errors.addFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <main className="requestListingPage pageFade">
      <section className="requestHero">
        <div>
          <p className="requestEyebrow">
            {t(isSelfList ? "newPost.moderation.badge" : "newPost.hero.badge")}
          </p>
          <h1>
            {t(isSelfList ? "newPost.moderation.title" : "newPost.hero.title")}
          </h1>
          <span>
            {t(
              isSelfList
                ? "newPost.moderation.description"
                : "newPost.hero.description"
            )}
          </span>
        </div>

        <div className="requestHeroActions">
          {isSelfList && (
            <Link to="/request-listing" className="requestGhostBtn">
              {t("newPost.moderation.switchPath")}
            </Link>
          )}
          <Link to="/my-homes" className="requestGhostBtn">
            {t("newPost.hero.myListings")}
          </Link>
        </div>
      </section>

      <section className="requestStats">
        <div>
          <span>{t("newPost.stats.brief")}</span>
          <strong>{t("newPost.stats.briefValue")}</strong>
        </div>
        <div>
          <span>
            {t(isSelfList ? "newPost.moderation.review" : "newPost.stats.review")}
          </span>
          <strong>
            {t(
              isSelfList
                ? "newPost.moderation.reviewValue"
                : "newPost.stats.reviewValue"
            )}
          </strong>
        </div>
        <div>
          <span>
            {t(isSelfList ? "newPost.moderation.live" : "newPost.stats.live")}
          </span>
          <strong>
            {t(
              isSelfList
                ? "newPost.moderation.liveValue"
                : "newPost.stats.liveValue"
            )}
          </strong>
        </div>
      </section>

      {isSelfList && quota && (
        <div className={`requestAlert ${listingBlocked ? "error" : ""}`}>
          {quota.launchPremiumFree
            ? t("listingPlan.launchNotice", {
                date: new Date(quota.launchFreeUntil).toLocaleDateString(
                  undefined,
                  { year: "numeric", month: "short", day: "numeric" }
                ),
                price: quota.priceMonthly,
              })
            : quota.unlimited
              ? t("listingPlan.premiumActive")
              : t("listingPlan.remaining", {
                  remaining: quota.remaining,
                  limit: quota.freeLimit,
                  used: quota.used,
                  price: quota.priceMonthly,
                })}
        </div>
      )}

      <nav
        className="requestTabs"
        aria-label={t(isSelfList ? "newPost.moderation.badge" : "newPost.hero.badge")}
      >
        <button type="button" className={step === "details" ? "isActive" : ""}>
          {t("newPost.steps.details")}
        </button>
        <button
          type="button"
          className={step === "confirm" || step === "done" ? "isActive" : ""}
        >
          {t(
            isSelfList ? "newPost.moderation.confirmStep" : "newPost.steps.confirm"
          )}
        </button>
      </nav>

      {listingBlocked && (
        <section className="requestCard">
          <header className="requestCardHeader">
            <p className="requestEyebrow">{t("listingPlan.limitBadge")}</p>
            <h2>{t("listingPlan.limitTitle")}</h2>
            <p>
              {t("listingPlan.limitText", {
                price: quota?.priceMonthly ?? 20,
                limit: quota?.freeLimit ?? 1,
              })}
            </p>
          </header>
          <div className="requestActions">
            <Link to="/billing" className="requestPrimaryBtn">
              {t("listingPlan.upgrade")}
            </Link>
            <Link to="/request-listing" className="requestTextLink">
              {t("listingPlan.useAgent")}
            </Link>
          </div>
        </section>
      )}

      {step === "details" && !listingBlocked && (
        <form className="requestForm" onSubmit={goToConfirm}>
          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("newPost.details.badge")}</p>
              <h2>{t("newPost.details.title")}</h2>
              <p>{t("newPost.details.description")}</p>
            </header>

            <div className="requestGrid">
              <label className="requestField">
                {t("newPost.form.title")}
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder={t("newPost.form.titlePlaceholder")}
                  required
                />
              </label>

              <label className="requestField">
                {t("newPost.form.price")}
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
                {t("newPost.form.city")}
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder={t("newPost.form.cityPlaceholder")}
                  required
                />
              </label>

              <label className="requestField">
                {t("newPost.form.address")}
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder={t("newPost.form.addressPlaceholder")}
                  required
                />
              </label>

              <label className="requestField">
                {t("newPost.form.listingType")}
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="sale">{t("newPost.options.sale")}</option>
                  <option value="rent">{t("newPost.options.rent")}</option>
                </select>
              </label>

              <label className="requestField">
                {t("newPost.form.category")}
                <select
                  name="property"
                  value={form.property}
                  onChange={handleChange}
                >
                  {PROPERTY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`newPost.options.${option}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className={
                  isLandProperty ? "requestField isLocked" : "requestField"
                }
              >
                {t("newPost.form.bedrooms")}
                {isLandProperty && (
                  <small>{t("newPost.form.landLocked")}</small>
                )}
                <input
                  name="bedroom"
                  type="number"
                  min="0"
                  value={isLandProperty ? "0" : form.bedroom}
                  onChange={handleChange}
                  disabled={isLandProperty}
                  placeholder={isLandProperty ? "—" : "2"}
                />
              </label>

              <label
                className={
                  isLandProperty ? "requestField isLocked" : "requestField"
                }
              >
                {t("newPost.form.bathrooms")}
                {isLandProperty && (
                  <small>{t("newPost.form.landLocked")}</small>
                )}
                <input
                  name="bathroom"
                  type="number"
                  min="0"
                  value={isLandProperty ? "0" : form.bathroom}
                  onChange={handleChange}
                  disabled={isLandProperty}
                  placeholder={isLandProperty ? "—" : "1"}
                />
              </label>

              <label className="requestField">
                {t("newPost.form.size")}
                <input
                  name="size"
                  type="number"
                  min="0"
                  value={form.size}
                  onChange={handleChange}
                  placeholder="120"
                />
              </label>

              <label className="requestField wide">
                {t("newPost.form.description")}
                <textarea
                  name="description"
                  rows={6}
                  value={form.description}
                  onChange={handleChange}
                  placeholder={t("newPost.form.descriptionPlaceholder")}
                  required
                  minLength={20}
                />
              </label>
            </div>
          </section>

          <section className="requestCard">
            <header className="requestCardHeader mapHeader">
              <div>
                <p className="requestEyebrow">{t("newPost.location.badge")}</p>
                <h2>{t("newPost.location.title")}</h2>
                <p>{t("newPost.location.description")}</p>
              </div>
              <button
                type="button"
                className="requestPrimaryBtn"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating
                  ? t("newPost.location.locating")
                  : t("newPost.location.useMyLocation")}
              </button>
            </header>

            {location && (
              <div className="requestCoords">
                <span>
                  {t("newPost.location.lat")}: {location.latitude.toFixed(6)}
                </span>
                <span>
                  {t("newPost.location.lng")}: {location.longitude.toFixed(6)}
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
                    {t("newPost.location.pinSet")}
                  </div>
                )}

                {!location && (
                  <div className="mapEmptyOverlay mapEmptySoft">
                    <div>
                      <p>{t("newPost.location.clickHint")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("newPost.media.badge")}</p>
              <h2>{t("newPost.media.title")}</h2>
              <p>{t("newPost.media.description")}</p>
            </header>

            <label className="requestDrop">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImages}
              />
              <strong>{t("newPost.media.upload")}</strong>
              <span>{t("newPost.media.hint")}</span>
            </label>

            {images.length > 0 && (
              <div className="requestThumbs">
                {images.map((file, index) => (
                  <figure key={`${file.name}-${index}`}>
                    <img src={imagePreviews[index]} alt={file.name} />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={t("newPost.media.remove")}
                    >
                      {t("newPost.media.remove")}
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>

          {error && <div className="requestAlert error">{error}</div>}

          <div className="requestActions">
            <button type="submit" className="requestPrimaryBtn">
              {t("newPost.actions.continue")}
            </button>
            <Link to="/profile" className="requestTextLink">
              {t("newPost.actions.cancel")}
            </Link>
          </div>
        </form>
      )}

      {step === "confirm" && !listingBlocked && (
        <form className="requestForm" onSubmit={handleSubmit}>
          <section className="requestCard">
            <header className="requestCardHeader">
              <p className="requestEyebrow">{t("newPost.confirm.badge")}</p>
              <h2>
                {t(
                  isSelfList
                    ? "newPost.moderation.confirmTitle"
                    : "newPost.confirm.title"
                )}
              </h2>
              <p>
                {t(
                  isSelfList
                    ? "newPost.moderation.confirmDescription"
                    : "newPost.confirm.description",
                  {
                    city: summary.city || t("newPost.confirm.yourArea"),
                    property: t(`newPost.options.${summary.property}`),
                  }
                )}
              </p>
            </header>

            <ul className="requestSummary">
              <li>
                <span>{t("newPost.form.title")}</span>
                <strong>{summary.title}</strong>
              </li>
              <li>
                <span>{t("newPost.form.address")}</span>
                <strong>
                  {summary.address}, {summary.city}
                </strong>
              </li>
              <li>
                <span>{t("newPost.form.price")}</span>
                <strong>${Number(summary.price || 0).toLocaleString()}</strong>
              </li>
              <li>
                <span>{t("newPost.confirm.deal")}</span>
                <strong>
                  {t(`newPost.options.${summary.type}`)} ·{" "}
                  {t(`newPost.options.${summary.property}`)}
                </strong>
              </li>
              {!isLandProperty && (
                <li>
                  <span>{t("newPost.confirm.layout")}</span>
                  <strong>
                    {t("newPost.confirm.bedsBaths", {
                      beds: summary.bedroom || 0,
                      baths: summary.bathroom || 0,
                    })}
                  </strong>
                </li>
              )}
              {summary.size && (
                <li>
                  <span>{t("newPost.form.size")}</span>
                  <strong>{summary.size} m²</strong>
                </li>
              )}
              <li>
                <span>{t("newPost.media.title")}</span>
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
                ? t(
                    isSelfList
                      ? "newPost.moderation.submitting"
                      : "newPost.actions.submitting"
                  )
                : t(
                    isSelfList
                      ? "newPost.moderation.submit"
                      : "newPost.actions.submit"
                  )}
            </button>
            <button
              type="button"
              className="requestGhostBtn"
              onClick={() => setStep("details")}
            >
              {t("newPost.actions.back")}
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <section className="requestCard requestDone">
          <header className="requestCardHeader">
            <p className="requestEyebrow">
              {t(isSelfList ? "newPost.moderation.doneBadge" : "newPost.done.badge")}
            </p>
            <h2>
              {t(isSelfList ? "newPost.moderation.doneTitle" : "newPost.done.title")}
            </h2>
            <p>
              {t(
                isSelfList
                  ? "newPost.moderation.doneDescription"
                  : "newPost.done.description"
              )}
            </p>
          </header>

          {success && <div className="requestAlert success">{success}</div>}

          <div className="requestActions">
            <Link
              to={
                newPostId && !isSelfList
                  ? `/properties/${newPostId}`
                  : "/my-homes"
              }
              className="requestPrimaryBtn"
            >
              {newPostId && !isSelfList
                ? t("newPost.actions.viewListing")
                : t("newPost.hero.myListings")}
            </Link>
            <button
              type="button"
              className="requestGhostBtn"
              onClick={() => navigate("/")}
            >
              {t("newPost.actions.home")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default NewPostPage;
