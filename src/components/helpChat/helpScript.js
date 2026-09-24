export const WHATSAPP = {
  technical: "96171582487",
  business: "96171480666",
};

export function whatsappUrl(kind, text) {
  const phone = WHATSAPP[kind];
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${phone}${query}`;
}

export const helpScript = {
  start: {
    choices: [
      { id: "technical", next: "technical" },
      { id: "business", next: "business" },
    ],
  },
  technical: {
    choices: [
      { id: "login", next: "techLogin" },
      { id: "phone", next: "techPhone" },
      { id: "page", next: "techPage" },
      { id: "account", next: "techAccount" },
      { id: "notHelped", whatsapp: "technical" },
    ],
  },
  business: {
    choices: [
      { id: "listings", next: "bizListings" },
      { id: "agentContact", next: "bizAgentContact" },
      { id: "other", next: "bizOther" },
      { id: "notHelped", whatsapp: "business" },
    ],
  },
  techLogin: {
    choices: [
      { id: "openLogin", href: "/login" },
      { id: "forgot", href: "/forgot-password" },
      { id: "notHelped", whatsapp: "technical" },
    ],
  },
  techPhone: {
    choices: [
      { id: "openPhone", href: "/verify-phone", auth: true },
      { id: "notHelped", whatsapp: "technical" },
    ],
  },
  techPage: {
    choices: [{ id: "notHelped", whatsapp: "technical" }],
  },
  techAccount: {
    choices: [
      { id: "openProfile", href: "/profile", auth: true },
      { id: "notHelped", whatsapp: "technical" },
    ],
  },
  bizListings: {
    choices: [
      { id: "browse", href: "/list" },
      { id: "listProperty", href: "/request-listing", auth: true },
      { id: "notHelped", whatsapp: "business" },
    ],
  },
  bizAgentContact: {
    choices: [
      { id: "browse", href: "/list" },
      { id: "notHelped", whatsapp: "business" },
    ],
  },
  bizOther: {
    choices: [{ id: "whatsapp", whatsapp: "business" }],
  },
};
