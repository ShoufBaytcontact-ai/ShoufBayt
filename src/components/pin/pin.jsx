import "./pin.scss";
import { Link } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const propertyIcon = L.icon({
  iconUrl: "/pin.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -38],
});

function Pin({ item }) {
  if (!item) {
    return null;
  }

  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return (
    <Marker position={[latitude, longitude]} icon={propertyIcon}>
      <Popup>
        <div className="propertyPopup">
          <div className="popupImage">
            <img src={item.images?.[0] || "/no-image.png"} alt={item.title} />

            <span className="popupType">
              {item.type === "rent" ? "For Rent" : "For Sale"}
            </span>
          </div>

          <div className="popupInfo">
            <Link to={`/properties/${item.id}`} className="popupTitle">
              {item.title || "Property"}
            </Link>

            <p className="popupAddress">
              {item.city || "Unknown city"}
            </p>

            <div className="popupDetails">
              <span>{item.bedroom || 0} Beds</span>
              <span>{item.bathroom || 0} Baths</span>
              <span>{item.property || "Property"}</span>
            </div>

            <div className="popupBottom">
              <b>${item.price || 0}</b>

              <Link to={`/properties/${item.id}`} className="popupBtn">
                View Details
              </Link>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default Pin; 