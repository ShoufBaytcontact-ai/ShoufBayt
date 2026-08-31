function collectPhone(value, depth = 0) {
  if (!value || depth > 3) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = collectPhone(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof value !== "object") {
    return "";
  }

  const direct =
    value.listingPhone ||
    value.phone ||
    value.phoneNumber ||
    value.mobile ||
    value.tel;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const found = collectPhone(nested, depth + 1);
      if (found) return found;
    }
  }

  return "";
}

export function getListingPhone(source) {
  return collectPhone(source);
}

export function toCallHref(phone) {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}
