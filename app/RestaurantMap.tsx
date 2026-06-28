"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SETS, type AwardSet, type Restaurant } from "./sets";
import { PREFECTURE_GROUPS_LIST } from "./prefectures";

const SAPPORO: [number, number] = [141.3545, 43.0618];
const SOURCE_ID = "restaurants";
const ROSE = "#e11d48";

type Mode = "genre" | "pref";
type Selection = { mode: Mode; key: string };

// Group sets by genre for the picker. `region` is the label with the genre
// prefix stripped (e.g. "ラーメン 北海道" → "北海道"); empty for national sets.
type GroupedSet = AwardSet & { region: string };
const GENRE_GROUPS: { genre: string; items: GroupedSet[] }[] = (() => {
  const groups: { genre: string; items: GroupedSet[] }[] = [];
  for (const s of SETS) {
    const region = s.label.startsWith(s.genre)
      ? s.label.slice(s.genre.length).trim()
      : s.label;
    let g = groups.find((x) => x.genre === s.genre);
    if (!g) groups.push((g = { genre: s.genre, items: [] }));
    g.items.push({ ...s, region });
  }
  return groups;
})();

const PREF_JA = new Map(
  PREFECTURE_GROUPS_LIST.flatMap((g) => g.items).map((p) => [p.key, p.ja]),
);

// One emoji per genre, drawn into the map markers so each restaurant shows
// what kind of food it is (especially useful in prefecture view).
const GENRE_EMOJI: Record<string, string> = {
  ラーメン: "🍜",
  寿司: "🍣",
  焼肉: "🥩",
  焼き鳥: "🍗",
  鳥料理: "🐓",
  天ぷら: "🍤",
  うなぎ: "🍱",
  餃子: "🥟",
  カレー: "🍛",
  とんかつ: "🍖",
  そば: "🍜",
  うどん: "🍲",
  パン: "🍞",
  スイーツ: "🍰",
  "和菓子・甘味処": "🍡",
  "アイス・ジェラート": "🍨",
  バー: "🍸",
  立ち飲み: "🍶",
  居酒屋: "🏮",
  カフェ: "☕",
  喫茶店: "☕",
  フレンチ: "🍷",
  イタリアン: "🍝",
  ピザ: "🍕",
  中国料理: "🀄",
  スペイン料理: "🥘",
  ハンバーガー: "🍔",
  日本料理: "🍱",
  "創作料理・イノベーティブ": "✨",
  食堂: "🍚",
  お好み焼き: "🍳",
  "すき焼き・しゃぶしゃぶ": "🍲",
  "ステーキ・鉄板焼き": "🥩",
  "アジア・エスニック": "🍲",
  洋食: "🍽️",
};
const DEFAULT_EMOJI = "🍴";
const ICON_DEFAULT = "genre-default";

