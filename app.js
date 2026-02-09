const DATA_URL = "composers.json";

/** @typedef {{label: string, url: string}} Link */
/** @typedef {{title: string, opus?: string, instrumentation?: string, key?: string, duration?: string, scoreLinks?: Link[]}} PianoWork */
/**
 * @typedef {{
 *   id: string,
 *   lastName: string,
 *   firstName: string,
 *   birthYear: number,
 *   deathYear?: number|null,
 *   country: string,
 *   birthPlace?: string,
 *   bio?: string,
 *   links?: { wikipedia?: string, imslp?: string, wikidata?: string, other?: Link[] },
 *   pianoWorks?: PianoWork[]
 * }} Composer
 */

const $ = (id) => document.getElementById(id);

const els = {
  q: $("q"),
  country: $("country"),
  bornMin: $("bornMin"),
  bornMax: $("bornMax"),
  sort: $("sort"),
  status: $("status"),
  results: $("results"),
  details: $("details"),
  browse: $("browse"),
  browseStatus: $("browseStatus"),
};

const views = {
  search: $("view-search"),
  browse: $("view-browse"),
  about: $("view-about"),
};

function setView(name) {
  for (const [key, node] of Object.entries(views)) node.classList.toggle("hidden", key !== name);
  for (const btn of document.querySelectorAll(".tab")) {
    const isCurrent = btn.dataset.view === name;
    btn.setAttribute("aria-current", isCurrent ? "page" : "false");
  }
}

function normalize(text) {
  return (text || "").toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function composerLabel(c) {
  const years = `${c.birthYear}\u2013${c.deathYear ?? "?"}`;
  const name =
    c.lastName && c.firstName
      ? `${c.lastName}, ${c.firstName}`
      : c.lastName
        ? c.lastName
        : c.firstName
          ? c.firstName
          : c.id;
  return `${name} (${years})`;
}

function displayNameLastFirst(c) {
  if (c.lastName && c.firstName) return `${c.lastName}, ${c.firstName}`;
  if (c.lastName) return c.lastName;
  if (c.firstName) return c.firstName;
  return c.id;
}

function displayNameFirstLast(c) {
  if (c.firstName && c.lastName) return `${c.firstName} ${c.lastName}`;
  if (c.lastName) return c.lastName;
  if (c.firstName) return c.firstName;
  return c.id;
}

function safeExternalLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function renderDetails(c) {
  const card = document.createElement("div");
  card.className = "details-card";

  const h2 = document.createElement("h2");
  h2.textContent = displayNameFirstLast(c);
  card.appendChild(h2);

  const pills = document.createElement("div");
  pills.className = "pill-row";
  const yearsPill = document.createElement("span");
  yearsPill.className = "pill";
  yearsPill.textContent = `${c.birthYear}\u2013${c.deathYear ?? "?"}`;
  pills.appendChild(yearsPill);

  const countryPill = document.createElement("span");
  countryPill.className = "pill";
  countryPill.textContent = c.country ?? c.birthCountry;
  pills.appendChild(countryPill);

  card.appendChild(pills);

  if (c.birthPlace) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `Born in: ${c.birthPlace}`;
    card.appendChild(p);
  }

  if (c.bio) {
    const p = document.createElement("p");
    p.textContent = c.bio;
    card.appendChild(p);
  }

  const linksRow = document.createElement("p");
  linksRow.className = "muted";
  const links = [];
  if (c.links?.wikipedia) links.push({ label: "Wikipedia", url: c.links.wikipedia });
  if (c.links?.imslp) links.push({ label: "IMSLP", url: c.links.imslp });
  if (c.links?.wikidata) links.push({ label: "Wikidata", url: c.links.wikidata });
  if (c.links?.other?.length) links.push(...c.links.other);

  if (links.length) {
    linksRow.textContent = "Links: ";
    links.forEach((l, i) => {
      if (i) linksRow.appendChild(document.createTextNode(" · "));
      const a = safeExternalLink(l.url);
      a.textContent = l.label;
      linksRow.appendChild(a);
    });
    card.appendChild(linksRow);
  }

  const works = c.pianoWorks ?? [];
  if (!works.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No piano works listed yet.";
    card.appendChild(p);
  } else {
    const h3 = document.createElement("h3");
    h3.textContent = "Piano works";
    card.appendChild(h3);

    const ul = document.createElement("ul");
    ul.className = "work-list";
    for (const w of works) {
      const li = document.createElement("li");
      const titleBits = [w.title];
      if (w.opus) titleBits.push(w.opus);
      const metaBits = [];
      if (w.instrumentation) metaBits.push(w.instrumentation);
      if (w.key) metaBits.push(`key: ${w.key}`);
      if (w.duration) metaBits.push(`dur: ${w.duration}`);
      if (metaBits.length) titleBits.push(`(${metaBits.join(" · ")})`);
      li.appendChild(document.createTextNode(titleBits.join(" ")));

      const scoreLinks = w.scoreLinks ?? [];
      if (scoreLinks.length) {
        li.appendChild(document.createTextNode(" — "));
        scoreLinks.forEach((sl, i) => {
          if (i) li.appendChild(document.createTextNode(", "));
          const a = safeExternalLink(sl.url);
          a.textContent = sl.label;
          li.appendChild(a);
        });
      }
      ul.appendChild(li);
    }
    card.appendChild(ul);
  }

  els.details.replaceChildren(card);
}

