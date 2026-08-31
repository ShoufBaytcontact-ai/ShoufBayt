import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StatusBadge from "../statusBadge/statusBadge";
import apiRequest from "../../lib/apiRequest";
import {
  toApiPropertyStatus,
  toUiPropertyStatus,
} from "../../lib/propertyStatus";
import "./profilePostCard.scss";

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-5.1 7-12a7 7 0 0 0-14 0c0 6.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11V6.8C4 5.8 4.8 5 5.8 5h4.4c1 0 1.8.8 1.8 1.8V11" />
      <path d="M12 11V6.8c0-1 .8-1.8 1.8-1.8h4.4c1 0 1.8.8 1.8 1.8V11" />
      <path d="M3 19v-5.2c0-1 .8-1.8 1.8-1.8h14.4c1 0 1.8.8 1.8 1.8V19" />
      <path d="M3 16h18" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h16v3.2A4.8 4.8 0 0 1 15.2 20H8.8A4.8 4.8 0 0 1 4 15.2V12Z" />
      <path d="M6 12V6.8A2.8 2.8 0 0 1 8.8 4H10" />
    </svg>
  );
}

function SizeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  );
}

function getImageUrl(image, fallback = "/noimage.jpg") {
  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  if (!image || typeof image !== "string") {
    return fallback;
  }

  if (image.startsWith("http") || image.startsWith("data:")) {
    return image;
  }

  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

function ProfilePostCard({
  item,
  canEdit,
  canDelete,
  canManageStatus,
  onDelete,
  onStatusUpdated,
  currentUserId,
  isAgentManaged,
}) {
  const { t } = useTranslation();

  const post = item?.post || item || {};
  const postId = post.id || item?.postId;
  const listingType = String(post.listingType || post.type || "").toUpperCase();
  const isRent = listingType === "RENT" || post.type === "rent";

  const [currentStatus, setCurrentStatus] = useState(
    toUiPropertyStatus(post.status)
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    setCurrentStatus(toUiPropertyStatus(post.status));
  }, [post.status]);

  if (!item || !postId) {
    return null;
  }

  const image = getImageUrl(post.images?.[0], "/noimage.jpg");
  const title = post.title || t("profilePostCard.fallback.untitled");
  const address = post.address || t("profilePostCard.fallback.noAddress");
  const city = post.city || "";
  const price = Number(post.price || 0).toLocaleString();
  const bedroom = post.bedroom ?? post.bedrooms ?? 0;
  const bathroom = post.bathroom ?? post.bathrooms ?? 0;
  const size = post.size || post.area || post.postDetail?.size || 0;
  const managedBy = post.managedBy || null;
  const managerName = managedBy?.name || "";
  const showManager =
    Boolean(managerName) &&
    String(managedBy?.id || "") !== String(currentUserId || "");

  const statusOptions = isRent
    ? [
        { value: "available", label: t("profilePostCard.status.available") },
        { value: "rented", label: t("profilePostCard.status.rented") },
      ]
    : [
        { value: "available", label: t("profilePostCard.status.available") },
        { value: "sold", label: t("profilePostCard.status.sold") },
      ];

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === currentStatus || isUpdatingStatus) {
      return;
    }

    const oldStatus = currentStatus;

    try {
      setIsUpdatingStatus(true);
      setCurrentStatus(newStatus);

      const res = await apiRequest.patch(`/posts/${postId}/status`, {
        status: toApiPropertyStatus(newStatus),
      });

      const nextUi = toUiPropertyStatus(res.data?.status || newStatus);
      setCurrentStatus(nextUi);
      onStatusUpdated?.(
        postId,
        res.data?.status || toApiPropertyStatus(newStatus)
      );
    } catch (err) {
      console.log(err);
      setCurrentStatus(oldStatus);
      alert(
        err.response?.data?.message || t("profilePostCard.alerts.updateFailed")
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isPending =
    currentStatus === "pending" ||
    String(post.status || "").toUpperCase() === "PENDING";
  const isRejected =
    currentStatus === "rejected" ||
    String(post.status || "").toUpperCase() === "REJECTED";
  const canChangeAvailability =
    Boolean(canManageStatus) && !isPending && !isRejected;

  return (
    <article className="profilePostCard">
      <Link to={`/properties/${postId}`} className="profilePostImage">
        <img
          src={image}
          alt={title}
          onError={(event) => {
            event.currentTarget.src = "/noimage.jpg";
          }}
        />
        <span>
          {isRent ? t("card.labels.forRent") : t("card.labels.forSale")}
        </span>
      </Link>

      <div className="profilePostInfo">
        <div className="profilePostTop">
          <div>
            <div className="profilePostTitleRow">
              <h2>
                <Link to={`/properties/${postId}`}>{title}</Link>
              </h2>
              <StatusBadge status={currentStatus} />
            </div>
            <p className="profilePostAddress">
              <LocationIcon />
              <span>{city ? `${city} · ${address}` : address}</span>
            </p>
            {showManager && (
              <p className="profilePostManager">
                {managedBy.agencyName
                  ? t("profilePostCard.managedByAgency", {
                      name: managerName,
                      agency: managedBy.agencyName,
                    })
                  : t("profilePostCard.managedBy", { name: managerName })}
                {(managedBy.profileId || managedBy.id) && (
                  <Link to={`/agents/${managedBy.profileId || managedBy.id}`}>
                    {t("profilePostCard.viewAgent")}
                  </Link>
                )}
              </p>
            )}
          </div>
          <p className="profilePostPrice">$ {price}</p>
        </div>

        <div className="profilePostFeatures">
          <div>
            <BedIcon />
            <span>
              {bedroom} {t("profilePostCard.features.bedroom")}
            </span>
          </div>
          <div>
            <BathIcon />
            <span>
              {bathroom} {t("profilePostCard.features.bathroom")}
            </span>
          </div>
          {Number(size) > 0 && (
            <div>
              <SizeIcon />
              <span>
                {size} {t("card.features.area")}
              </span>
            </div>
          )}
        </div>

        {canChangeAvailability && (
          <div className="statusControlBox">
            <label>{t("profilePostCard.labels.changeStatus")}</label>
            <div className="statusButtonRow">
              {statusOptions.map((status) => (
                <button
                  type="button"
                  key={status.value}
                  className={`statusActionBtn ${status.value}${
                    currentStatus === status.value ? " is-active" : ""
                  }`}
                  onClick={() => handleStatusChange(status.value)}
                  disabled={isUpdatingStatus || currentStatus === status.value}
                >
                  {status.label}
                </button>
              ))}
            </div>
            {isUpdatingStatus && (
              <em>{t("profilePostCard.labels.updating")}</em>
            )}
          </div>
        )}

        {canEdit && isPending && (
          <p className="profilePostManager">
            {t("profilePostCard.labels.pendingNote")}
          </p>
        )}

        {isAgentManaged && !canChangeAvailability && (
          <p className="profilePostManager">
            {t("profilePostCard.labels.agentManagedNote")}
          </p>
        )}

        <div className="profilePostActions">
          <Link to={`/properties/${postId}`} className="viewBtn">
            {t("profilePostCard.buttons.viewDetails")}
          </Link>

          {canEdit && (
            <Link to={`/posts/edit/${postId}`} className="editPostBtn">
              {t("profilePostCard.buttons.editProperty")}
            </Link>
          )}

          {canDelete && (
            <button type="button" onClick={onDelete} className="deletePostBtn">
              {t("profilePostCard.buttons.delete")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default ProfilePostCard;