// Render an emoji onto a white disc as a map image (ImageData).
function genreIconData(emoji: string, size = 64): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 3, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ROSE;
  ctx.stroke();
  ctx.font = `${Math.round(size * 0.5)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, c, c + size * 0.04);
  return ctx.getImageData(0, 0, size, size);
}

// Versioned path so a CDN doesn't serve stale JSON after the data changes.
const DATA_BASE = "/data/v3";

function dataUrl(sel: Selection): string {
  return sel.mode === "pref"
    ? `${DATA_BASE}/pref/${sel.key}.json`
    : `${DATA_BASE}/${sel.key}.json`;
}

function selectionLabel(sel: Selection): string | undefined {
  return sel.mode === "pref"
    ? PREF_JA.get(sel.key)
    : SETS.find((s) => s.slug === sel.key)?.label;
}

function toGeoJSON(
  restaurants: Restaurant[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: restaurants.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        rank: r.rank,
        name: r.name,
        url: r.url,
        address: r.address,
        rating: r.rating,
        ratingCount: r.ratingCount,
        award: r.award ?? null,
        genre: r.genre ?? null,
      },
    })),
  };
}

function popupHtml(p: Record<string, unknown>): string {
  const rating =
    p.rating != null
      ? `<span style="color:${ROSE};font-weight:600">★ ${Number(p.rating).toFixed(2)}</span>` +
        (p.ratingCount
          ? ` <span style="color:#888">(${p.ratingCount})</span>`
          : "")
      : "";
  const award = p.award
    ? `<div style="display:inline-block;background:#fce7ef;color:${ROSE};border-radius:4px;padding:1px 6px;font-size:11px;margin-bottom:4px">${p.award}</div>`
    : "";
  return `
    <div style="font-size:13px;line-height:1.4;max-width:220px">
      ${award}
      <div style="font-weight:600;margin-bottom:2px">
        <a href="${p.url}" target="_blank" rel="noopener" style="color:#111;text-decoration:none">
          ${p.rank}. ${p.name}
        </a>
      </div>
      <div>${rating}</div>
      <div style="color:#666;margin-top:2px">${p.address}</div>
    </div>`;
}

export default function RestaurantMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // True once the user has picked something; a late geolocation fix must not
  // then yank the camera away from the selection.
  const hasPickedRef = useRef(false);
  // Skip the very first selection→URL sync so the initial URL read isn't undone.
  const firstSyncRef = useRef(true);

  const [selected, setSelected] = useState<Selection | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pref");
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = selected ? selectionLabel(selected) : undefined;

  const choose = (sel: Selection) => {
    setSelected(sel);
    setOpen(false);
  };
  const isActive = (sel: Selection) =>
    selected?.mode === sel.mode && selected?.key === sel.key;

  // Close the picker when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Sync selection from the URL: on load and on browser back/forward.
  useEffect(() => {
    const applyUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const pref = params.get("pref");
      const set = params.get("set");
      if (pref && PREF_JA.has(pref)) {
        setMode("pref");
        setSelected({ mode: "pref", key: pref });
      } else if (set && SETS.some((s) => s.slug === set)) {
        setMode("genre");
        setSelected({ mode: "genre", key: set });
      } else {
        setSelected(null);
      }
    };
    applyUrl();
    window.addEventListener("popstate", applyUrl);
    return () => window.removeEventListener("popstate", applyUrl);
  }, []);

  // Reflect the current selection back into the URL (shareable + history).
  useEffect(() => {
    if (firstSyncRef.current) {
      firstSyncRef.current = false;
      return;
    }
    const url = new URL(window.location.href);
    const cur = url.searchParams.get("pref")
      ? `pref:${url.searchParams.get("pref")}`
      : url.searchParams.get("set")
        ? `set:${url.searchParams.get("set")}`
        : "";
    const next = selected
      ? `${selected.mode === "pref" ? "pref" : "set"}:${selected.key}`
      : "";
    if (cur === next) return; // already in sync (e.g. came from popstate)
    url.searchParams.delete("set");
    url.searchParams.delete("pref");
    if (selected) {
      url.searchParams.set(selected.mode === "pref" ? "pref" : "set", selected.key);
    }
    window.history.pushState(null, "", url);
  }, [selected]);

  // Init map once, and set up the clustered source + layers on style load.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: SAPPORO,
      zoom: 11,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Manual recenter button. No continuous tracking — tracking mode kept
    // re-centering the camera and fought with the selection's framing.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geolocate, "top-right");

    map.on("load", () => {
      // One-time recenter on the user's location, but only if nothing has been
      // picked yet — otherwise a slow geolocation fix (notably in Safari)
      // overrides the selection and makes the camera jump back.
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          if (hasPickedRef.current) return;
          map.easeTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 12,
          });
        },
        undefined,
        { enableHighAccuracy: true, timeout: 8000 },
      );

      // Register a marker image per genre (emoji on a white disc).
      for (const genre of new Set(SETS.map((s) => s.genre))) {
        map.addImage(`genre-${genre}`, genreIconData(GENRE_EMOJI[genre] ?? DEFAULT_EMOJI), {
          pixelRatio: 2,
        });
      }
      map.addImage(ICON_DEFAULT, genreIconData(DEFAULT_EMOJI), { pixelRatio: 2 });

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      // Cluster bubbles — size/color scale with the number of restaurants.
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#f43f5e",
            10,
            "#e11d48",
            30,
            "#be123c",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            22,
            30,
            30,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#fff" },
      });

      // Individual restaurants — a genre emoji marker.
      map.addLayer({
        id: "unclustered-point",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "coalesce",
            ["image", ["concat", "genre-", ["get", "genre"]]],
            ["image", ICON_DEFAULT],
          ],
          "icon-size": 1.4,
          "icon-allow-overlap": true,
        },
      });

      // Click a cluster → zoom in to expand it.
      map.on("click", "clusters", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
          });
        });
      });

      // Click a restaurant → popup.
      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(
            (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          )
          .setHTML(popupHtml(feature.properties ?? {}))
          .addTo(map);
      });

      for (const layer of ["clusters", "unclustered-point"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Load the selected dataset's restaurants.
  useEffect(() => {
    if (!selected) return;
    hasPickedRef.current = true;
    let cancelled = false;
    setLoading(true);
    fetch(dataUrl(selected))
      .then((res) => res.json())
      .then((data: Restaurant[]) => {
        if (!cancelled) setRestaurants(data);
      })
      .catch(() => {
        if (!cancelled) setRestaurants([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Push restaurants into the clustered source and frame them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(toGeoJSON(restaurants));

    if (restaurants.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const r of restaurants) bounds.extend([r.lng, r.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
  }, [restaurants, mapReady]);

  const tabClass = (m: Mode) =>
    `flex-1 rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
      mode === m
        ? "bg-rose-600 text-white"
        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    }`;
  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition-colors ${
      active
        ? "bg-rose-600 text-white"
        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    }`;

  return (
    <div className="relative h-dvh w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div
        ref={pickerRef}
        className="absolute left-3 top-3 z-10 w-80 max-w-[calc(100vw-1.5rem)]"
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-xl bg-white/90 px-4 py-2.5 text-left shadow-lg backdrop-blur dark:bg-zinc-900/90"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {selectedLabel ?? "百名店を選ぶ"}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
            {loading ? (
              <span>読み込み中…</span>
            ) : (
              selected &&
              restaurants.length > 0 && <span>{restaurants.length}店</span>
            )}
            <span>▾</span>
          </span>
        </button>

        {open && (
          <div className="mt-2 max-h-[70vh] overflow-y-auto rounded-xl bg-white/95 p-2 shadow-xl backdrop-blur dark:bg-zinc-900/95">
            <div className="mb-1 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              <button onClick={() => setMode("pref")} className={tabClass("pref")}>
                都道府県
              </button>
              <button onClick={() => setMode("genre")} className={tabClass("genre")}>
                ジャンル
              </button>
            </div>

            {mode === "genre"
              ? GENRE_GROUPS.map((g) => (
                  <div key={g.genre} className="px-1 py-1">
                    <div className="px-1 pb-1 text-xs font-semibold text-zinc-400">
                      {g.genre}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.items.map((s) => (
                        <button
                          key={s.slug}
                          onClick={() => choose({ mode: "genre", key: s.slug })}
                          className={chipClass(isActive({ mode: "genre", key: s.slug }))}
                        >
                          {s.region || "全国"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              : PREFECTURE_GROUPS_LIST.map((g) => (
                  <div key={g.region} className="px-1 py-1">
                    <div className="px-1 pb-1 text-xs font-semibold text-zinc-400">
                      {g.region}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.items.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => choose({ mode: "pref", key: p.key })}
                          className={chipClass(isActive({ mode: "pref", key: p.key }))}
                        >
                          {p.ja}
                          <span className="ml-1 opacity-60">{p.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
