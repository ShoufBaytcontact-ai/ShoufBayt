import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./card.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import StatusBadge from "../statusBadge/statusBadge";

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 21s7-5.1 7-12a7 7 0 0 0-14 0c0 6.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 5.5h14A2.5 2.5 0 0 1 21.5 8v7A2.5 2.5 0 0 1 19 17.5h-7l-5.5 3v-3H5A2.5 2.5 0 0 1 2.5 15V8A2.5 2.5 0 0 1 5 5.5Z" />
      <path d="M7.5 10h9" />
      <path d="M7.5 13h5.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function getPostData(item) {
  const post = item?.post || item || null;
  const postId = post?.id || item?.postId || "";

  return {
    post,
    postId,
  };
}

function formatPrice(price) {
  const numberPrice = Number(price);

  if (!Number.isFinite(numberPrice)) {
    return price || "0";
  }

  return numberPrice.toLocaleString();
}

function formatLabel(value, fallback = "Property") {
  if (!value) {
    return fallback;
  }

  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function Card({ item }) {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);

  const { post, postId } = getPostData(item);

  const [saved, setSaved] = useState(Boolean(item?.isSaved || post?.isSaved));
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  if (!post || !postId) {
    return null;
  }

  const status = String(post.status || "available").toLowerCase();
  const isUnavailable = status === "sold" || status === "rented";

  const ownerId = String(post.userId || post.user?.id || "");
  const currentUserId = String(currentUser?.id || "");
  const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId);

  const title = post.title || "Untitled Property";
  const city = post.city || "Unknown City";
  const address = post.address || "No address available";
  const bedroom = post.bedroom ?? 0;
  const bathroom = post.bathroom ?? 0;
  const propertySize = post.postDetail?.size || post.size || 0;

  const images = Array.isArray(post.images) ? post.images : [];
  const mainImage = images[0] || "/no-image.png";

  const dealLabel =
    post.type === "rent"
      ? "For Rent"
      : post.type === "buy"
      ? "For Sale"
      : "Property";

  const propertyLabel = formatLabel(post.property);
  const formattedPrice = formatPrice(post.price);

  const unavailableText = status === "sold" ? "Sold" : "Rented";
  const unavailableMessage =
    status === "sold"
      ? "This property has already been sold."
      : "This property has already been rented.";

  const handleSave = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setSaved((prev) => !prev);

      await apiRequest.post(`/users/save/${postId}`);
    } catch (err) {
      setSaved((prev) => !prev);
      console.log("SAVE PROPERTY ERROR:", err);
      alert(err.response?.data?.message || "Failed to save property.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChat = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (isUnavailable) {
      alert(unavailableMessage);
      return;
    }

    if (!ownerId) {
      alert("Cannot find the owner of this property.");
      return;
    }

    if (isOwner) {
      alert("You cannot send a message to yourself.");
      return;
    }

    if (isOpeningChat) {
      return;
    }

    try {
      setIsOpeningChat(true);

      const res = await apiRequest.post("/chats", {
        receiverId: ownerId,
      });

      navigate("/chat", {
        state: {
          chatId: res.data.id,
        },
      });
    } catch (err) {
      console.log("OPEN CHAT ERROR:", err);
      alert(err.response?.data?.message || "Failed to open chat.");
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <article
      className={isUnavailable ? "propertyCard unavailableCard" : "propertyCard"}
    >
      <Link to={`/properties/${postId}`} className="propertyMedia">
        <img
          src={mainImage}
          alt={title}
          onError={(e) => {
            e.currentTarget.src = "/no-image.png";
          }}
        />

        <div className="mediaShade"></div>

        <div className="mediaTop">
          <span>{dealLabel}</span>
          <span>{propertyLabel}</span>
        </div>

        <div className="mediaPrice">
          <small>Price</small>
          <strong>
            <span>$</span>
            {formattedPrice}
          </strong>
        </div>

        {isUnavailable && (
          <div className="unavailableOverlay">{unavailableText}</div>
        )}
      </Link>

      <div className="propertyContent">
        <div className="propertyTop">
          <div>
            <span className="cityBadge">{city}</span>

            <h2>
              <Link to={`/properties/${postId}`}>{title}</Link>
            </h2>
          </div>

          <StatusBadge status={status} />
        </div>

        <div className="propertyAddress">
          <span>
            <LocationIcon />
          </span>

          <p>{address}</p>
        </div>

        {isUnavailable && (
          <div className="unavailableNotice">{unavailableMessage}</div>
        )}

        <div className="propertyFeatures">
          <div>
            <span>
              <BedIcon />
            </span>

            <strong>{bedroom}</strong>
            <small>Bedrooms</small>
          </div>

          <div>
            <span>
              <BathIcon />
            </span>

            <strong>{bathroom}</strong>
            <small>Bathrooms</small>
          </div>

          <div>
            <span>
              <SizeIcon />
            </span>

            <strong>{propertySize}</strong>
            <small>m²</small>
          </div>
        </div>

        <div className="propertyActions">
          <Link to={`/properties/${postId}`} className="detailsBtn">
            View Details
            <ArrowIcon />
          </Link>

          <div className="quickActions">
            <button
              type="button"
              className={saved ? "iconBtn active" : "iconBtn"}
              onClick={handleSave}
              disabled={isSaving}
              title={saved ? "Remove from saved" : "Save property"}
            >
              <SaveIcon active={saved} />
            </button>

            {!isOwner && (
              <button
                type="button"
                className={isUnavailable ? "iconBtn disabled" : "iconBtn"}
                onClick={handleChat}
                disabled={isOpeningChat || isUnavailable}
                title={isUnavailable ? unavailableMessage : "Send message"}
              >
                <ChatIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default Card;