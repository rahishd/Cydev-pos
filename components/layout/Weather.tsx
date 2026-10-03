"use client";

import { useEffect, useState } from "react";

// Kathmandu, used until (or unless) the phone shares its location.
const FALLBACK = { lat: 27.7172, lon: 85.324 };
const CACHE_KEY = "weather-v1";
const CACHE_MS = 15 * 60 * 1000;

type Reading = { temp: number; code: number; day: boolean; at: number };

function describe(code: number, day: boolean): { icon: string; label: string } {
  if (code === 0) return { icon: day ? "☀️" : "🌙", label: "Clear" };
  if (code <= 2) return { icon: day ? "🌤️" : "☁️", label: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { icon: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { icon: "❄️", label: "Snow" };
  if (code >= 80 && code <= 82) return { icon: "🌧️", label: "Showers" };
  if (code >= 95) return { icon: "⛈️", label: "Thunderstorm" };
  return { icon: "🌡️", label: "Weather" };
}

function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(FALLBACK);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(FALLBACK),
      { timeout: 6000, maximumAge: CACHE_MS }
    );
  });
}

/** Current temperature for where the phone is (Open-Meteo, no key needed). Falls back to Kathmandu. */
export function Weather({ className }: { className?: string }) {
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as Reading | null;
      if (cached && Date.now() - cached.at < CACHE_MS) {
        setReading(cached);
        return;
      }
    } catch {}

    (async () => {
      try {
        const { lat, lon } = await getPosition();
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code,is_day`
        );
        if (!res.ok) return;
        const j = (await res.json()) as { current?: { temperature_2m: number; weather_code: number; is_day: number } };
        if (!alive || !j.current) return;
        const next: Reading = {
          temp: Math.round(j.current.temperature_2m),
          code: j.current.weather_code,
          day: j.current.is_day === 1,
          at: Date.now(),
        };
        setReading(next);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {}
      } catch {
        // No connection: just leave the weather out.
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!reading) return null;
  const { icon, label } = describe(reading.code, reading.day);
  return (
    <span className={className} title={label}>
      <span aria-hidden>{icon}</span> {reading.temp}°C
    </span>
  );
}
