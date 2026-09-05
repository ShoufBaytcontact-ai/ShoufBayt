export function listingPropertyType(item) {
  const source = item?.post || item || {};
  return String(
    source.property || source.propertyType || ""
  ).toLowerCase();
}

export function isLandListing(item) {
  return listingPropertyType(item) === "land";
}
