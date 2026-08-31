import { useContext, useRef, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./singlePage.scss";
import Slider from "../../components/slider/slider";
import Map from "../../components/map/map";
import StatusBadge from "../../components/statusBadge/statusBadge";
import RecommendedProperties from "../../components/recommendedProperties/recommendedProperties";
import PageState from "../../components/pageState/pageState";
import ReportModal from "../../components/reportModal/reportModal";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 4h3.2l1 4.2-2.1 1.2a12.2 12.2 0 0 0 5.5 5.5l1.2-2.1 4.2 1V17c0 .9-.7 1.6-1.6 1.6C9.6 18.6 5.4 14.4 5.4 7.6 5.4 6.7 6.1 6 7 6Z" />
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

function formatPrice(price) {
  const numberPrice = Number(price);

  if (!Number.isFinite(numberPrice)) {
    return "0";
  }

  return numberPrice.toLocaleString();
}

function formatLabel(value, fallback = "Property") {
  if (!value) return fallback;
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function normalizePost(data) {
  return data?.data || data || null;
}

function SinglePage() {
  const loaderData = useLoaderData();
  const post = normalizePost(loaderData);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);

  const [saved, setSaved] = useState(Boolean(post?.isSaved));
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const sendingMessageRef = useRef(false);

  const postDetail = post?.postDetail || {};
  const listingAgent = post?.user || {};
  const listingAgentProfile = listingAgent.agentProfile || {};

  const listingAgentId = String(post?.userId || listingAgent.id || "");
  const currentUserId = String(currentUser?.id || currentUser?._id || "");
  const currentUserRole = String(currentUser?.role || "").toUpperCase();
  const homeownerId = String(post?.requestedByUserId || "");

  const status = toUiPropertyStatus(post?.status);
  const listingKind = String(
    post?.listingType || post?.type || "buy"
  ).toLowerCase();
  const isRent = listingKind === "rent";

  const propertyDeal = isRent
    ? t("single.labels.forRent")
    : t("single.labels.forSale");

  const isUnavailable = isPropertyUnavailable(post?.status);
  const isAdmin = currentUserRole === "ADMIN";
  const isListingAgent = Boolean(
    currentUserId && currentUserId === listingAgentId
  );
  const isHomeowner = Boolean(currentUserId && homeownerId && currentUserId === homeownerId);
  const canEditPost = Boolean(
    currentUserId && (isListingAgent || isHomeowner || isAdmin)
  );
  const canSendMessage = !currentUserId || !isListingAgent;
  const listingAgentName =
    listingAgentProfile.name ||
    listingAgent.username ||
    t("single.fallback.unknownUser");
  const listingAgentAvatar = listingAgentProfile.image || listingAgent.avatar;
  const canViewAgentProfile = Boolean(
    listingAgent.id &&
      (String(listingAgent.role || "").toUpperCase() === "AGENT" ||
        listingAgentProfile.id)
  );
  const listingPhone =
    post?.listingPhone ||
    getListingPhone(listingAgentProfile) ||
    getListingPhone(listingAgent) ||
    getListingPhone(post);
  const callHref = toCallHref(listingPhone);
  const canCall = canSendMessage;
  const callLabel = canViewAgentProfile
    ? t("single.buttons.call", { defaultValue: "Call agent" })
    : t("single.buttons.callOwner", { defaultValue: "Call owner" });

  const latitude = Number(post?.latitude);
  const longitude = Number(post?.longitude);
  const hasValidLocation =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  const mapPost = hasValidLocation
    ? { ...post, latitude, longitude }
    : null;

  const propertyCategory = post?.property
    ? t(`single.propertyTypes.${post.property}`, {
        defaultValue: formatLabel(post.property),
      })
    : t("single.labels.property");

  const images =
    Array.isArray(post?.images) && post.images.length > 0
      ? post.images.filter(Boolean).map((image) => getImageUrl(image))
      : ["/no-image.png"];

  const stats = [
    {
      icon: <SizeIcon />,
      value: `${postDetail.size || 0}`,
      label: t("single.features.areaUnit"),
    },
    {
      icon: <BedIcon />,
      value: post?.bedroom || 0,
      label: t("single.features.bedrooms"),
    },
    {
      icon: <BathIcon />,
      value: post?.bathroom || 0,
      label: t("single.features.bathrooms"),
    },
  ];

  if (!post) {
    return (
      <main className="singlePage pageFade">
        <PageState
          type="empty"
          title={t("single.notFound.title")}
          message={t("single.notFound.message")}
          buttonText={t("single.notFound.button")}
          buttonLink="/list"
        />
      </main>
    );
  }

  if (
    !canViewPropertyDetails(post.status, {
      userId: currentUserId,
      role: currentUserRole,
      listingAgentId,
      homeownerId,
    })
  ) {
    return (
      <main className="singlePage pageFade">
        <PageState
          type="empty"
          title={
            status === "sold"
              ? t("single.unavailable.sold")
              : t("single.unavailable.rented")
          }
          message={t("single.notFound.message")}
          buttonText={t("single.notFound.button")}
          buttonLink="/list"
        />
      </main>
    );
  }

  const buildPropertyMessage = () => {
    const propertyLink = window.location.href;

    return `${t("single.chatMessage.greeting")}

${t("single.chatMessage.title")}: ${post?.title || t("single.labels.property")}
${t("single.chatMessage.price")}: $${formatPrice(post?.price)}
${t("single.chatMessage.deal")}: ${propertyDeal}
${t("single.chatMessage.city")}: ${post?.city || t("single.fallback.unknown")}
${t("single.chatMessage.address")}: ${
      post?.address || t("single.fallback.noAddress")
    }

${t("single.chatMessage.propertyLink")}:
${propertyLink}

${t("single.chatMessage.closing")}`;
  };

  const handleSave = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!post?.id || isSaving) return;

    try {
      setIsSaving(true);
      setSaved((prev) => !prev);
      await apiRequest.post(`/users/save/${post.id}`);
    } catch (error) {
      setSaved((prev) => !prev);
      alert(error.response?.data?.message || t("single.alerts.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (sendingMessageRef.current || isSendingMessage) return;

    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (isUnavailable) {
      alert(
        status === "sold"
          ? t("single.alerts.alreadySold")
          : t("single.alerts.alreadyRented")
      );
      return;
    }

    if (!listingAgentId) {
      alert(t("single.alerts.ownerNotFound"));
      return;
    }

    if (currentUserId === listingAgentId) {
      alert(t("single.alerts.cannotMessageYourself"));
      return;
    }

    try {
      sendingMessageRef.current = true;
      setIsSendingMessage(true);

      const chatRes = await apiRequest.post("/chats", {
        propertyId: post.id,
        receiverId: listingAgentId,
      });

      const chat = chatRes.data?.chat || chatRes.data;

      if (!chat?.id) {
        throw new Error("Chat was not created.");
      }

      await apiRequest.post("/messages", {
        chatId: chat.id,
        text: buildPropertyMessage(),
      });

      navigate("/chat", {
        state: {
          chatId: chat.id,
          openChatNow: Date.now(),
        },
      });
    } catch (error) {
      alert(error.response?.data?.message || t("single.alerts.chatFailed"));
    } finally {
      sendingMessageRef.current = false;
      setIsSendingMessage(false);
    }
  };

  const contactLabel = isUnavailable
    ? status === "sold"
      ? t("single.buttons.propertySold")
      : t("single.buttons.propertyRented")
    : isSendingMessage
    ? t("single.buttons.openingChat")
    : t("single.buttons.contactOwner");

  return (
    <main className="singlePage pageFade">
      <div className="singleBar">
        <Link to="/list">{t("single.nav.backToProperties")}</Link>
        {canEditPost && (
          <Link to={`/posts/edit/${post.id}`}>{t("single.nav.editProperty")}</Link>
        )}
      </div>

      <section className="singleGallery">
        <Slider images={images} />
      </section>

      <section className="singleBody">
        <div className="singleMain">
          <header className="singleIntro">
            <div className="singleTags">
              <span className={isRent ? "tag rent" : "tag sale"}>
                {propertyDeal}
              </span>
              <StatusBadge status={status} />
              <span className="tag ghost">{propertyCategory}</span>
              <span className="tag ghost">
                {post.city || t("single.fallback.unknownCity")}
              </span>
            </div>

            <h1>{post.title || t("single.fallback.noTitle")}</h1>

            <p className="singleAddress">
              <LocationIcon />
              {post.address || t("single.fallback.noAddress")}
            </p>
          </header>

          <div className="singleStats">
            {stats.map((item) => (
              <div key={item.label}>
                {item.icon}
                <b>{item.value}</b>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {isUnavailable && (
            <p className="singleNotice">
              {status === "sold"
                ? t("single.unavailable.sold")
                : t("single.unavailable.rented")}
            </p>
          )}

          <article className="singleCopy">
            <h2>{t("single.sections.propertyDescription")}</h2>
            <div
              dangerouslySetInnerHTML={{
                __html: postDetail.desc || t("single.fallback.noDescription"),
              }}
            />
          </article>

          <article className="singleMap">
            <h2>{t("single.sections.propertyLocation")}</h2>
            <div className="singleMapBox">
              {mapPost ? (
                <Map items={[mapPost]} />
              ) : (
                <p>{t("single.fallback.noLocation")}</p>
              )}
            </div>
          </article>
        </div>

        <aside className="singleAside">
          <div className="singleOffer">
            <small>{t("single.summary.propertyPrice")}</small>
            <strong>${formatPrice(post.price)}</strong>

            <div className="singleActions">
              {canSendMessage && (
                <button
                  type="button"
                  className="primary"
                  disabled={isSendingMessage || isUnavailable}
                  onClick={handleSendMessage}
                >
                  <ChatIcon />
                  {contactLabel}
                </button>
              )}

              {canCall &&
                (callHref ? (
                  <a className="soft" href={callHref}>
                    <PhoneIcon />
                    {callLabel}
                  </a>
                ) : canViewAgentProfile ? (
                  <Link className="soft" to={`/agents/${listingAgent.id}`}>
                    <PhoneIcon />
                    {callLabel}
                  </Link>
                ) : null)}

              <button
                type="button"
                className={saved ? "ghost isSaved" : "ghost"}
                disabled={isSaving}
                onClick={handleSave}
              >
                <SaveIcon active={saved} />
                {saved ? t("single.buttons.saved") : t("single.buttons.save")}
              </button>
            </div>
          </div>

          <div className="singleOwner">
            <img
              src={getImageUrl(listingAgentAvatar, "/no-avatar.png")}
              alt={listingAgentName}
              onError={(event) => {
                event.currentTarget.src = "/no-avatar.png";
              }}
            />
            <div>
              <small>{t("single.owner.listedBy")}</small>
              {canViewAgentProfile ? (
                <Link className="ownerNameLink" to={`/agents/${listingAgent.id}`}>
                  <b>{listingAgentName}</b>
                </Link>
              ) : (
                <b>{listingAgentName}</b>
              )}
              <span>{t("single.owner.listingAgent")}</span>
            </div>
          </div>

          {currentUser && !isListingAgent && !isHomeowner && (
            <button
              type="button"
              className="reportBtn"
              onClick={() => setReportOpen(true)}
            >
              {t("single.report")}
            </button>
          )}
        </aside>
      </section>

      <RecommendedProperties currentPost={post} />

      <ReportModal
        propertyId={post.id}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </main>
  );
}

export default SinglePage;
