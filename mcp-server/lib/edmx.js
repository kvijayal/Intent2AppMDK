// Minimal, dependency-free OData $metadata (EDMX) reader. Best-effort, tolerant of edm: prefixes.
// Used to scaffold an offline mock for RAP / existing-OData backends.

export function parseEdmx(xml) {
  const entityTypes = {};
  const typeRe = /<(?:edm:)?EntityType\b[^>]*\bName=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:edm:)?EntityType>/g;
  let m;
  while ((m = typeRe.exec(xml))) {
    const name = m[1];
    const body = m[2];
    const props = [];
    const propRe = /<(?:edm:)?Property\b[^>]*\bName=["']([^"']+)["'][^>]*\bType=["']([^"']+)["'][^>]*\/?>/g;
    let pm;
    while ((pm = propRe.exec(body))) props.push({ name: pm[1], type: pm[2] });
    const keys = [];
    const keyBlock = body.match(/<(?:edm:)?Key>([\s\S]*?)<\/(?:edm:)?Key>/);
    if (keyBlock) {
      const kr = /<(?:edm:)?PropertyRef\b[^>]*\bName=["']([^"']+)["']/g;
      let km;
      while ((km = kr.exec(keyBlock[1]))) keys.push(km[1]);
    }
    // Navigation properties + referential constraints (the FK ↔ value-list link).
    const navProps = [];
    const navRe = /<(?:edm:)?NavigationProperty\b[^>]*\bName=["']([^"']+)["'][^>]*\bType=["']([^"']+)["'][^>]*(?:\/>|>([\s\S]*?)<\/(?:edm:)?NavigationProperty>)/g;
    let nm;
    while ((nm = navRe.exec(body))) {
      const rawType = nm[2];
      const collection = /^Collection\(/.test(rawType);
      const target = rawType.replace(/^Collection\(/, "").replace(/\)$/, "").split(".").pop();
      const constraints = [];
      const inner = nm[3] || "";
      const rcRe = /<(?:edm:)?ReferentialConstraint\b[^>]*\bProperty=["']([^"']+)["'][^>]*\bReferencedProperty=["']([^"']+)["']/g;
      let rc;
      while ((rc = rcRe.exec(inner))) constraints.push({ property: rc[1], referencedProperty: rc[2] });
      navProps.push({ name: nm[1], target, collection, constraints });
    }
    entityTypes[name] = { name, props, keys, navProps };
  }

  const entitySets = [];
  const setRe = /<(?:edm:)?EntitySet\b[^>]*\bName=["']([^"']+)["'][^>]*\bEntityType=["']([^"']+)["']/g;
  while ((m = setRe.exec(xml))) {
    entitySets.push({ name: m[1], entityType: m[2].split(".").pop() });
  }

  return { entityTypes, entitySets };
}

/**
 * Build mock data for every entity set with FOREIGN-KEY COORDINATION: a field that is the local side
 * of a referential constraint (a FK to a value-list/check entity) is filled from the referenced
 * entity's real key values — so filter dropdowns and F4 value helps actually match the data, instead
 * of generic non-matching values (the cause of empty/return-nothing filters). Returns { setName: rows }.
 */
export function buildMockData({ entityTypes, entitySets }, n = 3) {
  const dataBySet = {};
  // Pass 1: independent rows per set.
  for (const set of entitySets) {
    const et = entityTypes[set.entityType];
    if (!et) continue;
    dataBySet[set.name] = makeMockRows(et, n);
  }
  // Resolve an entity-type name → the first entity set exposing it.
  const setForType = {};
  for (const set of entitySets) if (!setForType[set.entityType]) setForType[set.entityType] = set.name;
  // Pass 2: overwrite FK fields from the referenced set's key values.
  for (const set of entitySets) {
    const et = entityTypes[set.entityType];
    if (!et) continue;
    const rows = dataBySet[set.name];
    for (const nav of et.navProps || []) {
      if (nav.collection || !nav.constraints.length) continue;     // to-one only
      const targetSet = setForType[nav.target];
      const targetRows = targetSet && dataBySet[targetSet];
      if (!targetRows || !targetRows.length) continue;
      rows.forEach((row, i) => {
        const ref = targetRows[i % targetRows.length];
        for (const c of nav.constraints) {
          if (ref[c.referencedProperty] !== undefined) row[c.property] = ref[c.referencedProperty];
        }
      });
    }
  }
  return dataBySet;
}

export function sampleValue(type, name, i) {
  const t = (type || "").toLowerCase();
  if (t.includes("int")) return i + 1;
  if (t.includes("decimal") || t.includes("double") || t.includes("single")) return Number(((i + 1) * 11.5).toFixed(2));
  if (t.includes("bool")) return i % 2 === 0;
  if (t.includes("datetimeoffset") || (t.includes("date") && t.includes("time")))
    return new Date(Date.UTC(2026, 0, (i % 27) + 1, 9, 0, 0)).toISOString();
  if (t.includes("date")) return `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, "0")}`;
  if (t.includes("guid")) return `00000000-0000-4000-8000-0000000000${String((i % 89) + 10)}`;
  return `${name} ${i + 1}`;
}

export function makeMockRows(entityType, n = 3) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const row = {};
    for (const p of entityType.props) row[p.name] = sampleValue(p.type, p.name, i);
    rows.push(row);
  }
  return rows;
}
