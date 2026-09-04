import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Slider from "../../components/slider/slider";
import Map from "../../components/map/map";
import PageState from "../../components/pageState/pageState";
import { listingRequestApi } from "../../lib/services";
import "../singlePage/singlePage.scss";

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
  if (!Number.isFinite(numberPrice)) return "0";
  return numberPrice.toLocaleString();
}

function formatLabel(value, fallback = "Property") {
  if (!value) return fallback;
  return (
    String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase()
  );
}

function toHtml(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return `<p>${text.replace(/\n/g, "<br />")}</p>`;
}

function unwrapRequest(payload) {
  return payload?.data || payload || null;
}

function ListingRequestSinglePage() {
  const { id } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const seeded = location.state?.listingRequest;
  const [request, setRequest] = useState(
    seeded && String(seeded.id) === String(id) ? seeded : null
  );
  const [loading, setLoading] = useState(!request);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await listingRequestApi.get(id);
        const next = unwrapRequest(res.data);
        if (active && next?.id) setRequest(next);
      } catch {
        // Keep the lead payload from navigation state if the API is unavailable.
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading && !request) {
    return (
      <main className="singlePage pageFade">
        <PageState
          type="loading"
          title={t("agentHub.leads.requestPreview")}
          message={t("agentHub.states.loading")}
        />
      </main>
    );
  }

  if (!request) {
    return (
      <main className="singlePage pageFade">
        <PageState
          type="empty"
          title={t("agentHub.leads.previewNotFound")}
          message={t("agentHub.leads.previewHint")}
          buttonText={t("agentHub.leads.backToLeads")}
          buttonLink="/agent?tab=leads"
        />
      </main>
    );
  }

  const listingKind = String(
    request.listingType || request.type || "sale"
  ).toLowerCase();
  const isRent = listingKind === "rent";
  const propertyDeal = isRent
    ? t("single.labels.forRent")
    : t("single.labels.forSale");
  const propertyKey = String(request.propertyType || request.property || "")
    .toLowerCase()
    .replace(/_/g, "");
  const propertyCategory = propertyKey
    ? t(`single.propertyTypes.${propertyKey}`, {
        defaultValue: formatLabel(request.propertyType || request.property),
      })
    : t("single.labels.property");

  const images =
    Array.isArray(request.images) && request.images.length > 0
      ? request.images.filter(Boolean).map((image) => getImageUrl(image))
      : ["/no-image.png"];

  const latitude = Number(request.latitude);
  const longitude = Number(request.longitude);
  const hasValidLocation =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapItem = hasValidLocation
    ? {
        ...request,
        latitude,
        longitude,
        bedroom: request.bedrooms,
        bathroom: request.bathrooms,
        property: propertyKey,
        href: `/listing-requests/${request.id}`,
        images,
      }
    : null;

  const isLandProperty = String(propertyKey || "").toLowerCase() === "land";

  const stats = [
    {
      icon: <SizeIcon />,
      value: `${request.area || 0}`,
      label: t("single.features.areaUnit"),
    },
    ...(!isLandProperty
      ? [
          {
            icon: <BedIcon />,
            value: request.bedrooms || 0,
            label: t("single.features.bedrooms"),
          },
          {
            icon: <BathIcon />,
            value: request.bathrooms || 0,
            label: t("single.features.bathrooms"),
          },
        ]
      : []),
  ];

  return (
    <main className="singlePage pageFade">
      <div className="singleBar">
        <Link to="/agent?tab=leads">{t("agentHub.leads.backToLeads")}</Link>
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
              <span className="tag ghost">
                {t("agentHub.leads.requestPreview")}
              </span>
              <span className="tag ghost">{propertyCategory}</span>
              <span className="tag ghost">
                {request.city || t("single.fallback.unknownCity")}
              </span>
            </div>

            <h1>{request.title || t("single.fallback.noTitle")}</h1>
            <p className="singleAddress">
              <LocationIcon />
              {request.address || t("single.fallback.noAddress")}
            </p>
            <p>{t("agentHub.leads.previewHint")}</p>
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

          <article className="singleCopy">
            <h2>{t("single.sections.propertyDescription")}</h2>
            <div
              dangerouslySetInnerHTML={{
                __html:
                  toHtml(request.description) ||
                  t("single.fallback.noDescription"),
              }}
            />
          </article>

          <article className="singleMap">
            <h2>{t("single.sections.propertyLocation")}</h2>
            <div className="singleMapBox">
              {mapItem ? (
                <Map items={[mapItem]} />
              ) : (
                <p>{t("single.fallback.noLocation")}</p>
              )}
            </div>
          </article>
        </div>

        <aside className="singleAside">
          <div className="singleOffer">
            <small>{t("single.summary.propertyPrice")}</small>
            <strong>${formatPrice(request.price)}</strong>
            <p>
              {t("agentHub.leads.from")}{" "}
              {request.requester?.username || t("single.fallback.unknownUser")}
            </p>
            <div className="singleActions">
              <Link className="primary" to="/agent?tab=leads">
                {t("agentHub.leads.propose")}
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default ListingRequestSinglePage;
