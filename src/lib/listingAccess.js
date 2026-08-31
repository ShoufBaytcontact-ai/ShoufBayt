function idsMatch(left, right) {
  return Boolean(left) && Boolean(right) && String(left) === String(right);
}

export function getListingUserId(post) {
  return String(post?.userId || post?.user?.id || post?.managedBy?.id || "");
}

export function getListingRequesterId(post) {
  return String(post?.requestedByUserId || "");
}

export function canEditListing(post, currentUserId, role) {
  if (String(role || "").toUpperCase() === "ADMIN") {
    return true;
  }

  const me = String(currentUserId || "");
  if (!me) {
    return false;
  }

  return (
    idsMatch(getListingUserId(post), me) ||
    idsMatch(getListingRequesterId(post), me)
  );
}

export function canManageListingStatus(post, currentUserId, role) {
  if (String(role || "").toUpperCase() === "ADMIN") {
    return true;
  }

  return idsMatch(getListingUserId(post), String(currentUserId || ""));
}

export function canDeleteListing(post, currentUserId, role) {
  return canManageListingStatus(post, currentUserId, role);
}

export function isAgentManagedForUser(post, currentUserId) {
  const me = String(currentUserId || "");
  const listingUserId = getListingUserId(post);
  const requesterId = getListingRequesterId(post);

  return Boolean(me) && idsMatch(requesterId, me) && listingUserId !== me;
}
