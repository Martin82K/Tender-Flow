import type { CSSProperties, ReactNode } from "react";
import { brand } from "./brand";

const toneStyles: Record<string, { bg: string; color: string; border: string; header: string }> = {
  open: { bg: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)", header: "rgba(59, 130, 246, 0.12)" },
  negotiating: { bg: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.3)", header: "rgba(245, 158, 11, 0.12)" },
  closed: { bg: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "rgba(16, 185, 129, 0.3)", header: "rgba(16, 185, 129, 0.12)" },
  slate: { bg: "rgba(2, 6, 23, 0.72)", color: brand.text2, border: "rgba(51, 65, 85, 0.4)", header: "rgba(30, 41, 59, 0.7)" },
  blue: { bg: "rgba(37, 99, 235, 0.16)", color: brand.blue, border: "rgba(37, 99, 235, 0.32)", header: "rgba(30, 58, 138, 0.55)" },
  amber: { bg: "rgba(217, 119, 6, 0.16)", color: brand.amber, border: "rgba(217, 119, 6, 0.32)", header: "rgba(120, 53, 15, 0.55)" },
  green: { bg: "rgba(16, 185, 129, 0.14)", color: brand.green, border: "rgba(16, 185, 129, 0.32)", header: "rgba(6, 78, 59, 0.6)" },
  red: { bg: "rgba(244, 63, 94, 0.16)", color: brand.rose, border: "rgba(244, 63, 94, 0.32)", header: "rgba(127, 29, 29, 0.55)" },
};

const Glyph: React.FC<{ d: string; size?: number; color?: string }> = ({ d, size = 14, color = brand.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export const Pill: React.FC<{ label: string; tone?: string; style?: CSSProperties }> = ({
  label,
  tone = "open",
  style,
}) => {
  const colors = toneStyles[tone] ?? toneStyles.open;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 8px",
        borderRadius: 8,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        ...style,
      }}
    >
      {label}
    </span>
  );
};

export const FilterBar: React.FC<{ active: string; extra?: ReactNode }> = ({ active, extra }) => {
  const filters = [
    { id: "all", label: "Všechny (5)" },
    { id: "open", label: "Poptávané (4)" },
    { id: "closed", label: "Ukončené (0)" },
    { id: "sod", label: "Zasmluvněné (1)" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 3,
          borderRadius: 12,
          background: "rgba(15, 23, 42, 0.9)",
          border: `1px solid ${brand.line2}`,
        }}
      >
        {filters.map((filter) => {
          const on = filter.id === active;
          return (
            <div
              key={filter.id}
              style={{
                padding: "6px 9px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                color: on ? brand.inkOnPrimary : brand.muted,
                background: on ? brand.primary : "transparent",
              }}
            >
              {filter.label}
            </div>
          );
        })}
      </div>
      <div style={{ marginLeft: "auto" }}>{extra}</div>
    </div>
  );
};

export const CategoryCard: React.FC<{
  title: string;
  status: string;
  tone: string;
  asked: string;
  offers: string;
  description: string;
  deadline: string;
  realization?: string;
  priceLabel: string;
  price: string;
  contracts?: string;
  style?: CSSProperties;
}> = ({ title, status, tone, asked, offers, description, deadline, realization, priceLabel, price, contracts, style }) => (
  <div
    style={{
      background: "rgba(17, 24, 39, 0.88)",
      border: "1px solid rgba(51, 65, 85, 0.4)",
      borderRadius: 16,
      padding: "12px 12px 10px",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      justifyContent: "space-between",
      ...style,
    }}
  >
    <div>
      <Pill label={status} tone={tone} />
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, color: brand.apricot, fontSize: 11 }}>
        <Glyph d="M7 4h10v16H7zM7 8h10" size={12} color={brand.apricot} />
        <span>Termín nabídky: {deadline}</span>
      </div>
      {realization ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, color: brand.violet, fontSize: 11 }}>
          <Glyph d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" size={12} color={brand.violet} />
          <span>Realizace: {realization}</span>
        </div>
      ) : null}
      <div style={{ marginTop: 6, color: brand.muted, fontSize: 12, lineHeight: 1.3 }}>{description}</div>
    </div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 10,
        paddingTop: 8,
        borderTop: "1px solid rgba(51, 65, 85, 0.5)",
      }}
    >
      <div>
        <div style={{ fontSize: 10, color: brand.muted }}>{priceLabel}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{price}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: brand.muted }}>Poptáno</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{asked}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: brand.muted }}>CN</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{offers}</div>
      </div>
      {contracts ? (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: brand.muted }}>Smlouvy</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: brand.green }}>{contracts}</div>
        </div>
      ) : null}
    </div>
  </div>
);

