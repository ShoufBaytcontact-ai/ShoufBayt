import "./statusBadge.scss";

function StatusBadge({ status }) {
  const value = status || "available";

  const statusText = {
    available: "Available",
    sold: "Sold",
    rented: "Rented",
  };

  return (
    <span className={`statusBadge ${value}`}>
      {statusText[value] || "Available"}
    </span>
  );
}

export default StatusBadge;