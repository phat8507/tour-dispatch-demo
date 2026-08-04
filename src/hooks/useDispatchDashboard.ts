import { useState, useEffect } from "react";
import { DEMO_TIME } from "@/data/mockData";
import { getLiveDemoTime } from "@/domain/realtime-clock";

export function useDispatchDashboard() {
  const [timeMode, setTimeModeInternal] = useState<"SIMULATED" | "LIVE">("SIMULATED");
  const [currentTime, setCurrentTime] = useState(DEMO_TIME);

  function setTimeMode(mode: "SIMULATED" | "LIVE") {
    setTimeModeInternal(mode);
    if (mode === "SIMULATED") {
      setCurrentTime(DEMO_TIME);
    } else {
      setCurrentTime(getLiveDemoTime(new Date(), DEMO_TIME));
    }
  }

  useEffect(() => {
    if (timeMode === "SIMULATED") return;

    const interval = setInterval(() => {
      setCurrentTime(getLiveDemoTime(new Date(), DEMO_TIME));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeMode]);

  return {
    timeMode,
    setTimeMode,
    currentTime,
  };
}
