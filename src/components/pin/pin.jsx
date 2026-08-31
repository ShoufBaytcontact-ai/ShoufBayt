import "./pin.scss";
import { Link } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { isPropertyUnavailable } from "../../lib/propertyStatus";
import { getMapCoordinates } from "../../lib/mapCoordinates";

function makePropertyIcon(kind) {
  return L.divIcon({
    className: "propertyMarker",
    html: `
      <svg class="mapPinSvg mapPin${kind === "rent" ? "Rent" : "Buy"}" viewBox="0 0 32 42" aria-hidden="true">
        <path d="M16 1.5C8.5 1.5 2.5 7.6 2.5 15.3c0 8.9 9.4 18.6 13.5 24.4a1.2 1.2 0 0 0 1.9 0c4.1-5.8 13.6-15.5 13.6-24.4C29.5 7.6 23.5 1.5 16 1.5Z"/>
        <circle cx="16" cy="15.2" r="5.2"/>
      </svg>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
}

const buyIcon = makePropertyIcon("buy");
const rentIcon = makePropertyIcon("rent");

function formatPrice(price) {
  const numberPrice = Number(price);

  if (!Number.isFinite(numberPrice)) {
    return String(price || "0");
  }

  return numberPrice.toLocaleString();
}

function getDealKind(item) {
  const type = String(item.listingType || item.type || "").toLowerCase();

  if (type === "rent") return "rent";
  if (type === "buy" || type === "sale") return "buy";
  return "buy";
}

function getDealLabel(item) {
  const kind = getDealKind(item);

  if (kind === "rent") {
    return "For Rent";
  }

  if (kind === "buy") {
    return "For Sale";
  }

  return "Property";
}

function Pin({ item }) {
  if (!item) {
    return null;
  }

  const coords = getMapCoordinates(item);

  if (!coords) {
    return null;
  }

  const { latitude, longitude } = coords;

  const kind = getDealKind(item);
  const locked = isPropertyUnavailable(item.status);
  const href = item.href || `/properties/${item.id}`;

  return (
    <Marker
      position={[latitude, longitude]}
      icon={kind === "rent" ? rentIcon : buyIcon}
    >
      <Popup>
        <div className="propertyPopup">
          <div className="popupImage">
            <img src={item.images?.[0] || "/no-image.png"} alt={item.title} />
            <span className={`popupType ${kind}`}>{getDealLabel(item)}</span>
          </div>

          <div className="popupInfo">
            {locked ? (
              <span className="popupTitle">{item.title || "Property"}</span>
            ) : (
              <Link to={href} className="popupTitle">
                {item.title || "Property"}
              </Link>
            )}

            <p className="popupAddress">{item.city || "Unknown city"}</p>

            <div className="popupDetails">
              <span>{item.bedroom || 0} Beds</span>
              <span>{item.bathroom || 0} Baths</span>
              <span>{item.property || "Property"}</span>
            </div>

            <div className="popupBottom">
              <b>${formatPrice(item.price)}</b>
              {locked ? (
                <span className="popupBtn disabled">Unavailable</span>
              ) : (
                <Link to={href} className="popupBtn">
                  View Details
                </Link>
              )}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default Pin;
