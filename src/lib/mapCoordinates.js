function toCoord(value) {
  if (value == null || value === "") {
    return NaN;
  }

  if (typeof value === "object") {
    if (typeof value.$numberDouble === "string") {
      return Number(value.$numberDouble);
    }

    if (typeof value.$numberDecimal === "string") {
      return Number(value.$numberDecimal);
    }

    if (typeof value.toNumber === "function") {
      return value.toNumber();
    }
  }

  return Number(value);
}

export function getMapCoordinates(post) {
  let latitude = toCoord(
    post?.latitude ?? post?.lat ?? post?.location?.latitude ?? post?.location?.lat
  );
  let longitude = toCoord(
    post?.longitude ??
      post?.lng ??
      post?.lon ??
      post?.location?.longitude ??
      post?.location?.lng
  );

  const coords = post?.location?.coordinates || post?.coordinates;

  if (
    (!Number.isFinite(latitude) || !Number.isFinite(longitude)) &&
    Array.isArray(coords) &&
    coords.length >= 2
  ) {
    longitude = toCoord(coords[0]);
    latitude = toCoord(coords[1]);
  }

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}