export const CreateSectionCard: React.FC = () => (
  <div
    style={{
      border: "1px dashed rgba(100, 116, 139, 0.55)",
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: brand.muted,
      gap: 6,
      minHeight: 0,
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 300 }}>+</div>
    <div style={{ fontSize: 13, fontWeight: 700 }}>Vytvořit novou sekci</div>
  </div>
);

export const KanbanColumn: React.FC<{
  title: string;
  count: number;
  tone: string;
  children: ReactNode;
  style?: CSSProperties;
}> = ({ title, count, tone, children, style }) => {
  const colors = toneStyles[tone] ?? toneStyles.slate;
  return (
    <div
      style={{
        flex: "1 0 0",
        minWidth: 220,
        height: "100%",
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.header,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</div>
        <div
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 99,
            background: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: brand.text2,
          }}
        >
          {count}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
};

export const BidCardUi: React.FC<{
  company: string;
  person: string;
  email: string;
  phone?: string;
  price?: string;
  rounds?: ReadonlyArray<{ label: string; price: string }>;
  selectedRound?: number;
  winner?: boolean;
  compact?: boolean;
  inquiry?: boolean;
  style?: CSSProperties;
}> = ({ company, person, email, phone, price, rounds, selectedRound, winner, compact, inquiry, style }) => (
  <div
    style={{
      background: "rgba(17, 24, 39, 0.92)",
      border: winner ? "1px solid rgba(52, 211, 153, 0.45)" : "1px solid rgba(51, 65, 85, 0.4)",
      boxShadow: winner ? "0 0 0 1px rgba(250, 204, 21, 0.35)" : "0 8px 18px rgba(0,0,0,0.22)",
      borderRadius: 12,
      padding: compact ? "10px 11px" : "12px 13px",
      position: "relative",
      ...style,
    }}
  >
    {winner ? (
      <div
        style={{
          position: "absolute",
          top: -10,
          right: -8,
          width: 24,
          height: 24,
          borderRadius: 99,
          background: "#facc15",
          color: "#422006",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        ★
      </div>
    ) : null}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
      <div style={{ fontSize: compact ? 14 : 16, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{company}</div>
      {price ? (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.2)",
            color: brand.green,
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 8,
            padding: "3px 7px",
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {price}
        </div>
      ) : null}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: brand.muted, fontSize: 12 }}>
      <Glyph d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 19c.8-3 3.4-5 7-5s6.2 2 7 5" />
      {person}
    </div>
    {phone ? (
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: brand.muted, fontSize: 11, marginTop: 3 }}>
        <Glyph d="M6 4h4l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v4c-8 1-16-7-14-14z" />
        {phone}
      </div>
    ) : null}
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: brand.muted, fontSize: 11, marginTop: 3 }}>
      <Glyph d="M4 6h16v12H4zM4 6l8 7 8-7" />
      {email}
    </div>
    {rounds ? (
      <div style={{ marginTop: 8, borderTop: "1px solid rgba(51, 65, 85, 0.5)", paddingTop: 6 }}>
        {rounds.map((round, index) => {
          const selected = index === selectedRound;
          return (
            <div
              key={round.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                padding: "2px 0",
                color: selected ? brand.green : brand.muted,
                fontWeight: selected ? 700 : 450,
              }}
            >
              <span>{round.label}:</span>
              <span>{round.price}</span>
            </div>
          );
        })}
      </div>
    ) : null}
    {inquiry ? (
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "linear-gradient(90deg, #059669, #10b981)",
          color: "#ecfdf5",
          borderRadius: 8,
          padding: "7px 8px",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        Generovat poptávku
      </div>
    ) : null}
  </div>
);

