import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./card.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import StatusBadge from "../statusBadge/statusBadge";
import { getListingPhone, toCallHref } from "../../lib/listingContact";
import {
  canViewPropertyDetails,
  isPropertyUnavailable,
  toUiPropertyStatus,
} from "../../lib/propertyStatus";

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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 4h3.2l1 4.2-2.1 1.2a12.2 12.2 0 0 0 5.5 5.5l1.2-2.1 4.2 1V17c0 .9-.7 1.6-1.6 1.6C9.6 18.6 5.4 14.4 5.4 7.6 5.4 6.7 6.1 6 7 6Z" />
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

function getImageUrl(image, fallback = "/no-image.png") {
  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  if (!image || typeof image !== "string") {
    return fallback;
  }

  if (
    image.startsWith("http") ||
    image.startsWith("data:") ||
    image.startsWith("/no-")
  ) {
    return image;
  }

  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
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

function Card({ item }) {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();

  const { post, postId } = getPostData(item);

  const [saved, setSaved] = useState(Boolean(item?.isSaved || post?.isSaved));
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  if (!post || !postId) {
    return null;
  }

  const status = toUiPropertyStatus(post.status);
  const isUnavailable = isPropertyUnavailable(post.status);

  const ownerId = String(post.userId || post.user?.id || "");
  const currentUserId = String(currentUser?.id || "");
  const isOwner = Boolean(currentUserId && ownerId && currentUserId === ownerId);
  const listingPhone =
    post.listingPhone || getListingPhone(post.user) || getListingPhone(post);
  const callHref = toCallHref(listingPhone);
  const canCall = !isOwner && !isUnavailable;
  const canOpenDetails = canViewPropertyDetails(post.status, {
    userId: currentUserId,
    role: currentUser?.role,
    listingAgentId: ownerId,
    homeownerId: post.requestedByUserId,
  });

  const title = post.title || t("card.fallback.untitled");
  const city = post.city || t("card.fallback.unknownCity");
  const address = post.address || t("card.fallback.noAddress");
  const bedroom = post.bedroom ?? 0;
  const bathroom = post.bathroom ?? 0;
  const propertySize = post.postDetail?.size || post.size || 0;

  const images = Array.isArray(post.images) ? post.images : [];
  const mainImage = getImageUrl(images[0], "/no-image.png");

  const listingKind = String(post.listingType || post.type || "").toLowerCase();
  const dealLabel =
    listingKind === "rent"
      ? t("card.labels.forRent")
      : listingKind === "buy" || listingKind === "sale"
      ? t("card.labels.forSale")
      : t("card.labels.property");

  const propertyLabel = post.property
    ? t(`card.propertyTypes.${post.property}`, {
        defaultValue: String(post.property).charAt(0).toUpperCase() + String(post.property).slice(1),
      })
    : t("card.labels.property");

  const formattedPrice = formatPrice(post.price);

  const unavailableText =
    status === "sold" ? t("card.status.sold") : t("card.status.rented");

  const unavailableMessage =
    status === "sold"
      ? t("card.messages.sold")
      : t("card.messages.rented");

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
      alert(err.response?.data?.message || t("card.alerts.saveFailed"));
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
      alert(t("card.alerts.ownerNotFound"));
      return;
    }

    if (isOwner) {
      alert(t("card.alerts.cannotMessageYourself"));
      return;
    }

    if (isOpeningChat) {
      return;
    }

    try {
      setIsOpeningChat(true);

      const res = await apiRequest.post("/chats", {
        propertyId: postId,
        receiverId: ownerId,
      });

      navigate("/chat", {
        state: {
          chatId: res.data.id,
        },
      });
    } catch (err) {
      console.log("OPEN CHAT ERROR:", err);
      alert(err.response?.data?.message || t("card.alerts.chatFailed"));
    } finally {
      setIsOpeningChat(false);
    }
  };

  const media = (
    <>
      <img
        src={mainImage}
        alt={title}
        onError={(e) => {
          e.currentTarget.src = "/no-image.png";
        }}
      />

      <div className="mediaShade"></div>

      <div className="mediaTop">
        <span className="dealBadge">{dealLabel}</span>
        <span className="typeBadge">{propertyLabel}</span>
      </div>

      <div className="mediaPrice">
        <small>{t("card.labels.price")}</small>
        <strong>
          <span>$</span>
          {formattedPrice}
        </strong>
      </div>

      {isUnavailable && (
        <div className="unavailableOverlay">{unavailableText}</div>
      )}
    </>
  );

  return (
    <article
      className={isUnavailable ? "propertyCard unavailableCard" : "propertyCard"}
    >
      {canOpenDetails ? (
        <Link to={`/properties/${postId}`} className="propertyMedia">
          {media}
        </Link>
      ) : (
        <div className="propertyMedia">{media}</div>
      )}

      <div className="propertyContent">
        <div className="propertyTop">
          <span className="cityBadge">{city}</span>
          <StatusBadge status={status} />
        </div>

        <h2>
          {canOpenDetails ? (
            <Link to={`/properties/${postId}`}>{title}</Link>
          ) : (
            <span>{title}</span>
          )}
        </h2>

        <div className="propertyAddress">
          <LocationIcon />
          <p>{address}</p>
        </div>

        {isUnavailable && (
          <div className="unavailableNotice">{unavailableMessage}</div>
        )}

        <div className="propertyFeatures">
          <div>
            <BedIcon />
            <span>
              {bedroom} {t("card.features.bedrooms")}
            </span>
          </div>

          <div>
            <BathIcon />
            <span>
              {bathroom} {t("card.features.bathrooms")}
            </span>
          </div>

          <div>
            <SizeIcon />
            <span>
              {propertySize} {t("card.features.area")}
            </span>
          </div>
        </div>

        <div className="propertyActions">
          {canOpenDetails ? (
            <Link to={`/properties/${postId}`} className="detailsBtn">
              {t("card.buttons.viewDetails")}
              <ArrowIcon />
            </Link>
          ) : (
            <button
              type="button"
              className="detailsBtn disabled"
              disabled
              title={unavailableMessage}
            >
              {t("card.buttons.viewDetails")}
            </button>
          )}

          <button
            type="button"
            className={saved ? "iconBtn saveBtn active" : "iconBtn saveBtn"}
            onClick={handleSave}
            disabled={isSaving}
            title={
              saved ? t("card.titles.removeSaved") : t("card.titles.saveProperty")
            }
          >
            <SaveIcon active={saved} />
          </button>

          {!isOwner && (
            <button
              type="button"
              className={isUnavailable ? "iconBtn disabled" : "iconBtn"}
              onClick={handleChat}
              disabled={isOpeningChat || isUnavailable}
              title={
                isUnavailable
                  ? unavailableMessage
                  : t("card.titles.sendMessage")
              }
            >
              <ChatIcon />
            </button>
          )}

          {canCall &&
            (callHref ? (
              <a
                className="iconBtn callBtn"
                href={callHref}
                title={t("card.titles.callAgent", { defaultValue: "Call agent" })}
              >
                <PhoneIcon />
              </a>
            ) : ownerId ? (
              <Link
                className="iconBtn callBtn"
                to={`/agents/${ownerId}`}
                title={t("card.titles.callAgent", { defaultValue: "Call agent" })}
              >
                <PhoneIcon />
              </Link>
            ) : null)}
        </div>
      </div>
    </article>
  );
}

export default Card;