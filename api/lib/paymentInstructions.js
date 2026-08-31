export const PREMIUM_PAYEE = {
  name: "Hamza Farhat",
  phone: "+96171582487",
  phoneDisplay: "+961 71 582 487",
};

export const payeeInstructionParagraph = (price) =>
  `To pay, send <strong>$${price}</strong> via OMT, Whish Money, or BOB Finance to <strong>${PREMIUM_PAYEE.name}</strong> at <strong>${PREMIUM_PAYEE.phoneDisplay}</strong>, then upload a clear receipt on the Billing page. Premium is activated after the receipt is confirmed.`;

export const payeeEmailDetails = (price) => [
  { label: "Send to", value: PREMIUM_PAYEE.name },
  { label: "Number", value: PREMIUM_PAYEE.phoneDisplay },
  { label: "Amount", value: `$${price} USD` },
  { label: "After sending", value: "Upload the receipt on Billing" },
];
