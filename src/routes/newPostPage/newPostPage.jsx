import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./newPostPage.scss";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import apiRequest from "../../lib/apiRequest";

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
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const defaultMapCenter = [33.8938, 35.5018];
const MAX_PROPERTY_IMAGES = 20;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const initialForm = {
  title: "",
  price: "",
  address: "",
  city: "",
  bedroom: "",
  bathroom: "",
  size: "",
  type: "rent",
  property: "apartment",
};

function ChangeMapCenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.setView([position.latitude, position.longitude], 15);

    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timeout);
  }, [map, position]);

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

function NewPostPage() {
  const navigate = useNavigate();
  const previewUrlsRef = useRef([]);

  const [form, setForm] = useState(initialForm);
  const [description, setDescription] = useState("");
  const [descriptionMode, setDescriptionMode] = useState("manual");
  const [aiLoading, setAiLoading] = useState(false);

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [mainImage, setMainImage] = useState("");

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadedCount = imageFiles.length;

  const plainDescription = useMemo(() => {
    return getPlainText(description);
  }, [description]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mainImage && imagePreviews.length > 0) {
      setMainImage(imagePreviews[0]);
      return;
    }

    if (mainImage && !imagePreviews.includes(mainImage)) {
      setMainImage(imagePreviews[0] || "");
    }
  }, [imagePreviews, mainImage]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    clearMessages();
  };

  const handleSelectLocation = (selectedLocation) => {
    setLocation(selectedLocation);
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

  const validateImages = (files) => {
    if (imageFiles.length + files.length > MAX_PROPERTY_IMAGES) {
      return `You can upload a maximum of ${MAX_PROPERTY_IMAGES} images.`;
    }

    const invalidType = files.find((file) => !isValidImageType(file));

    if (invalidType) {
      return "Only image files are allowed: JPG, PNG, JPEG, or WEBP.";
    }

    const largeFile = files.find((file) => file.size > MAX_IMAGE_SIZE);

    if (largeFile) {
      return "Each image must be less than 8MB.";
    }

    return "";
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      return;
    }

    const imageError = validateImages(files);

    if (imageError) {
      setError(imageError);
      e.target.value = "";
      return;
    }

    const newPreviews = files.map((file) => URL.createObjectURL(file));

    previewUrlsRef.current = [...previewUrlsRef.current, ...newPreviews];

    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);

    if (!mainImage && newPreviews.length > 0) {
      setMainImage(newPreviews[0]);
    }

    clearMessages();
    e.target.value = "";
  };

  const handleRemoveImage = (index) => {
    const removedPreview = imagePreviews[index];

    if (removedPreview) {
      URL.revokeObjectURL(removedPreview);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== removedPreview
      );
    }

    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);

    setImageFiles(updatedFiles);
    setImagePreviews(updatedPreviews);

    if (mainImage === removedPreview) {
      setMainImage(updatedPreviews[0] || "");
    }

    clearMessages();
  };

  const handleGenerateDescription = async () => {
    if (aiLoading) {
      return;
    }

    if (!form.title.trim()) {
      setError("Please write the property title first.");
      return;
    }

    if (!form.city.trim()) {
      setError("Please write the city first.");
      return;
    }

    if (!form.price || Number(form.price) <= 0) {
      setError("Please write a valid price first.");
      return;
    }

    try {
      setAiLoading(true);
      setError("");
      setSuccess("");

      const res = await apiRequest.post("/ai/property-description", {
        title: form.title,
        price: form.price,
        address: form.address,
        city: form.city,
        bedroom: form.bedroom,
        bathroom: form.bathroom,
        size: form.size,
        type: form.type,
        property: form.property,
      });

      setDescription(res.data.description || "");
      setSuccess(
        "AI description generated successfully. You can edit it before submitting."
      );
    } catch (err) {
      console.log("AI DESCRIPTION ERROR:", err);
      setError(err.response?.data?.message || "Failed to generate description.");
    } finally {
      setAiLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      return "Title is required.";
    }

    if (!form.price || Number(form.price) <= 0) {
      return "Price must be greater than 0.";
    }

    if (!form.address.trim()) {
      return "Address is required.";
    }

    if (!form.city.trim()) {
      return "City is required.";
    }

    if (form.bedroom === "" || Number(form.bedroom) < 0) {
      return "Bedroom number is required.";
    }

    if (form.bathroom === "" || Number(form.bathroom) < 0) {
      return "Bathroom number is required.";
    }

    if (form.size && Number(form.size) < 0) {
      return "Size cannot be negative.";
    }

    if (!plainDescription) {
      return "Description is required.";
    }

    if (location?.latitude == null || location?.longitude == null) {
      return "Please select the property location using the map.";
    }

    if (imageFiles.length === 0) {
      return "Please upload at least one property image.";
    }

    return "";
  };

  const resetForm = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];

    setForm(initialForm);
    setDescription("");
    setDescriptionMode("manual");
    setImageFiles([]);
    setImagePreviews([]);
    setMainImage("");
    setLocation(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || aiLoading) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const postData = {
        title: form.title.trim(),
        price: Number(form.price),
        address: form.address.trim(),
        city: form.city.trim(),
        bedroom: Number(form.bedroom),
        bathroom: Number(form.bathroom),
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        type: form.type,
        property: form.property,
      };

      const postDetail = {
        desc: description,
        size: form.size ? Number(form.size) : null,
      };

      const data = new FormData();

      data.append("postData", JSON.stringify(postData));
      data.append("postDetail", JSON.stringify(postDetail));

      imageFiles.forEach((image) => {
        data.append("images", image);
      });

      const res = await apiRequest.post("/posts", data, {
        withCredentials: true,
      });

      setSuccess("Property added successfully.");

      const newPostId = res.data?.id || res.data?.post?.id;

      resetForm();

      if (newPostId) {
        navigate(`/properties/${newPostId}`);
      } else {
        navigate("/profile");
      }
    } catch (err) {
      console.log("ADD POST ERROR:", err);
      console.log("BACKEND ERROR:", err.response?.data);
      setError(err.response?.data?.message || "Failed to add property.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="newPostPage pageFade">
      <div className="newPostWrapper">
        <div className="newPostHeader">
          <div>
            <span>Create Listing</span>

            <h1>Add New Property</h1>

            <p>
              Add complete property details, upload high-quality images, choose
              the exact location, and create a professional description manually
              or with SmartEstate AI.
            </p>
          </div>

          <Link to="/profile" className="backBtn">
            Back to Profile
          </Link>
        </div>

        <div className="newPostLayout">
          <form className="propertyForm" onSubmit={handleSubmit}>
            <div className="formSection">
              <div className="sectionHeader">
                <span>Basic Details</span>

                <h2>Property Information</h2>

                <p>Fill in the main information users will see on the listing.</p>
              </div>

              <div className="formGrid">
                <div className="inputGroup wide">
                  <label htmlFor="title">Property Title</label>

                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Example: Modern apartment in Beirut"
                    disabled={loading || aiLoading}
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="price">Price</label>

                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="1"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="120000"
                    disabled={loading || aiLoading}
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="city">City</label>

                  <input
                    id="city"
                    name="city"
                    type="text"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Beirut"
                    disabled={loading || aiLoading}
                  />
                </div>

                <div className="inputGroup wide">
                  <label htmlFor="address">Address</label>

                  <input
                    id="address"
                    name="address"
                    type="text"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Street, building, area..."
                    disabled={loading || aiLoading}
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="type">Listing Type</label>

                  <select
                    id="type"
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    disabled={loading || aiLoading}
                  >
                    <option value="rent">Rent</option>
                    <option value="buy">Buy</option>
                  </select>
                </div>

                <div className="inputGroup">
                  <label htmlFor="property">Property Category</label>

                  <select
                    id="property"
                    name="property"
                    value={form.property}
                    onChange={handleChange}
                    disabled={loading || aiLoading}
                  >
                    <option value="apartment">Apartment</option>
                    <option value="house">House</option>
                    <option value="land">Land</option>
                  </select>
                </div>

                <div className="inputGroup">
                  <label htmlFor="bedroom">Bedrooms</label>

                  <input
                    id="bedroom"
                    name="bedroom"
                    type="number"
                    min="0"
                    value={form.bedroom}
                    onChange={handleChange}
                    placeholder="2"
                    disabled={loading || aiLoading}
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="bathroom">Bathrooms</label>

                  <input
                    id="bathroom"
                    name="bathroom"
                    type="number"
                    min="0"
                    value={form.bathroom}
                    onChange={handleChange}
                    placeholder="1"
                    disabled={loading || aiLoading}
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="size">Total Size m²</label>

                  <input
                    id="size"
                    name="size"
                    type="number"
                    min="0"
                    value={form.size}
                    onChange={handleChange}
                    placeholder="120"
                    disabled={loading || aiLoading}
                  />
                </div>
              </div>
            </div>

            <div className="formSection">
              <div className="sectionHeader">
                <span>Description</span>

                <h2>Property Overview</h2>

                <p>
                  Write the description manually or generate a professional one
                  using SmartEstate AI.
                </p>
              </div>

              <div className="descriptionModeTabs">
                <button
                  type="button"
                  className={descriptionMode === "manual" ? "active" : ""}
                  onClick={() => setDescriptionMode("manual")}
                  disabled={loading || aiLoading}
                >
                  Manual Description
                </button>

                <button
                  type="button"
                  className={descriptionMode === "ai" ? "active" : ""}
                  onClick={() => setDescriptionMode("ai")}
                  disabled={loading || aiLoading}
                >
                  SmartEstate AI
                </button>
              </div>

              {descriptionMode === "ai" && (
                <div className="aiDescriptionBox">
                  <div>
                    <span>AI Assistant</span>

                    <h3>Generate with SmartEstate AI</h3>

                    <p>
                      SmartEstate AI will use the property details above to write
                      a clean, professional real estate description.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={loading || aiLoading}
                  >
                    {aiLoading ? "Generating..." : "Generate Description"}
                  </button>
                </div>
              )}

              <div className="descriptionEditor">
                <ReactQuill
                  theme="snow"
                  onChange={setDescription}
                  value={description}
                  placeholder={
                    descriptionMode === "ai"
                      ? "Click Generate Description, then edit the result if needed..."
                      : "Write property description manually..."
                  }
                  readOnly={loading || aiLoading}
                />
              </div>
            </div>

            <div className="formSection">
              <div className="sectionHeader mapHeader">
                <div>
                  <span>Location</span>

                  <h2>Choose Property Location</h2>

                  <p>
                    Use your current location or click on the map to choose the
                    exact property location.
                  </p>
                </div>

                <button
                  type="button"
                  className="locationButton"
                  onClick={handleUseCurrentLocation}
                  disabled={locating || loading || aiLoading}
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

                  <ChangeMapCenter position={location} />

                  <LocationPicker
                    location={location}
                    onSelectLocation={handleSelectLocation}
                  />
                </MapContainer>
              </div>
            </div>

            {error && <div className="formMessage errorMessage">{error}</div>}

            {success && (
              <div className="formMessage successMessage">{success}</div>
            )}

            <div className="submitBar">
              <button type="submit" disabled={loading || aiLoading}>
                {loading ? "Adding Property..." : "Add Property"}
              </button>

              <Link to="/profile">Cancel</Link>
            </div>
          </form>

          <aside className="imagePanel">
            <div className="imageUploadBox">
              <div className="uploadHeader">
                <span>Property Media</span>

                <h2>Upload Images</h2>

                <p>
                  Upload up to {MAX_PROPERTY_IMAGES} property images. Choose the
                  best image as the main preview.
                </p>
              </div>

              <label htmlFor="images" className="uploadDropBox">
                <div className="uploadIcon">+</div>

                <strong>Choose Property Images</strong>

                <small>JPG, PNG, JPEG, WEBP • Max 8MB each</small>
              </label>

              <input
                id="images"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handleImageChange}
                className="imageInput"
                disabled={loading || aiLoading}
              />

              <div className="uploadCount">
                <span>{uploadedCount}</span>

                <p>
                  image{uploadedCount === 1 ? "" : "s"} selected /{" "}
                  {MAX_PROPERTY_IMAGES}
                </p>
              </div>

              {imagePreviews.length > 0 ? (
                <div className="imagePreviewArea">
                  <div className="mainPreview">
                    <img
                      src={mainImage}
                      alt="Main property"
                      onError={(e) => {
                        e.currentTarget.src = "/no-image.png";
                      }}
                    />

                    <div className="mainPreviewShade"></div>
                    <div className="mainPreviewBadge">Main Preview</div>
                  </div>

                  <div className="thumbnailGrid">
                    {imagePreviews.map((image, index) => (
                      <div
                        className={
                          mainImage === image ? "thumbnail active" : "thumbnail"
                        }
                        key={image}
                      >
                        <button
                          type="button"
                          className="thumbnailImageBtn"
                          onClick={() => setMainImage(image)}
                        >
                          <img
                            src={image}
                            alt={`Property ${index + 1}`}
                            onError={(e) => {
                              e.currentTarget.src = "/no-image.png";
                            }}
                          />
                        </button>

                        <span className="thumbnailNumber">{index + 1}</span>

                        <button
                          type="button"
                          className="removeImageBtn"
                          onClick={() => handleRemoveImage(index)}
                          disabled={loading || aiLoading}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="emptyUpload">
                  <strong>No images selected</strong>
                  <p>Select multiple property images to preview them here.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default NewPostPage;