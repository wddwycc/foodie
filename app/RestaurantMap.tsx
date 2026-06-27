"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SETS, type AwardSet, type Restaurant } from "./sets";

const SAPPORO: [number, number] = [141.3545, 43.0618];
const SOURCE_ID = "restaurants";
const ROSE = "#e11d48";

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
  return `
    <div style="font-size:13px;line-height:1.4;max-width:200px">
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
  // True once the user has picked a set; a late geolocation fix must not then
  // yank the camera away from the selected set.
  const hasPickedRef = useRef(false);

  const [selected, setSelected] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = SETS.find((s) => s.slug === selected)?.label;

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

  // Pick up ?set=<slug> from the URL after hydration (client-only).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("set");
    if (slug && SETS.some((s) => s.slug === slug)) setSelected(slug);
  }, []);

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
    // re-centering the camera and fought with the selected set's framing.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geolocate, "top-right");

    map.on("load", () => {
      // One-time recenter on the user's location, but only if no set has been
      // picked yet — otherwise a slow geolocation fix (notably in Safari)
      // overrides the chosen set and makes the camera jump back.
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

      // Individual restaurants.
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ROSE,
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
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

  // Load the selected set's restaurants.
  useEffect(() => {
    if (!selected) return;
    hasPickedRef.current = true;
    let cancelled = false;
    setLoading(true);
    fetch(`/data/${selected}.json`)
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

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(toGeoJSON(restaurants));

    if (restaurants.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const r of restaurants) bounds.extend([r.lng, r.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
  }, [restaurants, mapReady]);

  return (
    <div className="relative h-dvh w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div ref={pickerRef} className="absolute left-3 top-3 z-10 w-56 max-w-[calc(100vw-1.5rem)]">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-xl bg-white/90 px-4 py-2.5 text-left shadow-lg backdrop-blur dark:bg-zinc-900/90"
        >
          <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {selectedLabel ?? "百名店を選ぶ"}
          </span>
          {loading ? (
            <span className="ml-auto text-xs text-zinc-400">読み込み中…</span>
          ) : (
            !loading &&
            selected &&
            restaurants.length > 0 && (
              <span className="ml-auto text-xs text-zinc-400">
                {restaurants.length}店
              </span>
            )
          )}
          <span className="ml-auto text-xs text-zinc-400">▾</span>
        </button>

        {open && (
          <div className="mt-2 max-h-[70vh] overflow-y-auto rounded-xl bg-white/95 p-2 shadow-xl backdrop-blur dark:bg-zinc-900/95">
            {GENRE_GROUPS.map((g) => {
              const choose = (slug: string) => {
                setSelected(slug);
                setOpen(false);
              };
              return (
                <div key={g.genre} className="px-1 py-1">
                  <div className="px-1 pb-1 text-xs font-semibold text-zinc-400">
                    {g.genre}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((s) => {
                      const active = selected === s.slug;
                      return (
                        <button
                          key={s.slug}
                          onClick={() => choose(s.slug)}
                          className={`rounded-full px-3 py-1 text-sm transition-colors ${
                            active
                              ? "bg-rose-600 text-white"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {s.region || "全国"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
