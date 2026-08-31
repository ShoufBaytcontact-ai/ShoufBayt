import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import "../requestListingPage/requestListingPage.scss";
import "../../components/map/map.scss";
import "./editPostPage.scss";

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

const MAX_TOTAL_IMAGES = 20;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const initialForm = {
  title: "",
  price: "",
  address: "",
  city: "",
  bedroom: "",
  bathroom: "",
  size: "",
  type: "buy",
  property: "apartment",
  desc: "",
};

function getServerUrl() {
  return (process.env.REACT_APP_API_URL || "http://localhost:8800/api").replace(
    "/api",
    ""
  );
}

function getImageUrl(image, fallback = "/no-image.png") {
  if (!image || typeof image !== "string") return fallback;

  if (
    image.startsWith("http") ||
    image.startsWith("data:") ||
    image.startsWith("blob:") ||
    image.startsWith("/no-")
  ) {
    return image;
  }

  const serverUrl = getServerUrl();
  return `${serverUrl}${image.startsWith("/") ? "" : "/"}${image}`;
}

function getPlainText(html) {
  return String(html || "")
    .replace(/<(.|\n)*?>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDealType(post) {
  const value = String(post?.type || post?.listingType || "").toLowerCase();
  return value === "rent" ? "rent" : "buy";
}

function normalizeCategory(post) {
  const value = String(post?.property || post?.propertyType || "apartment")
    .toLowerCase();
  return PROPERTY_OPTIONS.includes(value) ? value : "apartment";
}

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

function LocationPicker({ location, onSelectLocation, popupText }) {
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
    <Marker
      position={[location.latitude, location.longitude]}
      icon={locationIcon}
    >
      <Popup>{popupText}</Popup>
    </Marker>
  );
}

function EditPostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();

  const previewUrlsRef = useRef([]);

  const [form, setForm] = useState(initialForm);
  const [postOwnerId, setPostOwnerId] = useState("");
  const [postRequesterId, setPostRequesterId] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [location, setLocation] = useState(null);
  const [mapType, setMapType] = useState("map");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentUserId = String(currentUser?.id || currentUser?._id || "");
  const isAdmin = String(currentUser?.role || "").toUpperCase() === "ADMIN";
  const isOwner = currentUserId === String(postOwnerId || "");
  const isRequester = currentUserId === String(postRequesterId || "");
  const canEditPost = Boolean(
    currentUser && postOwnerId && (isOwner || isRequester || isAdmin)
  );
  const isLand = form.property === "land";
  const totalImages = existingImages.length + newImages.length;

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await apiRequest.get(`/posts/${id}`);
        const post = res.data?.data || res.data?.post || res.data;

        if (!post) {
          setError(t("editPost.errors.notFound"));
          return;
        }

        if (cancelled) return;

        const latitude = Number(post.latitude);
        const longitude = Number(post.longitude);
        const images = Array.isArray(post.images)
          ? post.images.filter(Boolean)
          : [];

        setPostOwnerId(post.userId || post.user?.id || post.user?._id || "");
        setPostRequesterId(post.requestedByUserId || "");
        setExistingImages(images);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setLocation({ latitude, longitude });
        }

        setForm({
          title: post.title || "",
          price: post.price || "",
          address: post.address || "",
          city: post.city || "",
          bedroom: post.bedroom ?? post.bedrooms ?? "",
          bathroom: post.bathroom ?? post.bathrooms ?? "",
          size: post.postDetail?.size || post.area || "",
          type: normalizeDealType(post),
          property: normalizeCategory(post),
          desc: getPlainText(post.postDetail?.desc || post.postDetail?.description),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || t("editPost.errors.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (postOwnerId && !canEditPost) {
      alert(t("editPost.alerts.notAllowedEdit"));
      navigate("/my-homes");
    }
  }, [loading, currentUser, postOwnerId, canEditPost, navigate, t]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => {
      if (name === "property" && value === "land") {
        return { ...prev, property: value, bedroom: "0", bathroom: "0" };
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

  const handleSelectLocation = (nextLocation) => {
    setLocation(nextLocation);
    setError("");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t("editPost.validation.locationNotSupported"));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSelectLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setError(t("editPost.validation.locationFailed"));
        setLocating(false);
      }
    );
  };

  const handleNewImages = (event) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      String(file.type || "").startsWith("image/")
    );

    if (!files.length) return;

    if (totalImages + files.length > MAX_TOTAL_IMAGES) {
      setError(t("editPost.validation.maxImages", { max: MAX_TOTAL_IMAGES }));
      event.target.value = "";
      return;
    }

    if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError(t("editPost.validation.imageSize"));
      event.target.value = "";
      return;
    }

    const previews = files.map((file) => URL.createObjectURL(file));
    previewUrlsRef.current = [...previewUrlsRef.current, ...previews];
    setNewImages((prev) => [...prev, ...files]);
    setNewImagePreviews((prev) => [...prev, ...previews]);
    setError("");
    event.target.value = "";
  };

  const removeExistingImage = (imageUrl) => {
    setExistingImages((prev) => prev.filter((image) => image !== imageUrl));
  };

  const removeNewImage = (index) => {
    const preview = newImagePreviews[index];
    if (preview) {
      URL.revokeObjectURL(preview);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== preview
      );
    }
    setNewImages((prev) => prev.filter((_, item) => item !== index));
    setNewImagePreviews((prev) => prev.filter((_, item) => item !== index));
  };

  const validate = () => {
    if (!form.title.trim() || !form.city.trim() || !form.address.trim()) {
      return t("editPost.validation.titleRequired");
    }
    if (!form.price || Number(form.price) <= 0) {
      return t("editPost.validation.priceRequired");
    }
    if (!isLand && (form.bedroom === "" || Number(form.bedroom) < 0)) {
      return t("editPost.validation.bedroomRequired");
    }
    if (!isLand && (form.bathroom === "" || Number(form.bathroom) < 0)) {
      return t("editPost.validation.bathroomRequired");
    }
    if (!form.desc.trim()) {
      return t("editPost.validation.descriptionRequired");
    }
    if (totalImages === 0) {
      return t("editPost.validation.imageRequired");
    }
    if (!location) {
      return t("editPost.validation.locationRequired");
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || !canEditPost) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const data = new FormData();
      const payload = {
        title: form.title.trim(),
        price: Number(form.price),
        address: form.address.trim(),
        city: form.city.trim(),
        bedroom: isLand ? 0 : Number(form.bedroom),
        bathroom: isLand ? 0 : Number(form.bathroom),
        size: form.size ? Number(form.size) : "",
        type: form.type,
        property: form.property,
        desc: form.desc.trim(),
        latitude: String(location.latitude),
        longitude: String(location.longitude),
      };

      Object.entries(payload).forEach(([key, value]) => {
        data.append(key, value);
      });

      data.append("existingImages", JSON.stringify(existingImages));
      newImages.forEach((image) => data.append("images", image));

      await apiRequest.put(`/posts/${id}`, data, { withCredentials: true });
      navigate(`/properties/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || t("editPost.errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => ({
      photos: totalImages,
      city: form.city.trim() || "—",
      deal: form.type === "rent" ? t("editPost.options.rent") : t("editPost.options.buy"),
    }),
    [totalImages, form.city, form.type, t]
  );

  if (loading) {
    return (
      <main className="requestListingPage editPostPage pageFade">
        <div className="requestAlert">{t("editPost.loading.message")}</div>
      </main>
    );
  }

  if (error && !form.title) {
    return (
      <main className="requestListingPage editPostPage pageFade">
        <section className="requestHero">
          <div>
            <p className="requestEyebrow">{t("editPost.header.badge")}</p>
            <h1>{t("editPost.loadError.title")}</h1>
            <span>{error}</span>
          </div>
          <Link to="/my-homes" className="requestGhostBtn">
            {t("editPost.loadError.backToProfile")}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="requestListingPage editPostPage pageFade">
      <section className="requestHero">
        <div>
          <p className="requestEyebrow">{t("editPost.header.badge")}</p>
          <h1>{t("editPost.header.title")}</h1>
          <span>{t("editPost.header.description")}</span>
        </div>
        <div className="requestHeroActions">
          <Link to={`/properties/${id}`} className="requestGhostBtn">
            {t("editPost.header.viewProperty")}
          </Link>
        </div>
      </section>

      <section className="requestStats">
        <div>
          <span>{t("editPost.gallery.totalImages")}</span>
          <strong>{summary.photos}</strong>
        </div>
        <div>
          <span>{t("editPost.form.city")}</span>
          <strong>{summary.city}</strong>
        </div>
        <div>
          <span>{t("editPost.form.type")}</span>
          <strong>{summary.deal}</strong>
        </div>
      </section>

      <form className="requestForm" onSubmit={handleSubmit}>
        <section className="requestCard">
          <header className="requestCardHeader">
            <p className="requestEyebrow">{t("editPost.main.badge")}</p>
            <h2>{t("editPost.main.title")}</h2>
            <p>{t("editPost.main.description")}</p>
          </header>

          <div className="requestGrid">
            <label className="requestField wide">
              {t("editPost.form.title")}
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </label>

            <label className="requestField">
              {t("editPost.form.price")}
              <input
                name="price"
                type="number"
                min="1"
                value={form.price}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </label>

            <label className="requestField">
              {t("editPost.form.city")}
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </label>

            <label className="requestField wide">
              {t("editPost.form.address")}
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                disabled={saving}
                required
              />
            </label>

            <label className="requestField">
              {t("editPost.form.type")}
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="buy">{t("editPost.options.buy")}</option>
                <option value="rent">{t("editPost.options.rent")}</option>
              </select>
            </label>

            <label className="requestField">
              {t("editPost.form.property")}
              <select
                name="property"
                value={form.property}
                onChange={handleChange}
                disabled={saving}
              >
                {PROPERTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`newPost.options.${option}`, {
                      defaultValue: option,
                    })}
                  </option>
                ))}
              </select>
            </label>

            <label className={isLand ? "requestField isLocked" : "requestField"}>
              {t("editPost.form.bedrooms")}
              <input
                name="bedroom"
                type="number"
                min="0"
                value={isLand ? "0" : form.bedroom}
                onChange={handleChange}
                disabled={saving || isLand}
              />
            </label>

            <label className={isLand ? "requestField isLocked" : "requestField"}>
              {t("editPost.form.bathrooms")}
              <input
                name="bathroom"
                type="number"
                min="0"
                value={isLand ? "0" : form.bathroom}
                onChange={handleChange}
                disabled={saving || isLand}
              />
            </label>

            <label className="requestField">
              {t("editPost.form.size")}
              <input
                name="size"
                type="number"
                min="0"
                value={form.size}
                onChange={handleChange}
                disabled={saving}
              />
            </label>
          </div>
        </section>

        <section className="requestCard">
          <header className="requestCardHeader">
            <p className="requestEyebrow">{t("editPost.description.badge")}</p>
            <h2>{t("editPost.description.title")}</h2>
            <p>{t("editPost.description.description")}</p>
          </header>

          <label className="requestField wide">
            {t("newPost.form.description")}
            <textarea
              name="desc"
              rows={7}
              value={form.desc}
              onChange={handleChange}
              placeholder={t("editPost.description.manualPlaceholder")}
              disabled={saving}
            />
          </label>
        </section>

        <section className="requestCard">
          <header className="requestCardHeader mapHeader">
            <div>
              <p className="requestEyebrow">{t("editPost.location.badge")}</p>
              <h2>{t("editPost.location.title")}</h2>
              <p>{t("editPost.location.description")}</p>
            </div>
            <button
              type="button"
              className="requestPrimaryBtn"
              onClick={useMyLocation}
              disabled={locating || saving}
            >
              {locating
                ? t("editPost.location.locating")
                : t("editPost.location.useMyLocation")}
            </button>
          </header>

          {location && (
            <div className="requestCoords">
              <span>
                {t("editPost.location.latitude")}: {location.latitude.toFixed(6)}
              </span>
              <span>
                {t("editPost.location.longitude")}: {location.longitude.toFixed(6)}
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
                  popupText={t("editPost.location.popup")}
                />
              </MapContainer>

              <div className="mapTypeSwitch" role="group">
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
            </div>
          </div>
        </section>

        <section className="requestCard">
          <header className="requestCardHeader">
            <p className="requestEyebrow">{t("editPost.gallery.badge")}</p>
            <h2>{t("editPost.gallery.title")}</h2>
            <p>{t("editPost.gallery.description")}</p>
          </header>

          <label className="requestDrop">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleNewImages}
              disabled={saving}
            />
            <strong>{t("editPost.gallery.uploadNewImages")}</strong>
            <span>{t("editPost.gallery.accepted")}</span>
          </label>

          {totalImages > 0 ? (
            <div className="requestThumbs">
              {existingImages.map((image) => (
                <figure key={image}>
                  <img
                    src={getImageUrl(image)}
                    alt={t("editPost.gallery.propertyAlt")}
                    onError={(event) => {
                      event.currentTarget.src = "/no-image.png";
                    }}
                  />
                  <em className="editThumbTag">{t("editPost.gallery.old")}</em>
                  <button
                    type="button"
                    onClick={() => removeExistingImage(image)}
                    disabled={saving}
                  >
                    {t("newPost.media.remove")}
                  </button>
                </figure>
              ))}
              {newImagePreviews.map((image, index) => (
                <figure key={image}>
                  <img src={image} alt={t("editPost.gallery.newPropertyAlt")} />
                  <em className="editThumbTag isNew">{t("editPost.gallery.new")}</em>
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    disabled={saving}
                  >
                    {t("newPost.media.remove")}
                  </button>
                </figure>
              ))}
            </div>
          ) : (
            <p className="editEmptyNote">{t("editPost.gallery.noImagesLeftText")}</p>
          )}
        </section>

        {error && <div className="requestAlert error">{error}</div>}

        <div className="requestActions">
          <button
            type="submit"
            className="requestPrimaryBtn"
            disabled={saving || !canEditPost}
          >
            {saving ? t("editPost.actions.saving") : t("editPost.actions.saveChanges")}
          </button>
          <Link to={`/properties/${id}`} className="requestTextLink">
            {t("editPost.actions.cancel")}
          </Link>
        </div>
      </form>
    </main>
  );
}

export default EditPostPage;
