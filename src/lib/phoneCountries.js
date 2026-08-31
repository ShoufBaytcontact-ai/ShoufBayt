/** iso, calling code without +, national digit count (or [min, max] without the key). */
const RAW = [
  ["AF", "93", 9],
  ["AL", "355", [8, 9]],
  ["DZ", "213", 9],
  ["AS", "1", 10],
  ["AD", "376", 6],
  ["AO", "244", 9],
  ["AI", "1", 10],
  ["AG", "1", 10],
  ["AR", "54", [10, 11]],
  ["AM", "374", 8],
  ["AW", "297", 7],
  ["AU", "61", 9],
  ["AT", "43", [10, 11]],
  ["AZ", "994", 9],
  ["BS", "1", 10],
  ["BH", "973", 8],
  ["BD", "880", 10],
  ["BB", "1", 10],
  ["BY", "375", 9],
  ["BE", "32", 9],
  ["BZ", "501", 7],
  ["BJ", "229", 8],
  ["BM", "1", 10],
  ["BT", "975", 8],
  ["BO", "591", 8],
  ["BA", "387", 8],
  ["BW", "267", 8],
  ["BR", "55", [10, 11]],
  ["IO", "246", 7],
  ["VG", "1", 10],
  ["BN", "673", 7],
  ["BG", "359", 9],
  ["BF", "226", 8],
  ["BI", "257", 8],
  ["KH", "855", 8],
  ["CM", "237", 9],
  ["CA", "1", 10],
  ["CV", "238", 7],
  ["KY", "1", 10],
  ["CF", "236", 8],
  ["TD", "235", 8],
  ["CL", "56", 9],
  ["CN", "86", 11],
  ["CO", "57", 10],
  ["KM", "269", 7],
  ["CG", "242", 9],
  ["CD", "243", 9],
  ["CK", "682", 5],
  ["CR", "506", 8],
  ["CI", "225", 10],
  ["HR", "385", 9],
  ["CU", "53", 8],
  ["CW", "599", 7],
  ["CY", "357", 8],
  ["CZ", "420", 9],
  ["DK", "45", 8],
  ["DJ", "253", 8],
  ["DM", "1", 10],
  ["DO", "1", 10],
  ["EC", "593", 9],
  ["EG", "20", 10],
  ["SV", "503", 8],
  ["GQ", "240", 9],
  ["ER", "291", 7],
  ["EE", "372", [7, 8]],
  ["SZ", "268", 8],
  ["ET", "251", 9],
  ["FK", "500", 5],
  ["FO", "298", 6],
  ["FJ", "679", 7],
  ["FI", "358", [9, 10]],
  ["FR", "33", 9],
  ["GF", "594", 9],
  ["PF", "689", 8],
  ["GA", "241", 7],
  ["GM", "220", 7],
  ["GE", "995", 9],
  ["DE", "49", [10, 11]],
  ["GH", "233", 9],
  ["GI", "350", 8],
  ["GR", "30", 10],
  ["GL", "299", 6],
  ["GD", "1", 10],
  ["GP", "590", 9],
  ["GU", "1", 10],
  ["GT", "502", 8],
  ["GG", "44", 10],
  ["GN", "224", 9],
  ["GW", "245", 7],
  ["GY", "592", 7],
  ["HT", "509", 8],
  ["HN", "504", 8],
  ["HK", "852", 8],
  ["HU", "36", 9],
  ["IS", "354", 7],
  ["IN", "91", 10],
  ["ID", "62", [10, 12]],
  ["IR", "98", 10],
  ["IQ", "964", 10],
  ["IE", "353", 9],
  ["IM", "44", 10],
  ["IL", "972", 9],
  ["IT", "39", [9, 10]],
  ["JM", "1", 10],
  ["JP", "81", 10],
  ["JE", "44", 10],
  ["JO", "962", 9],
  ["KZ", "7", 10],
  ["KE", "254", 9],
  ["KI", "686", 8],
  ["XK", "383", 8],
  ["KW", "965", 8],
  ["KG", "996", 9],
  ["LA", "856", [8, 10]],
  ["LV", "371", 8],
  ["LB", "961", 8],
  ["LS", "266", 8],
  ["LR", "231", [7, 8]],
  ["LY", "218", 9],
  ["LI", "423", 7],
  ["LT", "370", 8],
  ["LU", "352", 9],
  ["MO", "853", 8],
  ["MG", "261", 9],
  ["MW", "265", 9],
  ["MY", "60", [9, 10]],
  ["MV", "960", 7],
  ["ML", "223", 8],
  ["MT", "356", 8],
  ["MH", "692", 7],
  ["MQ", "596", 9],
  ["MR", "222", 8],
  ["MU", "230", 8],
  ["YT", "262", 9],
  ["MX", "52", 10],
  ["FM", "691", 7],
  ["MD", "373", 8],
  ["MC", "377", 8],
  ["MN", "976", 8],
  ["ME", "382", 8],
  ["MS", "1", 10],
  ["MA", "212", 9],
  ["MZ", "258", 9],
  ["MM", "95", [8, 10]],
  ["NA", "264", 9],
  ["NR", "674", 7],
  ["NP", "977", 10],
  ["NL", "31", 9],
  ["NC", "687", 6],
  ["NZ", "64", [8, 10]],
  ["NI", "505", 8],
  ["NE", "227", 8],
  ["NG", "234", 10],
  ["NU", "683", 4],
  ["NF", "672", 6],
  ["KP", "850", [6, 10]],
  ["MK", "389", 8],
  ["MP", "1", 10],
  ["NO", "47", 8],
  ["OM", "968", 8],
  ["PK", "92", 10],
  ["PW", "680", 7],
  ["PS", "970", 9],
  ["PA", "507", 8],
  ["PG", "675", [7, 8]],
  ["PY", "595", 9],
  ["PE", "51", 9],
  ["PH", "63", 10],
  ["PL", "48", 9],
  ["PT", "351", 9],
  ["PR", "1", 10],
  ["QA", "974", 8],
  ["RE", "262", 9],
  ["RO", "40", 9],
  ["RU", "7", 10],
  ["RW", "250", 9],
  ["SA", "966", 9],
  ["SN", "221", 9],
  ["RS", "381", [8, 9]],
  ["SC", "248", 7],
  ["SL", "232", 8],
  ["SG", "65", 8],
  ["SK", "421", 9],
  ["SI", "386", 8],
  ["SO", "252", [8, 9]],
  ["ZA", "27", 9],
  ["KR", "82", [9, 10]],
  ["ES", "34", 9],
  ["LK", "94", 9],
  ["SD", "249", 9],
  ["SE", "46", 9],
  ["CH", "41", 9],
  ["SY", "963", 9],
  ["TW", "886", 9],
  ["TJ", "992", 9],
  ["TZ", "255", 9],
  ["TH", "66", 9],
  ["TL", "670", 8],
  ["TG", "228", 8],
  ["TO", "676", 5],
  ["TT", "1", 10],
  ["TN", "216", 8],
  ["TR", "90", 10],
  ["TM", "993", 8],
  ["TC", "1", 10],
  ["TV", "688", 5],
  ["UG", "256", 9],
  ["UA", "380", 9],
  ["AE", "971", 9],
  ["GB", "44", 10],
  ["US", "1", 10],
  ["UY", "598", 8],
  ["UZ", "998", 9],
  ["VU", "678", [5, 7]],
  ["VA", "39", [9, 10]],
  ["VE", "58", 10],
  ["VN", "84", 9],
  ["VI", "1", 10],
  ["YE", "967", 9],
  ["ZM", "260", 9],
  ["ZW", "263", 9],
];