export const RoundChips: React.FC<{ active: number }> = ({ active }) => {
  const chips = ["Soutěž", "1. kolo", "2. kolo"];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 10, flexShrink: 0 }}>
      {chips.map((chip, index) => {
        const on = index === active;
        return (
          <div
            key={chip}
            style={{
              padding: "6px 11px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: on ? brand.primarySoft : brand.card,
              color: on ? brand.primary : brand.muted,
              border: on ? `1px solid ${brand.primary}` : `1px solid ${brand.line2}`,
            }}
          >
            {chip}
          </div>
        );
      })}
    </div>
  );
};

export const DetailToolbar: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px 4px",
      flexShrink: 0,
      overflow: "hidden",
    }}
  >
    <div style={{ color: brand.muted, fontSize: 12, fontWeight: 600, marginRight: "auto" }}>← Zpět na přehled</div>
    <div
      style={{
        background: brand.primary,
        color: brand.inkOnPrimary,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      + Přidat dodavatele
    </div>
    <div
      style={{
        background: brand.violetSoft,
        color: brand.violet,
        borderRadius: 8,
        padding: "6px 8px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      Otevřít složku
    </div>
    <div
      style={{
        background: "rgba(30, 41, 59, 0.9)",
        color: brand.text2,
        borderRadius: 8,
        padding: "6px 8px",
        fontSize: 11,
        fontWeight: 700,
        border: `1px solid ${brand.line2}`,
      }}
    >
      Export
    </div>
    <div
      style={{
        background: "rgba(234, 88, 12, 0.16)",
        color: brand.apricotSoft,
        borderRadius: 8,
        padding: "6px 8px",
        fontSize: 11,
        fontWeight: 700,
        border: "1px solid rgba(251, 146, 60, 0.35)",
      }}
    >
      Email nevybraným
    </div>
  </div>
);

export const OverviewKpis: React.FC<{
  budget: string;
  planned: string;
  contracted: string;
  progress: string;
}> = ({ budget, planned, contracted, progress }) => {
  const items = [
    { label: "Rozpočet (investor)", value: budget, color: brand.text },
    { label: "Plánovaný náklad", value: planned, color: brand.text },
    { label: "Zasmluvněno", value: contracted, color: brand.green },
    { label: "Postup zadávání", value: progress, color: brand.amber },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flexShrink: 0 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: "rgba(17, 24, 39, 0.88)",
            border: "1px solid rgba(51, 65, 85, 0.4)",
            borderRadius: 14,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 10, color: brand.muted, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {item.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
};

export const DemandTable: React.FC<{
  rows: ReadonlyArray<{ status: string; tone: string; title: string; sod: string; bids: string; winner?: string }>;
}> = ({ rows }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      marginTop: 10,
      background: "rgba(17, 24, 39, 0.88)",
      border: "1px solid rgba(51, 65, 85, 0.4)",
      borderRadius: 16,
      padding: 12,
      overflow: "hidden",
    }}
  >
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Přehled poptávek</div>
    {rows.map((row) => (
      <div
        key={row.title}
        style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr 120px 70px",
          gap: 8,
          alignItems: "center",
          padding: "8px 0",
          borderTop: "1px solid rgba(51, 65, 85, 0.45)",
          fontSize: 12,
        }}
      >
        <Pill label={row.status} tone={row.tone} />
        <div style={{ fontWeight: 700 }}>{row.title}</div>
        <div style={{ textAlign: "right", fontWeight: 700 }}>{row.sod}</div>
        <div style={{ textAlign: "right", color: brand.muted }}>{row.bids}</div>
      </div>
    ))}
  </div>
);
