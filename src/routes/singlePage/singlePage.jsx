import { useContext, useMemo, useState } from "react";
import { useLoaderData, useNavigate } from "react-router-dom";
import "./singlePage.scss";
import Slider from "../../components/slider/slider";
import Map from "../../components/map/map";
import StatusBadge from "../../components/statusBadge/statusBadge";
import RecommendedProperties from "../../components/recommendedProperties/recommendedProperties";
import PageState from "../../components/pageState/pageState";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 21s7-5.1 7-12a7 7 0 0 0-14 0c0 6.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function SizeIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
      <path d="M4 4l6 6" />
      <path d="M20 4l-6 6" />
      <path d="M4 20l6-6" />
      <path d="M20 20l-6-6" />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 11V6.8C4 5.8 4.8 5 5.8 5h4.4c1 0 1.8.8 1.8 1.8V11" />
      <path d="M12 11V6.8c0-1 .8-1.8 1.8-1.8h4.4c1 0 1.8.8 1.8 1.8V11" />
      <path d="M3 19v-5.2c0-1 .8-1.8 1.8-1.8h14.4c1 0 1.8.8 1.8 1.8V19" />
      <path d="M3 16h18" />
      <path d="M5 19v-2" />
      <path d="M19 19v-2" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 12h16v3.2A4.8 4.8 0 0 1 15.2 20H8.8A4.8 4.8 0 0 1 4 15.2V12Z" />
      <path d="M6 12V6.8A2.8 2.8 0 0 1 8.8 4H10" />
      <path d="M9 7h4" />
      <path d="M7 20v1" />
      <path d="M17 20v1" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 5.5h14A2.5 2.5 0 0 1 21.5 8v7A2.5 2.5 0 0 1 19 17.5h-7l-5.5 3v-3H5A2.5 2.5 0 0 1 2.5 15V8A2.5 2.5 0 0 1 5 5.5Z" />
      <path d="M7.5 10h9" />
      <path d="M7.5 13h5.5" />
    </svg>
  );
}

function SaveIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24">
      <path
        className={active ? "filledIcon" : ""}
        d="M6.5 4.5h11A1.5 1.5 0 0 1 19 6v15l-7-4-7 4V6a1.5 1.5 0 0 1 1.5-1.5Z"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M13.5 8.5l2 2" />
    </svg>
  );
}

function formatPrice(price) {
  const numberPrice = Number(price);

  if (!Number.isFinite(numberPrice)) {
    return "0";
  }

  return numberPrice.toLocaleString();
}