function buildCountryOptions(composers) {
  const countries = Array.from(new Set(composers.map((c) => c.country ?? c.birthCountry)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  for (const c of countries) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    els.country.appendChild(opt);
  }
}

function compareBy(sort) {
  switch (sort) {
    case "name":
      return (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    case "year":
      return (a, b) => a.birthYear - b.birthYear || a.lastName.localeCompare(b.lastName);
    case "countryThenYear":
    default:
      return (a, b) =>
        (a.country ?? a.birthCountry).localeCompare(b.country ?? b.birthCountry) ||
        a.birthYear - b.birthYear ||
        a.lastName.localeCompare(b.lastName);
  }
}

function applyFilters(composers) {
  const q = normalize(els.q.value);
  const country = els.country.value;
  const bornMin = Number.parseInt(els.bornMin.value, 10);
  const bornMax = Number.parseInt(els.bornMax.value, 10);

  return composers.filter((c) => {
    const countryValue = c.country ?? c.birthCountry;
    if (country && countryValue !== country) return false;
    if (!Number.isNaN(bornMin) && c.birthYear < bornMin) return false;
    if (!Number.isNaN(bornMax) && c.birthYear > bornMax) return false;

    if (!q) return true;
    const hay = [
      `${c.firstName} ${c.lastName}`,
      `${c.lastName}, ${c.firstName}`,
      c.bio ?? "",
      ...(c.pianoWorks ?? []).flatMap((w) => [w.title, w.opus ?? "", w.instrumentation ?? "", w.key ?? "", w.duration ?? ""]),
    ]
      .map(normalize)
      .join("\n");
    return hay.includes(q);
  });
}

function renderResults(composers) {
  els.results.replaceChildren();
  for (const c of composers) {
    const li = document.createElement("li");
    li.className = "result";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.addEventListener("click", () => renderDetails(c));

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = displayNameLastFirst(c);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${c.country ?? c.birthCountry} · ${c.birthYear}\u2013${c.deathYear ?? "?"}`;

    btn.appendChild(name);
    btn.appendChild(meta);
    li.appendChild(btn);

    els.results.appendChild(li);
  }
}

function renderBrowse(composers) {
  els.browse.replaceChildren();
  const byCountry = new Map();
  for (const c of composers) {
    const key = c.country ?? c.birthCountry;
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key).push(c);
  }

  for (const country of Array.from(byCountry.keys()).sort((a, b) => a.localeCompare(b))) {
    const section = document.createElement("details");
    section.open = false;

    const summary = document.createElement("summary");
    summary.textContent = `${country} (${byCountry.get(country).length})`;
    section.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "work-list";

    const composersSorted = byCountry
      .get(country)
      .slice()
      .sort((a, b) => a.birthYear - b.birthYear || a.lastName.localeCompare(b.lastName));

    for (const c of composersSorted) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = composerLabel(c);
      li.appendChild(strong);
      if (c.bio) {
        li.appendChild(document.createTextNode(` — ${c.bio}`));
      }

      const works = c.pianoWorks ?? [];
      if (works.length) {
        const worksUl = document.createElement("ul");
        worksUl.className = "work-list";
        for (const w of works) {
          const wli = document.createElement("li");
          const bits = [w.title];
          if (w.opus) bits.push(w.opus);
          const metaBits = [];
          if (w.instrumentation) metaBits.push(w.instrumentation);
          if (w.key) metaBits.push(`key: ${w.key}`);
          if (w.duration) metaBits.push(`dur: ${w.duration}`);
          if (metaBits.length) bits.push(`(${metaBits.join(" · ")})`);
          wli.appendChild(document.createTextNode(bits.join(" ")));
          const sl = w.scoreLinks ?? [];
          if (sl.length) {
            wli.appendChild(document.createTextNode(" — "));
            sl.forEach((link, i) => {
              if (i) wli.appendChild(document.createTextNode(", "));
              const a = safeExternalLink(link.url);
              a.textContent = link.label;
              wli.appendChild(a);
            });
          }
          worksUl.appendChild(wli);
        }
        li.appendChild(worksUl);
      }

      list.appendChild(li);
    }

    section.appendChild(list);
    els.browse.appendChild(section);
  }
}

function wireUI(state) {
  const rerender = () => {
    const filtered = applyFilters(state.composers).sort(compareBy(els.sort.value));
    els.status.textContent = `${filtered.length} composer${filtered.length === 1 ? "" : "s"} shown`;
    renderResults(filtered);
  };

  [els.q, els.country, els.bornMin, els.bornMax, els.sort].forEach((el) => el.addEventListener("input", rerender));
  rerender();

  els.browseStatus.textContent = `${state.composers.length} total composer${
    state.composers.length === 1 ? "" : "s"
  }`;
  renderBrowse(state.composers);
}

async function load() {
  try {
    const db =
      window.WOMEN_COMPOSERS_DB ??
      (await (async () => {
        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })());
    const composers = (db.composers ?? []).slice();

    buildCountryOptions(composers);
    wireUI({ composers });

    if (composers.length) renderDetails(composers.slice().sort(compareBy("countryThenYear"))[0]);
    else els.status.textContent = "Database is empty. Add composers to data/composers.json.";
  } catch (err) {
    els.status.innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Could not load the database. Make sure composers.js (or composers.json) is present. If opening locally, serve this folder (run: ruby -run -e httpd . -p 8000) instead of using file://.";
    els.status.appendChild(p);
    console.error(err);
  }
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

setView("search");
load();
