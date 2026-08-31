/**
 * Ensure existing verified agents have serviceAreas seeded from location
 * and are marked verified for lead matching.
 */
import dns from "dns";
import prisma from "../lib/prisma.js";

dns.setDefaultResultOrder("ipv4first");

const profiles = await prisma.agentProfile.findMany({
  select: {
    id: true,
    location: true,
    serviceAreas: true,
    isVerified: true,
  },
});

let updated = 0;

for (const profile of profiles) {
  const areas = Array.isArray(profile.serviceAreas)
    ? profile.serviceAreas.filter(Boolean)
    : [];
  const nextAreas =
    areas.length > 0
      ? areas
      : profile.location
        ? [profile.location]
        : [];

  if (
    !profile.isVerified ||
    areas.length === 0 ||
    JSON.stringify(areas) !== JSON.stringify(nextAreas)
  ) {
    await prisma.agentProfile.update({
      where: { id: profile.id },
      data: {
        isVerified: true,
        serviceAreas: nextAreas,
      },
    });
    updated += 1;
  }
}

console.log(`Updated ${updated} agent profiles for lead matching`);
await prisma.$disconnect();