function formatLabel(value, fallback = "Property") {
  if (!value) {
    return fallback;
  }

  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function normalizePost(data) {
  return data?.data || data || null;
}

function SinglePage() {
  const loaderData = useLoaderData();
  const post = normalizePost(loaderData);

  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);

  const [saved, setSaved] = useState(Boolean(post?.isSaved));
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const postDetail = post?.postDetail || {};
  const owner = post?.user || {};

  const postOwnerId = String(post?.userId || post?.user?.id || "");
  const currentUserId = String(currentUser?.id || "");
  const currentUserRole = String(currentUser?.role || "").toUpperCase();

  const status = String(post?.status || "available").toLowerCase();
  const postType = String(post?.type || "buy").toLowerCase();

  const isUnavailable = status === "sold" || status === "rented";
  const isAdmin = currentUserRole === "ADMIN";
  const isOwner = Boolean(currentUserId && currentUserId === postOwnerId);
  const canEditPost = Boolean(currentUserId && (isOwner || isAdmin));
  const canSendMessage = !currentUserId || currentUserId !== postOwnerId;

  const latitude = Number(post?.latitude);
  const longitude = Number(post?.longitude);

  const hasValidLocation =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  const mapPost = hasValidLocation
    ? {
        ...post,
        latitude,
        longitude,
      }
    : null;

  const propertyDeal = postType === "rent" ? "For Rent" : "For Sale";
  const propertyType = postType === "rent" ? "Rent" : "Sale";
  const propertyCategory = formatLabel(post?.property);

  const images =
    Array.isArray(post?.images) && post.images.length > 0
      ? post.images.filter(Boolean)
      : ["/no-image.png"];

  const features = useMemo(() => {
    return [
      {
        icon: <SizeIcon />,
        value: `${postDetail.size || 0} m²`,
        label: "Total Size",
      },
      {
        icon: <BedIcon />,
        value: post?.bedroom || 0,
        label: "Bedrooms",
      },
      {
        icon: <BathIcon />,
        value: post?.bathroom || 0,
        label: "Bathrooms",
      },
    ];
  }, [postDetail.size, post?.bedroom, post?.bathroom]);

  if (!post) {
    return (
      <div className="singlePage pageFade">
        <PageState
          type="empty"
          title="Property Not Found"
          message="This property may have been deleted or is no longer available."
          buttonText="Back to Properties"
          buttonLink="/list"
        />
      </div>
    );
  }

  const handleSave = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!post?.id || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setSaved((prev) => !prev);

      await apiRequest.post(`/users/save/${post.id}`);
    } catch (error) {
      setSaved((prev) => !prev);
      console.log("SAVE PROPERTY ERROR:", error);
      alert(error.response?.data?.message || "Failed to save property.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (isUnavailable) {
      alert(
        status === "sold"
          ? "This property is already sold."
          : "This property is already rented."
      );
      return;
    }

    if (!postOwnerId) {
      alert("Cannot find the owner of this property.");
      return;
    }

    if (currentUserId === postOwnerId) {
      alert("You cannot send a message to yourself.");
      return;
    }

    if (isSendingMessage) {
      return;
    }

    try {
      setIsSendingMessage(true);

      const res = await apiRequest.post("/chats", {
        receiverId: postOwnerId,
      });

      navigate("/chat", {
        state: {
          chatId: res.data.id,
        },
      });
    } catch (error) {
      console.log("START CHAT ERROR:", error);
      alert(error.response?.data?.message || "Failed to start chat.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleEditPost = () => {
    if (!canEditPost) {
      alert("You are not allowed to edit this property.");
      return;
    }

    navigate(`/posts/edit/${post.id}`);
  };

  return (
    <div className="singlePage pageFade">
      <div className="singleContainer">
        <section className="propertyGallerySection">
          <div className="galleryCard">
            <Slider images={images} />
          </div>
        </section>

        <section className="propertyContent">
          <main className="propertyMain">
            <div className="propertyHero">
              <div className="propertyMainInfo">
                <div className="singleTitleRow">
                  <div>
                    <span className="propertyLabel">{propertyDeal}</span>
                    <h1>{post.title || "No Title"}</h1>
                  </div>

                  <div className="statusHolder">
                    <StatusBadge status={status} />
                  </div>
                </div>

                <div className="address">
                  <span className="addressIcon">
                    <LocationIcon />
                  </span>

                  <span>{post.address || "No address available"}</span>
                </div>

                <div className="singleMeta">
                  <div className="priceBox">
                    <span>Property Price</span>
                    <strong>$ {formatPrice(post.price)}</strong>
                  </div>

                  <div className="metaChip">{propertyType}</div>
                  <div className="metaChip">{propertyCategory}</div>
                </div>

                {isUnavailable && (
                  <div className="unavailableBox">
                    {status === "sold"
                      ? "This property has been sold."
                      : "This property has been rented."}
                  </div>
                )}

                {canEditPost && (
                  <button
                    className="editPropertyBtn"
                    type="button"
                    onClick={handleEditPost}
                  >
                    <EditIcon />
                    Edit Property
                  </button>
                )}
              </div>

              <div className="ownerCard">
                <div className="ownerBadge">Property Owner</div>

                <img
                  src={owner.avatar || "/no-avatar.png"}
                  alt={owner.username || "Property owner"}
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />

                <h3>{owner.username || "Unknown User"}</h3>

                <p>Contact this owner for more property information.</p>
              </div>
            </div>

            <div className="descriptionCard">
              <div className="sectionTitle">
                <span>Overview</span>
                <h2>Description</h2>
              </div>

              <div
                className="descriptionContent"
                dangerouslySetInnerHTML={{
                  __html: postDetail.desc || "No description available.",
                }}
              ></div>
            </div>

            <div className="actionBar">
              {canSendMessage && (
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || isUnavailable}
                  className={isUnavailable ? "disabledActionBtn" : ""}
                >
                  <ChatIcon />

                  {isUnavailable
                    ? status === "sold"
                      ? "Property Sold"
                      : "Property Rented"
                    : isSendingMessage
                    ? "Opening Chat..."
                    : "Send Message"}
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={saved ? "savedBtn" : ""}
              >
                <SaveIcon active={saved} />
                {saved ? "Property Saved" : "Save Property"}
              </button>
            </div>
          </main>

          <aside className="propertySide">
            <div className="sideSection">
              <p className="title">Property Details</p>

              <div className="sizes">
                {features.map((item) => (
                  <div className="size" key={item.label}>
                    <span className="featureIcon">{item.icon}</span>

                    <div>
                      <span>{item.value}</span>
                      <small>{item.label}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sideSection">
              <p className="title">Property Summary</p>

              <div className="summaryList">
                <div>
                  <span>Type</span>
                  <b>{propertyDeal}</b>
                </div>

                <div>
                  <span>Category</span>
                  <b>{propertyCategory}</b>
                </div>

                <div>
                  <span>Status</span>
                  <b className={`summaryStatus ${status}`}>{status}</b>
                </div>

                <div>
                  <span>City</span>
                  <b>{post.city || "Unknown"}</b>
                </div>
              </div>
            </div>

            <div className="sideSection mapSection">
              <p className="title">Location</p>

              <div className="mapContainer">
                {mapPost ? (
                  <Map items={[mapPost]} />
                ) : (
                  <p>No location available</p>
                )}
              </div>
            </div>
          </aside>
        </section>

        <RecommendedProperties currentPost={post} />
      </div>
    </div>
  );
}

export default SinglePage;