import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./editPostPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "/pin.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -36],
});

const defaultMapCenter = [33.8938, 35.5018];
const MAX_TOTAL_IMAGES = 20;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const initialFormData = {
  title: "",
  price: "",
  address: "",
  city: "",
  bedroom: "",
  bathroom: "",
  latitude: "",
  longitude: "",
  type: "buy",
  property: "apartment",
  size: "",
  desc: "",
};

function ChangeMapCenter({ location }) {
  const map = useMap();

  useEffect(() => {
    if (!location) {
      return;
    }

    map.setView([location.latitude, location.longitude], 15);

    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timeout);
  }, [map, location]);

  return null;
}

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

function LocationPicker({ location, onSelectLocation }) {
  useMapEvents({
    click(e) {
      onSelectLocation({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });

  if (!location) {
    return null;
  }

  return (
    <Marker position={[location.latitude, location.longitude]} icon={markerIcon}>
      <Popup>Selected property location</Popup>
    </Marker>
  );
}

function getPlainText(html) {
  return String(html || "")
    .replace(/<(.|\n)*?>/g, "")
    .trim();
}

function isValidImageType(file) {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  return allowedTypes.includes(file.type);
}

function getPostOwnerId(post) {
  return post?.userId || post?.user?.id || "";
}

function getPostImages(post) {
  return Array.isArray(post?.images) ? post.images.filter(Boolean) : [];
}

function EditPostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);

  const previewUrlsRef = useRef([]);

  const [formData, setFormData] = useState(initialFormData);
  const [descriptionMode, setDescriptionMode] = useState("manual");
  const [aiLoading, setAiLoading] = useState(false);

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const [postOwnerId, setPostOwnerId] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [mainPreview, setMainPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = currentUser?.role?.toUpperCase() === "ADMIN";
  const isOwner = String(currentUser?.id || "") === String(postOwnerId || "");
  const canEditPost = Boolean(currentUser && postOwnerId && (isOwner || isAdmin));

  const allImages = useMemo(() => {
    return [...existingImages, ...newImagePreviews];
  }, [existingImages, newImagePreviews]);

  const plainDescription = useMemo(() => {
    return getPlainText(formData.desc);
  }, [formData.desc]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mainPreview && allImages.length > 0) {
      setMainPreview(allImages[0]);
      return;
    }

    if (mainPreview && !allImages.includes(mainPreview)) {
      setMainPreview(allImages[0] || "");
    }
  }, [allImages, mainPreview]);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const res = await apiRequest.get(`/posts/${id}`);
        const post = res.data;

        const postLatitude = Number(post.latitude);
        const postLongitude = Number(post.longitude);

        if (Number.isFinite(postLatitude) && Number.isFinite(postLongitude)) {
          setLocation({
            latitude: postLatitude,
            longitude: postLongitude,
          });
        }

        const images = getPostImages(post);

        setPostOwnerId(getPostOwnerId(post));
        setExistingImages(images);
        setMainPreview(images[0] || "");

        setFormData({
          title: post.title || "",
          price: post.price || "",
          address: post.address || "",
          city: post.city || "",
          bedroom: post.bedroom ?? "",
          bathroom: post.bathroom ?? "",
          latitude: post.latitude || "",
          longitude: post.longitude || "",
          type: post.type || "buy",
          property: post.property || "apartment",
          size: post.postDetail?.size || "",
          desc: post.postDetail?.desc || "",
        });
      } catch (err) {
        console.log("LOAD EDIT POST ERROR:", err);
        setError(err.response?.data?.message || "Failed to load property.");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (postOwnerId && !canEditPost) {
      alert("You are not allowed to edit this property.");
      navigate("/profile");
    }
  }, [loading, currentUser, postOwnerId, canEditPost, navigate]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const handleDescriptionChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      desc: value,
    }));

    clearMessages();
  };

  const handleSelectLocation = (selectedLocation) => {
    setLocation(selectedLocation);

    setFormData((prev) => ({
      ...prev,
      latitude: String(selectedLocation.latitude),
      longitude: String(selectedLocation.longitude),
    }));

    clearMessages();
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSelectLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocating(false);
      },
      () => {
        setError(
          "Failed to get your location. Please select it manually on the map."
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const handleGenerateDescription = async () => {
    if (aiLoading) {
      return;
    }

    if (!formData.title.trim()) {
      setError("Please write the property title first.");
      return;
    }

    if (!formData.city.trim()) {
      setError("Please write the city first.");
      return;
    }

    if (!formData.price || Number(formData.price) <= 0) {
      setError("Please write a valid price first.");
      return;
    }

    try {
      setAiLoading(true);
      setError("");
      setSuccess("");

      const res = await apiRequest.post("/ai/property-description", {
        title: formData.title,
        price: formData.price,
        address: formData.address,
        city: formData.city,
        bedroom: formData.bedroom,
        bathroom: formData.bathroom,
        size: formData.size,
        type: formData.type,
        property: formData.property,
      });

      setFormData((prev) => ({
        ...prev,
        desc: res.data.description || "",
      }));

      setSuccess(
        "AI description generated successfully. You can edit it before saving."
      );
    } catch (err) {
      console.log("AI DESCRIPTION ERROR:", err);
      setError(err.response?.data?.message || "Failed to generate description.");
    } finally {
      setAiLoading(false);
    }
  };

  const validateNewImages = (selectedFiles) => {
    const currentTotal = existingImages.length + newImages.length;

    if (currentTotal + selectedFiles.length > MAX_TOTAL_IMAGES) {
      return `You can keep/upload a maximum of ${MAX_TOTAL_IMAGES} images.`;
    }

    const invalidFile = selectedFiles.find((file) => !isValidImageType(file));

    if (invalidFile) {
      return "Only image files are allowed: JPG, PNG, JPEG, or WEBP.";
    }

    const largeFile = selectedFiles.find((file) => file.size > MAX_IMAGE_SIZE);

    if (largeFile) {
      return "Each image must be less than 8MB.";
    }

    return "";
  };

  const handleNewImagesChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) {
      return;
    }

    const imageError = validateNewImages(selectedFiles);

    if (imageError) {
      setError(imageError);
      e.target.value = "";
      return;
    }

    const previews = selectedFiles.map((file) => URL.createObjectURL(file));

    previewUrlsRef.current = [...previewUrlsRef.current, ...previews];

    setNewImages((prev) => [...prev, ...selectedFiles]);
    setNewImagePreviews((prev) => [...prev, ...previews]);

    if (!mainPreview && previews.length > 0) {
      setMainPreview(previews[0]);
    }

    clearMessages();
    e.target.value = "";
  };

  const handleRemoveExistingImage = (imageUrl) => {
    setExistingImages((prev) => prev.filter((image) => image !== imageUrl));
    clearMessages();
  };

  const handleRemoveNewImage = (index) => {
    const previewToRemove = newImagePreviews[index];

    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== previewToRemove
      );
    }

    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));

    clearMessages();
  };

  const validateForm = () => {
    const totalImages = existingImages.length + newImages.length;

    if (!formData.title.trim()) {
      return "Title is required.";
    }

    if (!formData.price || Number(formData.price) <= 0) {
      return "Price must be greater than 0.";
    }

    if (!formData.city.trim()) {
      return "City is required.";
    }

    if (!formData.address.trim()) {
      return "Address is required.";
    }

    if (formData.bedroom === "" || Number(formData.bedroom) < 0) {
      return "Bedroom number is required.";
    }

    if (formData.bathroom === "" || Number(formData.bathroom) < 0) {
      return "Bathroom number is required.";
    }

    if (formData.size && Number(formData.size) < 0) {
      return "Size cannot be negative.";
    }

    if (!plainDescription) {
      return "Description is required.";
    }

    if (totalImages === 0) {
      return "Please keep or upload at least one image.";
    }

    if (location?.latitude == null || location?.longitude == null) {
      return "Please select the property location on the map.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving || aiLoading) {
      return;
    }

    if (!canEditPost) {
      alert("You are not allowed to edit this property.");
      navigate("/profile");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const data = new FormData();

      const payload = {
        ...formData,
        title: formData.title.trim(),
        price: Number(formData.price),
        address: formData.address.trim(),
        city: formData.city.trim(),
        bedroom: Number(formData.bedroom),
        bathroom: Number(formData.bathroom),
        size: formData.size ? Number(formData.size) : "",
        latitude: String(location.latitude),
        longitude: String(location.longitude),
      };

      Object.entries(payload).forEach(([key, value]) => {
        data.append(key, value);
      });

      data.append("existingImages", JSON.stringify(existingImages));

      newImages.forEach((image) => {
        data.append("images", image);
      });

      await apiRequest.put(`/posts/${id}`, data);

      navigate(`/properties/${id}`);
    } catch (err) {
      console.log("UPDATE POST ERROR:", err);
      setError(err.response?.data?.message || "Failed to update property.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="editPostPage pageFade">
        <div className="editStateBox">
          <span></span>
          <h2>Loading Property</h2>
          <p>Please wait while we load the property information.</p>
        </div>
      </div>
    );
  }

  if (error && !formData.title) {
    return (
      <div className="editPostPage pageFade">
        <div className="editStateBox errorState">
          <h2>Could Not Load Property</h2>
          <p>{error}</p>
          <Link to="/profile">Back to Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="editPostPage pageFade">
      <div className="editPostWrapper">
        <div className="editHeader">
          <div>
            <span>Edit Property</span>

            <h1>Update Property Details</h1>

            <p>
              Update property information, images, description, and map location.
              You can write the description manually or generate it with
              SmartEstate AI.
            </p>
          </div>

          <Link to={`/properties/${id}`} className="backBtn">
            View Property
          </Link>
        </div>

        <form className="editForm" onSubmit={handleSubmit}>
          <div className="editMain">
            <div className="formSection">
              <div className="sectionHeader">
                <span>Main Information</span>

                <h2>Property Details</h2>

                <p>Update the main information users see on your listing.</p>
              </div>

              <div className="formGrid">
                <div className="formGroup wide">
                  <label htmlFor="title">Title</label>

                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="price">Price</label>

                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="1"
                    value={formData.price}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="city">City</label>

                  <input
                    id="city"
                    name="city"
                    type="text"
                    value={formData.city}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup wide">
                  <label htmlFor="address">Address</label>

                  <input
                    id="address"
                    name="address"
                    type="text"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="bedroom">Bedrooms</label>

                  <input
                    id="bedroom"
                    name="bedroom"
                    type="number"
                    min="0"
                    value={formData.bedroom}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="bathroom">Bathrooms</label>

                  <input
                    id="bathroom"
                    name="bathroom"
                    type="number"
                    min="0"
                    value={formData.bathroom}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="size">Size m²</label>

                  <input
                    id="size"
                    name="size"
                    type="number"
                    min="0"
                    value={formData.size}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="type">Type</label>

                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  >
                    <option value="buy">Buy</option>
                    <option value="rent">Rent</option>
                  </select>
                </div>

                <div className="formGroup">
                  <label htmlFor="property">Property</label>

                  <select
                    id="property"
                    name="property"
                    value={formData.property}
                    onChange={handleChange}
                    disabled={saving || aiLoading}
                  >
                    <option value="apartment">Apartment</option>
                    <option value="house">House</option>
                    <option value="land">Land</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="formSection">
              <div className="sectionHeader">
                <span>Description</span>

                <h2>Property Overview</h2>

                <p>
                  Edit the description manually or regenerate it with SmartEstate
                  AI using the updated property details.
                </p>
              </div>

              <div className="descriptionModeTabs">
                <button
                  type="button"
                  className={descriptionMode === "manual" ? "active" : ""}
                  onClick={() => setDescriptionMode("manual")}
                  disabled={saving || aiLoading}
                >
                  Manual Description
                </button>

                <button
                  type="button"
                  className={descriptionMode === "ai" ? "active" : ""}
                  onClick={() => setDescriptionMode("ai")}
                  disabled={saving || aiLoading}
                >
                  SmartEstate AI
                </button>
              </div>

              {descriptionMode === "ai" && (
                <div className="aiDescriptionBox">
                  <div>
                    <span>AI Assistant</span>

                    <h3>Regenerate Description</h3>

                    <p>
                      SmartEstate AI will use the updated title, price, city,
                      type, bedrooms, bathrooms, and size to generate a polished
                      description.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={saving || aiLoading}
                  >
                    {aiLoading ? "Generating..." : "Generate Description"}
                  </button>
                </div>
              )}

              <div className="descriptionEditor">
                <ReactQuill
                  theme="snow"
                  value={formData.desc}
                  onChange={handleDescriptionChange}
                  placeholder={
                    descriptionMode === "ai"
                      ? "Click Generate Description, then edit the result if needed..."
                      : "Write property description manually..."
                  }
                  readOnly={saving || aiLoading}
                />
              </div>
            </div>

            <div className="formSection">
              <div className="sectionHeader mapHeader">
                <div>
                  <span>Location</span>

                  <h2>Update Location</h2>

                  <p>
                    Use your current location or click on the map to update the
                    exact property location.
                  </p>
                </div>

                <button
                  type="button"
                  className="locationButton"
                  onClick={handleUseCurrentLocation}
                  disabled={locating || saving || aiLoading}
                >
                  {locating ? "Locating..." : "Use My Location"}
                </button>
              </div>

              {location && (
                <div className="locationValues">
                  <span>Lat: {location.latitude.toFixed(6)}</span>
                  <span>Lng: {location.longitude.toFixed(6)}</span>
                </div>
              )}

              <div className="mapPickerBox">
                <MapContainer
                  className="locationMap"
                  center={
                    location
                      ? [location.latitude, location.longitude]
                      : defaultMapCenter
                  }
                  zoom={location ? 15 : 12}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <FixMapSize />

                  <ChangeMapCenter location={location} />

                  <LocationPicker
                    location={location}
                    onSelectLocation={handleSelectLocation}
                  />
                </MapContainer>
              </div>
            </div>
          </div>

          <aside className="editSide">
            <div className="imageSection">
              <div className="sectionHeader">
                <span>Gallery</span>

                <h2>Property Images</h2>

                <p>
                  Keep old images, remove unwanted ones, upload new photos, and
                  choose the main preview.
                </p>
              </div>

              <div className="gallerySummary">
                <div>
                  <strong>{allImages.length}</strong>
                  <span>Total Images</span>
                </div>

                <div>
                  <strong>{newImagePreviews.length}</strong>
                  <span>New Images</span>
                </div>
              </div>

              <div className="galleryPreview">
                {mainPreview ? (
                  <>
                    <img
                      src={mainPreview}
                      alt="Main property preview"
                      onError={(e) => {
                        e.currentTarget.src = "/no-image.png";
                      }}
                    />

                    <div className="previewOverlay">
                      <span>Main Preview</span>

                      <b>
                        {allImages.findIndex((image) => image === mainPreview) +
                          1}{" "}
                        / {allImages.length}
                      </b>
                    </div>
                  </>
                ) : (
                  <div className="emptyGalleryPreview">
                    <strong>No Image</strong>
                    <p>Upload or keep at least one image.</p>
                  </div>
                )}
              </div>

              <label className="uploadImagesBox">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleNewImagesChange}
                  disabled={saving || aiLoading}
                />

                <span>+</span>

                <strong>Upload New Images</strong>

                <small>JPG, PNG, JPEG, WEBP • Max 8MB each</small>
              </label>

              {allImages.length > 0 ? (
                <div className="galleryThumbs">
                  {existingImages.map((image) => (
                    <div
                      className={
                        mainPreview === image
                          ? "galleryThumb active"
                          : "galleryThumb"
                      }
                      key={image}
                    >
                      <button
                        type="button"
                        className="thumbImage"
                        onClick={() => setMainPreview(image)}
                      >
                        <img
                          src={image}
                          alt="Property"
                          onError={(e) => {
                            e.currentTarget.src = "/no-image.png";
                          }}
                        />
                      </button>

                      <span className="thumbLabel">Old</span>

                      <button
                        type="button"
                        className="thumbRemove"
                        onClick={() => handleRemoveExistingImage(image)}
                        disabled={saving || aiLoading}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {newImagePreviews.map((image, index) => (
                    <div
                      className={
                        mainPreview === image
                          ? "galleryThumb active"
                          : "galleryThumb"
                      }
                      key={image}
                    >
                      <button
                        type="button"
                        className="thumbImage"
                        onClick={() => setMainPreview(image)}
                      >
                        <img
                          src={image}
                          alt="New property"
                          onError={(e) => {
                            e.currentTarget.src = "/no-image.png";
                          }}
                        />
                      </button>

                      <span className="thumbLabel new">New</span>

                      <button
                        type="button"
                        className="thumbRemove"
                        onClick={() => handleRemoveNewImage(index)}
                        disabled={saving || aiLoading}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="emptyImagesBox">
                  <strong>No Images Left</strong>
                  <p>Please keep or upload at least one image.</p>
                </div>
              )}
            </div>

            {error && <div className="formError">{error}</div>}
            {success && <div className="formSuccess">{success}</div>}

            <div className="formActions">
              <button type="button" onClick={() => navigate(-1)}>
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || aiLoading || !canEditPost}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default EditPostPage;