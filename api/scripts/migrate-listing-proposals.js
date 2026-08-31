/**
 * Migrate listing-request statuses to Phase 2 enums (via Prisma).
 */
import dns from "dns";
import prisma from "../lib/prisma.js";

dns.setDefaultResultOrder("ipv4first");

async function main() {
  const reqMap = [
    ["PENDING", "OPEN"],
    ["ACCEPTED", "AWARDED"],
    ["REJECTED", "CANCELLED"],
  ];

  for (const [from, to] of reqMap) {
    const r = await prisma.listingRequest.updateMany({
      where: { status: from },
      data: { status: to },
    });
    console.log(`ListingRequest ${from} -> ${to}: ${r.count}`);
  }

  const inviteMap = [
    ["PENDING", "NOTIFIED"],
    ["ACCEPTED", "PROPOSED"],
  ];

  for (const [from, to] of inviteMap) {
    const r = await prisma.listingRequestInvite.updateMany({
      where: { status: from },
      data: { status: to },
    });
    console.log(`ListingRequestInvite ${from} -> ${to}: ${r.count}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
