import { MAPS_CONFIG } from '@/config/maps';

interface RadiusSliderProps {
  value: number;
  onChange: (km: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function RadiusSlider({
  value,
  onChange,
  min = 5,
  max = MAPS_CONFIG.maxRadius,
  className = '',
}: RadiusSliderProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Okruh vzdálenosti
        </label>
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
          {value} km
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-600 accent-blue-500 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
      />
      <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>{min} km</span>
        <span>{max} km</span>
      </div>
    </div>
  );
}
