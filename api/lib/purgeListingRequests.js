import prisma from "./prisma.js";

export const purgeListingRequests = async (where = {}) => {
  const requests = await prisma.listingRequest.findMany({
    where,
    select: {
      id: true,
    },
  });
  const ids = requests.map((request) => request.id);

  if (!ids.length) {
    return 0;
  }

  await prisma.listingProposal.deleteMany({
    where: {
      listingRequestId: {
        in: ids,
      },
    },
  });

  await prisma.listingRequestInvite.deleteMany({
    where: {
      listingRequestId: {
        in: ids,
      },
    },
  });

  await prisma.listingAdminComment.deleteMany({
    where: {
      listingRequestId: {
        in: ids,
      },
    },
  });

  await prisma.listingRequest.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });

  return ids.length;
};