export const DEFAULT_PHONE_COUNTRY = "LB";

export const PHONE_COUNTRIES = RAW.map(([iso, dial, digits]) => ({
  iso,
  dial: String(dial),
  code: `+${dial}`,
  digits,
}));

const BY_ISO = new Map(PHONE_COUNTRIES.map((country) => [country.iso, country]));

const BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dial.length - a.dial.length || a.iso.localeCompare(b.iso)
);

export const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export const getPhoneCountry = (iso) =>
  BY_ISO.get(String(iso || "").toUpperCase()) || BY_ISO.get(DEFAULT_PHONE_COUNTRY);

export const nationalLength = (country) => {
  const digits = country?.digits;
  if (Array.isArray(digits)) {
    return { min: digits[0], max: digits[1] };
  }
  const count = Number(digits) || 8;
  return { min: count, max: count };
};

const nationalFits = (country, national) => {
  const { min, max } = nationalLength(country);
  const length = String(national || "").length;
  return length >= min && length <= max;
};

const stripTrunkZero = (country, national) => {
  if (!national.startsWith("0")) return national;
  const stripped = national.slice(1);
  if (nationalFits(country, stripped) && !nationalFits(country, national)) {
    return stripped;
  }
  return national;
};

export const parsePhone = (value, fallbackIso = DEFAULT_PHONE_COUNTRY) => {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);

  const fallback = getPhoneCountry(fallbackIso);

  if (!digits) {
    return {
      country: fallback,
      national: "",
      e164: "",
    };
  }

  const matches = [];
  for (const country of BY_DIAL_LENGTH) {
    if (!digits.startsWith(country.dial)) continue;
    const national = stripTrunkZero(country, digits.slice(country.dial.length));
    if (nationalFits(country, national)) {
      matches.push({ country, national });
    }
  }

  if (matches.length) {
    const preferred =
      matches.find((item) => item.country.iso === fallback.iso) ||
      matches.find((item) => item.country.iso === "US") ||
      matches[0];
    return {
      country: preferred.country,
      national: preferred.national,
      e164: `+${preferred.country.dial}${preferred.national}`,
    };
  }

  const local = stripTrunkZero(fallback, digits);
  if (nationalFits(fallback, local)) {
    return {
      country: fallback,
      national: local,
      e164: `+${fallback.dial}${local}`,
    };
  }

  return {
    country: fallback,
    national: local,
    e164: "",
  };
};

export const formatE164 = (iso, national) => {
  const country = getPhoneCountry(iso);
  const local = stripTrunkZero(country, digitsOnly(national));
  if (!nationalFits(country, local)) return "";
  return `+${country.dial}${local}`;
};

export const isValidPhone = (value, options = {}) => {
  const allowEmpty = Boolean(options.allowEmpty);
  const raw = String(value || "").trim();
  if (!raw) return allowEmpty;
  return Boolean(parsePhone(raw).e164);
};

export const normalizePhone = (value) => parsePhone(value).e164 || "";

export const toPhoneKey = (value) => {
  const e164 = normalizePhone(value);
  const digits = digitsOnly(e164);
  return digits.length >= 8 ? digits : null;
};

export const phoneLengthError = (iso, national) => {
  const country = getPhoneCountry(iso);
  const { min, max } = nationalLength(country);
  const length = digitsOnly(national).length;
  if (length >= min && length <= max) return null;
  return { iso: country.iso, min, max, exact: min === max };
};

export const flagUrl = (iso) =>
  `https://flagcdn.com/w40/${String(iso || "").toLowerCase()}.png`;
