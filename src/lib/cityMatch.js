const CITY_GROUPS = [
  ["zahle", "zahleh", "zahli", "zahly", "zahlé", "zahleé", "زحلة"],
  ["beirut", "beyrouth", "beirout", "بيروت"],
  ["tripoli", "trablous", "trablus", "طرابلس"],
  ["jounieh", "jounie", "junieh", "junie", "جونيه", "جونية"],
  ["byblos", "jbeil", "jbail", "جبيل"],
  ["sidon", "saida", "sayda", "صيدا"],
  ["tyre", "sour", "sur", "صور"],
  ["baalbek", "baalbeck", "بعلبك"],
  ["nabatieh", "nabatiyeh", "nabatiye", "النبطية", "نبطية"],
  ["aley", "alayh", "عاليه"],
  ["baabda", "بعبدا"],
  ["batroun", "البترون", "بترون"],
  ["zgharta", "زغرتا"],
  ["bcharre", "bsharri", "bsharre", "بشري"],
  ["jezzine", "جزين"],
  ["hasbaya", "hasbaiya", "حاصبيا"],
  ["marjayoun", "marjeyoun", "مرجعيون"],
  ["rashaya", "راشيا"],
  ["hermel", "الهرمل", "هرمل"],
  ["keserwan", "kesrouan", "كسروان"],
  ["chouf", "shouf", "الشوف", "شوف"],
  ["metn", "elmetn", "المتن", "متن"],
];

function foldCity(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^ال/, "")
    .replace(/[^a-z\u0600-\u06ff]+/g, "")
    .replace(/ou/g, "u")
    .replace(/eh$/g, "e")
    .replace(/h$/g, "");
}

function citySkeleton(value) {
  return foldCity(value).replace(/[aeiouy]/g, "");
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let previous = i - 1;
    rows[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const current = rows[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + cost);
      previous = current;
    }
  }

  return rows[b.length];
}

const CANONICAL = (() => {
  const map = new Map();

  CITY_GROUPS.forEach((group, index) => {
    const id = `city-${index}`;
    group.forEach((name) => {
      map.set(foldCity(name), id);
    });
  });

  return map;
})();

export function citiesMatch(cityA, cityB) {
  const left = foldCity(cityA);
  const right = foldCity(cityB);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const leftId = CANONICAL.get(left);
  const rightId = CANONICAL.get(right);
  if (leftId && rightId && leftId === rightId) {
    return true;
  }

  if (
    (left.includes(right) || right.includes(left)) &&
    Math.min(left.length, right.length) >= 4
  ) {
    return true;
  }

  const leftSkeleton = citySkeleton(cityA);
  const rightSkeleton = citySkeleton(cityB);
  if (
    leftSkeleton.length >= 3 &&
    leftSkeleton === rightSkeleton
  ) {
    return true;
  }

  const shortest = Math.min(left.length, right.length);
  const allowed = shortest >= 6 ? 2 : shortest >= 4 ? 1 : 0;

  return allowed > 0 && editDistance(left, right) <= allowed;
}
