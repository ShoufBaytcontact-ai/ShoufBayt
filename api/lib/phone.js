import {
  isValidPhone as isValidCountryPhone,
  normalizePhone,
  toPhoneKey,
} from "../../src/lib/phoneCountries.js";

export { toPhoneKey, normalizePhone };

export const cleanPhone = (value) => String(value || "").trim();

export const isValidPhone = (value, options = {}) =>
  isValidCountryPhone(value, options);

export const phoneUpdateFields = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return {
      phone: null,
      phoneVerified: false,
      pendingPhone: null,
    };
  }

  return {
    phone: normalized,
    phoneVerified: true,
    pendingPhone: null,
  };
};
