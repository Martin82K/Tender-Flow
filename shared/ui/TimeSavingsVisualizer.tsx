import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface TimeSavingsVisualizerProps {
  hoursSaved?: number;
  className?: string;
}

export const TimeSavingsVisualizer: React.FC<TimeSavingsVisualizerProps> = ({
  hoursSaved = 15,
  className = "",
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hlavni kruh s hodinami */}
      <div className="relative w-48 h-48">
        {/* Vnejsi rotujici kruh */}
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/30"
          style={{ animation: "spin 20s linear infinite" }}
        />

        {/* Vnitrni pulzujici kruh */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent backdrop-blur-sm border border-orange-500/20 flex flex-col items-center justify-center">
          {/* Ikona hodin */}
          <div className="relative">
            <Clock className="w-10 h-10 text-orange-400 animate-pulse" />
            {/* Male tecky kolem hodin */}
            <div className="absolute -top-2 -right-2 w-2 h-2 bg-orange-400 rounded-full animate-ping" />
          </div>

          {/* Aktualni cas */}
          <div className="mt-2 text-lg font-mono font-semibold text-orange-200 tabular-nums">
            {formatTime(time)}
          </div>

          {/* Label */}
          <div className="text-[10px] text-orange-400/70 uppercase tracking-wider mt-1">
            Úspora času
          </div>

          {/* Uspora hodin s pulzujicim bilym efektem */}
          <div className="mt-1 text-lg font-bold text-white text-pulse-glow">
            {hoursSaved} hod
          </div>
        </div>

        {/* Orbitani elementy */}
        <div
          className="absolute inset-0"
          style={{ animation: "spin 15s linear infinite reverse" }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
            <div className="w-3 h-3 bg-orange-500 rounded-full shadow-lg shadow-orange-500/50" />
          </div>
        </div>

        <div
          className="absolute inset-0"
          style={{ animation: "spin 10s linear infinite" }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
            <div className="w-2 h-2 bg-orange-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* Dekorativni efekty v pozadi */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
      </div>
    </div>
  );
};
