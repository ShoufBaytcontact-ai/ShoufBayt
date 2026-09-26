export function listingPropertyType(item) {
  const source = item?.post || item || {};
  return String(
    source.property || source.propertyType || ""
  ).toLowerCase();
}

export function isLandListing(item) {
  return listingPropertyType(item) === "land";
}

export function isBuildingListing(item) {
  if (typeof item === "string") {
    return item.toLowerCase() === "building";
  }
  return listingPropertyType(item) === "building";
}

export function locksRoomCounts(item) {
  if (typeof item === "string") {
    const type = item.toLowerCase();
    return type === "land" || type === "building";
  }
  const type = listingPropertyType(item);
  return type === "land" || type === "building";
}

export function withCategoryChange(prev, name, value) {
  if (name !== "property") {
    return { ...prev, [name]: value };
  }

  if (locksRoomCounts(value)) {
    return {
      ...prev,
      property: value,
      bedroom: "0",
      bathroom: "0",
      garage: value === "building" ? prev.garage || "1" : "",
    };
  }

  if (locksRoomCounts(prev.property)) {
    return {
      ...prev,
      property: value,
      bedroom: prev.bedroom === "0" || prev.bedroom === 0 ? "1" : prev.bedroom,
      bathroom:
        prev.bathroom === "0" || prev.bathroom === 0 ? "1" : prev.bathroom,
      garage: "",
    };
  }

  return { ...prev, property: value };
}
