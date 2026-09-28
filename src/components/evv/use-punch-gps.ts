import { useCallback, useEffect, useRef, useState } from "react";
import { isGpsFixConfident, pickBetterGpsFix, type GpsFix } from "@/lib/geo";
import { gpsFixFromPosition, HIGH_ACCURACY_GPS_OPTIONS } from "@/lib/gps";

const DEFAULT_FIX_TIMEOUT_MS = 15_000;
const FIX_POLL_INTERVAL_MS = 250;

export function usePunchGps() {
  const [livePos, setLivePos] = useState<GpsFix | null>(null);
  const livePosRef = useRef<GpsFix | null>(null);
  const [hardwareDenied, setHardwareDenied] = useState(false);
  const [gpsAcquiring, setGpsAcquiring] = useState(true);
  const [awaitingGps, setAwaitingGps] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setHardwareDenied(true);
      setGpsAcquiring(false);
      return;
    }

    let cancelled = false;
    const onPosition = (position: GeolocationPosition) => {
      if (cancelled) return;
      setHardwareDenied(false);
      const next = pickBetterGpsFix(livePosRef.current, gpsFixFromPosition(position));
      livePosRef.current = next;
      setLivePos(next);
      setGpsAcquiring(false);
    };
    const onError = (error: GeolocationPositionError) => {
      if (cancelled || error.code !== error.PERMISSION_DENIED) return;
      setHardwareDenied(true);
      setGpsAcquiring(false);
    };

    const watchId = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      HIGH_ACCURACY_GPS_OPTIONS,
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const waitForConfidentFix = useCallback(
    async (timeoutMs = DEFAULT_FIX_TIMEOUT_MS): Promise<GpsFix | null> => {
      const current = livePosRef.current;
      if (isGpsFixConfident(current)) return current;

      setAwaitingGps(true);
      try {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, FIX_POLL_INTERVAL_MS));
          const candidate = livePosRef.current;
          if (isGpsFixConfident(candidate)) return candidate;
        }
        return livePosRef.current;
      } finally {
        setAwaitingGps(false);
      }
    },
    [],
  );

  return {
    livePos,
    livePosRef,
    hardwareDenied,
    gpsAcquiring,
    awaitingGps,
    setAwaitingGps,
    gpsConfident: isGpsFixConfident(livePos),
    waitForConfidentFix,
  };
}
