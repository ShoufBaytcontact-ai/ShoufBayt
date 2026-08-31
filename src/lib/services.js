import apiRequest from "./apiRequest";

export const subscriptionApi = {
  me: () => apiRequest.get("/subscriptions/me"),
  history: () => apiRequest.get("/subscriptions/me/history"),
  cancelAutoRenew: () => apiRequest.patch("/subscriptions/me/cancel-auto-renew"),
  cancel: () => apiRequest.patch("/subscriptions/me/cancel"),
  resume: () => apiRequest.patch("/subscriptions/me/resume"),
};

export const agentInsightsApi = {
  me: () => apiRequest.get("/agents/me/insights"),
};

export const agentProfileApi = {
  me: () => apiRequest.get("/agents/me"),
  update: (formData) => apiRequest.put("/agents/me", formData),
};

export const ownerDashboardApi = {
  me: () => apiRequest.get("/users/me/owner-dashboard"),
};

export const appointmentApi = {
  mine: () => apiRequest.get("/appointments/me"),
  create: (data) => apiRequest.post("/appointments", data),
  update: (id, data) => apiRequest.patch(`/appointments/${id}`, data),
};

export const paymentApi = {
  overview: () => apiRequest.get("/payments/overview"),
  mine: () => apiRequest.get("/payments/me"),
  submit: (formData) =>
    apiRequest.post("/payments/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  cardConfig: () => apiRequest.get("/payments/card/config"),
  createCardIntent: (data) => apiRequest.post("/payments/card/intent", data),
  completeCard: (data) => apiRequest.post("/payments/card/complete", data),
  adminList: (status) =>
    apiRequest.get("/payments/admin", {
      params: status ? { status } : undefined,
    }),
  review: (id, data) => apiRequest.patch(`/payments/admin/${id}/review`, data),
};

export const notificationApi = {
  list: (unread = false) =>
    apiRequest.get("/notifications", {
      params: unread ? { unread: true } : undefined,
    }),
  markRead: (id) => apiRequest.patch(`/notifications/${id}/read`),
  markAllRead: () => apiRequest.patch("/notifications/read-all"),
  remove: (id) => apiRequest.delete(`/notifications/${id}`),
  removeAll: () => apiRequest.delete("/notifications"),
};

export const reportApi = {
  create: (data) => apiRequest.post("/reports", data),
  mine: () => apiRequest.get("/reports/me"),
  adminList: (status) =>
    apiRequest.get("/reports/admin", {
      params: status ? { status } : undefined,
    }),
  review: (id, data) => apiRequest.patch(`/reports/admin/${id}/review`, data),
};

export const reviewApi = {
  propertyList: (propertyId) =>
    apiRequest.get(`/reviews/property/${propertyId}`),
  propertyCreate: (propertyId, data) =>
    apiRequest.post(`/reviews/property/${propertyId}`, data),
  propertyUpdate: (reviewId, data) =>
    apiRequest.patch(`/reviews/property/item/${reviewId}`, data),
  propertyDelete: (reviewId) =>
    apiRequest.delete(`/reviews/property/item/${reviewId}`),
  agentList: (agentProfileId) =>
    apiRequest.get(`/reviews/agent/${agentProfileId}`),
  agentCreate: (agentProfileId, data) =>
    apiRequest.post(`/reviews/agent/${agentProfileId}`, data),
  agentUpdate: (reviewId, data) =>
    apiRequest.patch(`/reviews/agent/item/${reviewId}`, data),
  agentDelete: (reviewId) =>
    apiRequest.delete(`/reviews/agent/item/${reviewId}`),
};

export const adminBillingApi = {
  subscriptions: (params) =>
    apiRequest.get("/subscriptions/admin", { params }),
  expireSubscription: (id) =>
    apiRequest.patch(`/subscriptions/admin/${id}/expire`),
  launchPeriod: () => apiRequest.get("/subscriptions/admin/launch-period"),
  sendLaunchTest: (data) =>
    apiRequest.post("/subscriptions/admin/launch-period/test", data),
  sendLaunchEmails: (data) =>
    apiRequest.post("/subscriptions/admin/launch-period/send", data),
};

export const listingRequestApi = {
  create: (formData) =>
    apiRequest.post("/listing-requests", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  mine: () => apiRequest.get("/listing-requests/me"),
  get: (id) => apiRequest.get(`/listing-requests/${id}`),
  cancel: (id) => apiRequest.patch(`/listing-requests/${id}/cancel`),
  leads: () => apiRequest.get("/listing-requests/leads"),
  inbox: (status) =>
    apiRequest.get("/listing-requests/inbox", {
      params: status ? { status } : undefined,
    }),
  propose: (requestId, data) =>
    apiRequest.post(`/listing-requests/${requestId}/proposals`, data),
  withdrawProposal: (proposalId) =>
    apiRequest.post(`/listing-requests/proposals/${proposalId}/withdraw`),
  acceptProposal: (requestId, proposalId) =>
    apiRequest.post(
      `/listing-requests/${requestId}/proposals/${proposalId}/accept`
    ),
  rejectProposal: (requestId, proposalId) =>
    apiRequest.post(
      `/listing-requests/${requestId}/proposals/${proposalId}/reject`
    ),
  accept: (inviteId) =>
    apiRequest.post(`/listing-requests/invites/${inviteId}/accept`),
  reject: (inviteId) =>
    apiRequest.post(`/listing-requests/invites/${inviteId}/reject`),
};

