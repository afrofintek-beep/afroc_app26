import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

// Behavioral test of LocationMap's readOnly mode with mapbox-gl mocked.
const mapOn = vi.fn();
const addControl = vi.fn();
const markerCtor = vi.fn();
const mapCtor = vi.fn();
let geolocateCount = 0;

vi.mock("mapbox-gl", () => {
  class Map {
    constructor(opts: unknown) { mapCtor(opts); }
    addControl = addControl;
    on = mapOn;
    remove = vi.fn();
    resize = vi.fn();
    flyTo = vi.fn();
  }
  class Marker {
    constructor(opts: unknown) { markerCtor(opts); }
    setLngLat() { return this; }
    addTo() { return this; }
    on = vi.fn();
    getLngLat() { return { lat: 0, lng: 0 }; }
  }
  class NavigationControl { constructor(_: unknown) {} }
  class GeolocateControl { constructor(_: unknown) { geolocateCount++; } }
  return { default: { Map, Marker, NavigationControl, GeolocateControl, accessToken: "" } };
});

vi.mock("@/lib/authedInvoke", () => ({
  authedInvoke: vi.fn().mockResolvedValue({ data: { token: "pk.test" }, error: null }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

import LocationMap from "@/components/LocationMap";

beforeEach(() => {
  mapOn.mockClear();
  addControl.mockClear();
  markerCtor.mockClear();
  mapCtor.mockClear();
  geolocateCount = 0;
  // Make the WebGL support check pass under jsdom.
  (HTMLCanvasElement.prototype as unknown as { getContext: () => object }).getContext = () => ({});
  // jsdom has no ResizeObserver.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const hasClickHandler = () => mapOn.mock.calls.some((c) => c[0] === "click");
const markerDraggable = () => (markerCtor.mock.calls[0]?.[0] as { draggable?: boolean })?.draggable;

describe("LocationMap readOnly mode", () => {
  it("interactive (default): click handler + draggable marker + geolocate control", async () => {
    render(<LocationMap onLocationSelect={() => {}} latitude={-8.8} longitude={13.2} />);
    await waitFor(() => expect(mapCtor).toHaveBeenCalled());
    expect(hasClickHandler()).toBe(true);
    expect(markerDraggable()).toBe(true);
    expect(geolocateCount).toBe(1);
  });

  it("readOnly: NO click handler, marker not draggable, no geolocate control", async () => {
    render(<LocationMap readOnly onLocationSelect={() => {}} latitude={-8.8} longitude={13.2} />);
    await waitFor(() => expect(mapCtor).toHaveBeenCalled());
    expect(hasClickHandler()).toBe(false);
    expect(markerDraggable()).toBe(false);
    expect(geolocateCount).toBe(0);
  });
});
