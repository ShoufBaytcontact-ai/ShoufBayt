export const needsPhone = (user) => {
  if (!user) return false;
  if (String(user.role || "").toUpperCase() === "ADMIN") return false;
  return !user.phone;
};

export const needsPhoneVerification = needsPhone;

export const afterAuthPath = (user, fallback = "/") => {
  return needsPhone(user) ? "/verify-phone" : fallback;
};
