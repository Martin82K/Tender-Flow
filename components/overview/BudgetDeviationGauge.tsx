import React from 'react';
import { TrendingDown, TrendingUp, Minus, Target } from 'lucide-react';

interface BudgetDeviationGaugeProps {
  avgDeviationPercent: number | null;
}

export const BudgetDeviationGauge: React.FC<BudgetDeviationGaugeProps> = ({
  avgDeviationPercent,
}) => {
  // Determine color based on deviation - more vibrant colors
  const getColor = () => {
    if (avgDeviationPercent === null) return '#64748B';
    if (avgDeviationPercent <= -10) return '#059669'; // Strong green: very good
    if (avgDeviationPercent <= -5) return '#10B981';  // Green: good
    if (avgDeviationPercent <= 5) return '#F59E0B';   // Amber: acceptable
    if (avgDeviationPercent <= 15) return '#F97316';  // Orange: caution
    return '#EF4444'; // Red: bad
  };

  const getBgColor = () => {
    if (avgDeviationPercent === null) return 'bg-slate-100 dark:bg-slate-800';
    if (avgDeviationPercent <= -10) return 'bg-emerald-100 dark:bg-emerald-900/40';
    if (avgDeviationPercent <= -5) return 'bg-emerald-50 dark:bg-emerald-900/30';
    if (avgDeviationPercent <= 5) return 'bg-amber-100 dark:bg-amber-900/40';
    if (avgDeviationPercent <= 15) return 'bg-orange-100 dark:bg-orange-900/40';
    return 'bg-rose-100 dark:bg-rose-900/40';
  };

  const getLabel = () => {
    if (avgDeviationPercent === null) return 'Bez dat';
    if (avgDeviationPercent <= -10) return 'Výrazně pod rozpočtem';
    if (avgDeviationPercent < 0) return 'Pod rozpočtem';
    if (avgDeviationPercent === 0) return 'V rozpočtu';
    if (avgDeviationPercent <= 5) return 'Mírně nad rozpočtem';
    if (avgDeviationPercent <= 15) return 'Nad rozpočtem';
    return 'Výrazně nad rozpočtem';
  };

  const getIcon = () => {
    if (avgDeviationPercent === null) return <Minus className="w-5 h-5" />;
    if (avgDeviationPercent < 0) return <TrendingDown className="w-5 h-5" />;
    if (avgDeviationPercent > 0) return <TrendingUp className="w-5 h-5" />;
    return <Target className="w-5 h-5" />;
  };

  const color = getColor();
  
  // Calculate gauge angle (semi-circle: -90 to 90 degrees)
  // Range: -30% to +30% maps to -90 to +90 degrees
  const clampedValue = avgDeviationPercent !== null 
    ? Math.max(-30, Math.min(30, avgDeviationPercent)) 
    : 0;
  const angle = (clampedValue / 30) * 90;

  // Generate arc path
  const describeArc = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
    const start = polarToCartesian(100, 100, outerR, endAngle);
    const end = polarToCartesian(100, 100, outerR, startAngle);
    const innerStart = polarToCartesian(100, 100, innerR, endAngle);
    const innerEnd = polarToCartesian(100, 100, innerR, startAngle);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", start.x, start.y,
      "A", outerR, outerR, 0, largeArcFlag, 0, end.x, end.y,
      "L", innerEnd.x, innerEnd.y,
      "A", innerR, innerR, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      "Z"
    ].join(" ");
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 text-center">
        Průměrná nabídková cena proti smluvní ceně s investorem
      </h4>
      
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Main content: legend left, gauge center */}
        <div className="flex items-center justify-center gap-6">
          {/* Legend - vertical column on left */}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">&lt; -5%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">±5%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">&gt; +15%</span>
            </div>
          </div>

          {/* Gauge Container - no background */}
          <div className="relative">
            {/* Gauge SVG */}
            <div className="relative w-44 h-26">
              <svg viewBox="0 0 200 120" className="w-full h-full">
                {/* Background arc - darker for contrast */}
                <path
                  d={describeArc(-90, 90, 55, 85)}
                  fill="#CBD5E1"
                  className="dark:fill-slate-600"
                />
                
                {/* Colored zones - more vibrant, no opacity */}
                <path
                  d={describeArc(-90, -45, 55, 85)}
                  fill="#10B981"
                />
                <path
                  d={describeArc(-45, -15, 55, 85)}
                  fill="#34D399"
                />
                <path
                  d={describeArc(-15, 15, 55, 85)}
                  fill="#F59E0B"
                />
                <path
                  d={describeArc(15, 45, 55, 85)}
                  fill="#F97316"
                />
                <path
                  d={describeArc(45, 90, 55, 85)}
                  fill="#EF4444"
                />
                
                {/* Tick marks */}
                {[-30, -15, 0, 15, 30].map((tick) => {
                  const tickAngle = (tick / 30) * 90;
                  const outer = polarToCartesian(100, 100, 88, tickAngle);
                  const inner = polarToCartesian(100, 100, 80, tickAngle);
                  return (
                    <line
                      key={tick}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="white"
                      strokeWidth="2"
                    />
                  );
                })}
                
                {/* Needle with shadow */}
                {avgDeviationPercent !== null && (
                  <g transform={`rotate(${angle}, 100, 100)`}>
                    {/* Needle shadow */}
                    <line
                      x1="102"
                      y1="102"
                      x2="102"
                      y2="28"
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {/* Needle */}
                    <line
                      x1="100"
                      y1="100"
                      x2="100"
                      y2="25"
                      stroke={color}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {/* Center dot */}
                    <circle cx="100" cy="100" r="8" fill={color} />
                    <circle cx="100" cy="100" r="5" fill="white" />
                  </g>
                )}
                
                {/* Labels on gauge */}
                <text
                  x="25"
                  y="110"
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-300 text-[10px] font-medium"
                >
                  -30%
                </text>
                <text
                  x="100"
                  y="115"
                  textAnchor="middle"
                  className="fill-slate-900 dark:fill-white text-xs font-bold"
                >
                  0%
                </text>
                <text
                  x="175"
                  y="110"
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-300 text-[10px] font-medium"
                >
                  +30%
                </text>
              </svg>
            </div>
            
            {/* Value display - smaller and with more spacing */}
            <div className="text-center mt-2">
              <div 
                className="text-2xl font-bold tabular-nums tracking-tight"
                style={{ color }}
              >
                {avgDeviationPercent !== null 
                  ? `${avgDeviationPercent > 0 ? '+' : ''}${avgDeviationPercent.toFixed(1)}%`
                  : '-'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetDeviationGauge;
