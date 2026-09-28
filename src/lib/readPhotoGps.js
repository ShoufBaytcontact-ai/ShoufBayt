function u16(view, offset, little) {
  return view.getUint16(offset, little);
}

function u32(view, offset, little) {
  return view.getUint32(offset, little);
}

function typeSize(type) {
  if (type === 1 || type === 2) return 1;
  if (type === 3) return 2;
  if (type === 4 || type === 9) return 4;
  if (type === 5 || type === 10) return 8;
  return 1;
}

function readIfd(view, offset, little) {
  if (offset + 2 > view.byteLength) return [];
  const count = u16(view, offset, little);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const start = offset + 2 + index * 12;
    if (start + 12 > view.byteLength) break;
    entries.push({
      tag: u16(view, start, little),
      type: u16(view, start + 2, little),
      count: u32(view, start + 4, little),
      valueField: start + 8,
      valueOffset: u32(view, start + 8, little),
    });
  }
  return entries;
}

function dataOffset(entry, tiffStart) {
  const bytes = typeSize(entry.type) * entry.count;
  if (bytes <= 4) return entry.valueField;
  return tiffStart + entry.valueOffset;
}

function readAscii(view, offset, count) {
  let text = "";
  const end = Math.min(view.byteLength, offset + count);
  for (let index = offset; index < end; index += 1) {
    const code = view.getUint8(index);
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text;
}

function readRational(view, offset, little) {
  if (offset + 8 > view.byteLength) return 0;
  const denominator = u32(view, offset + 4, little) || 1;
  return u32(view, offset, little) / denominator;
}

function readDms(view, offset, little) {
  return (
    readRational(view, offset, little) +
    readRational(view, offset + 8, little) / 60 +
    readRational(view, offset + 16, little) / 3600
  );
}

function readGps(view, tiffStart, gpsOffset, little) {
  const entries = readIfd(view, tiffStart + gpsOffset, little);
  const byTag = new Map(entries.map((entry) => [entry.tag, entry]));
  const latEntry = byTag.get(2);
  const lngEntry = byTag.get(4);
  const latRef = byTag.get(1);
  const lngRef = byTag.get(3);
  if (!latEntry || !lngEntry) return null;

  let latitude = readDms(view, dataOffset(latEntry, tiffStart), little);
  let longitude = readDms(view, dataOffset(lngEntry, tiffStart), little);
  const latSign = latRef ? readAscii(view, dataOffset(latRef, tiffStart), latRef.count) : "N";
  const lngSign = lngRef ? readAscii(view, dataOffset(lngRef, tiffStart), lngRef.count) : "E";
  if (latSign === "S") latitude *= -1;
  if (lngSign === "W") longitude *= -1;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function readPhotoGps(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const start = offset + 4;
      const label =
        view.byteLength > start + 5 &&
        String.fromCharCode(
          view.getUint8(start),
          view.getUint8(start + 1),
          view.getUint8(start + 2),
          view.getUint8(start + 3)
        );
      if (label === "Exif") {
        const tiffStart = start + 6;
        const little = String.fromCharCode(view.getUint8(tiffStart), view.getUint8(tiffStart + 1)) === "II";
        const first = u32(view, tiffStart + 4, little);
        const entries = readIfd(view, tiffStart + first, little);
        const gps = entries.find((entry) => entry.tag === 0x8825);
        if (!gps) return null;
        return readGps(view, tiffStart, gps.valueOffset, little);
      }
    }
    if (marker === 0xda || size < 2) break;
    offset += 2 + size;
  }

  return null;
}
