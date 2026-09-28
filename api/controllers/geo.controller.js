import { isMapsLink, parseCoordinates, parseMapsUrl } from "../lib/placeQuery.js";

const clean = (value) => String(value || "").trim().slice(0, 300);

async function searchNominatim(query, country) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  if (country) url.searchParams.set("countrycodes", country);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ShoufBayt/1.0 (property location search)",
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;
  const results = await response.json();
  const hit = Array.isArray(results) ? results[0] : null;
  if (!hit) return null;

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    label: hit.display_name || "",
  };
}

async function resolveMapsLink(query) {
  const direct = parseMapsUrl(query);
  if (direct) return direct;
  if (!isMapsLink(query)) return null;

  const href = /^https?:\/\//i.test(query) ? query : `https://${query}`;
  const response = await fetch(href, {
    redirect: "follow",
    headers: { "User-Agent": "ShoufBayt/1.0" },
  });
  return parseMapsUrl(response.url);
}

export const placeQuery = async (req, res) => {
  try {
    const query = clean(req.body?.query);
    if (!query) {
      return res.status(400).json({ message: "Enter a location" });
    }

    const coordinates = parseCoordinates(query);
    if (coordinates) return res.json(coordinates);

    if (isMapsLink(query) || /google\.|goo\.gl|maps\.app/i.test(query)) {
      const fromLink = await resolveMapsLink(query);
      if (fromLink) return res.json(fromLink);
      return res.status(404).json({
        message: "Could not read that maps link. Paste the full link, or click the map.",
      });
    }

    const inLebanon = await searchNominatim(query, "lb");
    const found = inLebanon || (await searchNominatim(query));
    if (!found) {
      return res.status(404).json({
        message: "Could not find that place. Try a maps link or click the map.",
      });
    }

    res.json(found);
  } catch (error) {
    console.error("PLACE QUERY", error);
    res.status(500).json({ message: "Could not look up that location" });
  }
};
