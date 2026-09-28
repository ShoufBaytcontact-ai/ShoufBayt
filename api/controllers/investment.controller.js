import prisma from "../lib/prisma.js";

const TYPES = ["BUILDING", "LAND", "OFFICE", "SHOP", "WAREHOUSE"];

const clean = (value) => String(value || "").trim();

const toInt = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`${label} must be greater than 0`);
    error.status = 400;
    throw error;
  }
  return Math.round(number);
};

const toCoord = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const requirePin = (latitude, longitude) => {
  const lat = toCoord(latitude);
  const lng = toCoord(longitude);
  if (
    lat == null ||
    lng == null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    const error = new Error("Drop a pin on the map to set the location");
    error.status = 400;
    throw error;
  }
  return { latitude: lat, longitude: lng };
};

const imageUrl = (file) => {
  if (!file) return "";
  return file.secure_url || file.url || file.path || "";
};

const publicInvestment = (item) => {
  if (!item) return null;
  const { user, ...rest } = item;
  return {
    ...rest,
    type: item.investmentType?.toLowerCase(),
    user: user
      ? {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          phone: user.phone,
          role: user.role,
        }
      : null,
  };
};

const userSelect = {
  id: true,
  username: true,
  avatar: true,
  phone: true,
  role: true,
};

export const getInvestments = async (_req, res) => {
  try {
    const items = await prisma.investment.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      include: { user: { select: userSelect } },
    });
    res.json({ items: items.map(publicInvestment) });
  } catch (error) {
    console.error("GET INVESTMENTS", error);
    res.status(500).json({ message: "Failed to load investments" });
  }
};

export const getInvestment = async (req, res) => {
  try {
    const item = await prisma.investment.findUnique({
      where: { id: req.params.id },
      include: { user: { select: userSelect } },
    });
    if (!item || item.status !== "PUBLISHED") {
      return res.status(404).json({ message: "Investment not found" });
    }
    res.json(publicInvestment(item));
  } catch (error) {
    console.error("GET INVESTMENT", error);
    res.status(500).json({ message: "Failed to load investment" });
  }
};

export const addInvestment = async (req, res) => {
  try {
    const role = String(req.userRole || "").toUpperCase();
    if (role !== "AGENT" && role !== "ADMIN") {
      return res.status(403).json({
        message: "Only agents and admins can add an investment",
      });
    }

    const uploaded = (Array.isArray(req.files) ? req.files : [])
      .map(imageUrl)
      .filter(Boolean);

    const item = await prisma.investment.create({
      data: {
        ...readInvestmentFields(req.body || {}),
        images: uploaded,
        status: "PUBLISHED",
        userId: req.userId,
      },
      include: { user: { select: userSelect } },
    });

    res.status(201).json(publicInvestment(item));
  } catch (error) {
    console.error("ADD INVESTMENT", error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to add investment",
    });
  }
};

const canManage = (existing, req) => {
  const role = String(req.userRole || "").toUpperCase();
  if (role === "ADMIN") return true;
  return String(existing.userId) === String(req.userId);
};

const keptImages = (body, existing) => {
  if (body.existingImages === undefined) return [...(existing.images || [])];

  let raw = body.existingImages;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      raw = JSON.parse(trimmed);
    } catch {
      raw = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(raw)) return [];
  const allowed = new Set(existing.images || []);
  return raw.filter((url) => typeof url === "string" && allowed.has(url));
};

const readInvestmentFields = (body) => {
  const title = clean(body.title);
  const city = clean(body.city);
  const address = clean(body.address);
  const description = clean(body.description);
  const investmentType = clean(body.investmentType || body.type).toUpperCase();

  if (!title || !city || !address || description.length < 20) {
    const error = new Error(
      "Title, city, address, and a description of at least 20 characters are required"
    );
    error.status = 400;
    throw error;
  }

  if (!TYPES.includes(investmentType)) {
    const error = new Error("Choose a valid investment type");
    error.status = 400;
    throw error;
  }

  return {
    title,
    price: toInt(body.price, "Price"),
    city,
    address,
    description,
    investmentType,
    ...requirePin(body.latitude, body.longitude),
  };
};

export const updateInvestment = async (req, res) => {
  try {
    const existing = await prisma.investment.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ message: "Investment not found" });
    }
    if (!canManage(existing, req)) {
      return res.status(403).json({ message: "You cannot edit this investment" });
    }

    const uploaded = (Array.isArray(req.files) ? req.files : [])
      .map(imageUrl)
      .filter(Boolean);

    const item = await prisma.investment.update({
      where: { id: existing.id },
      data: {
        ...readInvestmentFields(req.body || {}),
        images: [...keptImages(req.body || {}, existing), ...uploaded],
      },
      include: { user: { select: userSelect } },
    });

    res.json(publicInvestment(item));
  } catch (error) {
    console.error("UPDATE INVESTMENT", error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to update investment",
    });
  }
};

export const deleteInvestment = async (req, res) => {
  try {
    const existing = await prisma.investment.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ message: "Investment not found" });
    }
    if (!canManage(existing, req)) {
      return res.status(403).json({ message: "You cannot delete this investment" });
    }

    await prisma.investment.delete({ where: { id: existing.id } });
    res.json({ message: "Investment deleted" });
  } catch (error) {
    console.error("DELETE INVESTMENT", error);
    res.status(500).json({ message: "Failed to delete investment" });
  }
};

export const updateInvestmentLocation = async (req, res) => {
  try {
    const existing = await prisma.investment.findUnique({
      where: { id: req.params.id },
    });
    if (!existing || existing.status !== "PUBLISHED") {
      return res.status(404).json({ message: "Investment not found" });
    }

    const role = String(req.userRole || "").toUpperCase();
    const isOwner = String(existing.userId) === String(req.userId);
    if (!isOwner && role !== "ADMIN") {
      return res.status(403).json({ message: "You cannot move this pin" });
    }

    const pin = requirePin(req.body?.latitude, req.body?.longitude);
    const item = await prisma.investment.update({
      where: { id: existing.id },
      data: pin,
      include: { user: { select: userSelect } },
    });

    res.json(publicInvestment(item));
  } catch (error) {
    console.error("UPDATE INVESTMENT LOCATION", error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to save the location",
    });
  }
};
