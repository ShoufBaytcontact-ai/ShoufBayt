/**
 * Map API PropertyStatus values to UI badge keys used across cards/pages.
 */
export function toUiPropertyStatus(status) {
  const value = String(status || "").trim().toUpperCase();

  if (value === "SOLD") return "sold";
  if (value === "RENTED") return "rented";
  if (value === "PENDING") return "pending";
  if (value === "REJECTED") return "rejected";
  if (
    value === "PUBLISHED" ||
    value === "AVAILABLE" ||
    value === ""
  ) {
    return "available";
  }

  return String(status || "available").trim().toLowerCase();
}

/**
 * Map UI select values back to API PropertyStatus.
 */
export function toApiPropertyStatus(status) {
  const value = String(status || "").trim().toLowerCase();

  if (value === "sold") return "SOLD";
  if (value === "rented") return "RENTED";
  if (value === "available" || value === "published") return "PUBLISHED";
  if (value === "archived") return "ARCHIVED";

  return String(status || "").trim().toUpperCase();
}

export function isPropertyUnavailable(status) {
  const ui = toUiPropertyStatus(status);
  return ui === "sold" || ui === "rented";
}

export function canViewPropertyDetails(status, viewer = {}) {
  if (!isPropertyUnavailable(status)) {
    return true;
  }

  const viewerId = String(viewer.userId || "");
  const role = String(viewer.role || "").toUpperCase();

  if (role === "ADMIN") {
    return true;
  }

  if (viewerId && viewerId === String(viewer.listingAgentId || "")) {
    return true;
  }

  if (viewerId && viewerId === String(viewer.homeownerId || "")) {
    return true;
  }

  return false;
}
