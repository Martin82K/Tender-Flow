import type { CSSProperties, ReactNode } from "react";
import { brand } from "./brand";

const toneStyles: Record<string, { bg: string; color: string; border: string; header: string }> = {
  open: { bg: "rgba(167, 198, 240, 0.16)", color: brand.blue, border: "rgba(167, 198, 240, 0.35)", header: "rgba(167, 198, 240, 0.10)" },
  negotiating: { bg: "rgba(231, 190, 121, 0.16)", color: brand.amber, border: "rgba(231, 190, 121, 0.35)", header: "rgba(231, 190, 121, 0.10)" },
  closed: { bg: "rgba(144, 204, 165, 0.16)", color: brand.green, border: "rgba(144, 204, 165, 0.35)", header: "rgba(144, 204, 165, 0.10)" },
  slate: { bg: "rgba(22, 21, 19, 0.55)", color: brand.text2, border: "rgba(72, 65, 57, 0.85)", header: "rgba(46, 43, 39, 0.85)" },
  blue: { bg: "rgba(167, 198, 240, 0.08)", color: brand.blue, border: "rgba(167, 198, 240, 0.28)", header: "rgba(167, 198, 240, 0.12)" },
  amber: { bg: "rgba(231, 190, 121, 0.08)", color: brand.amber, border: "rgba(231, 190, 121, 0.28)", header: "rgba(231, 190, 121, 0.12)" },
  green: { bg: "rgba(144, 204, 165, 0.08)", color: brand.green, border: "rgba(144, 204, 165, 0.28)", header: "rgba(144, 204, 165, 0.12)" },
  red: { bg: "rgba(255, 154, 171, 0.08)", color: brand.rose, border: "rgba(255, 154, 171, 0.28)", header: "rgba(255, 154, 171, 0.12)" },
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
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 9px",
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

export const FilterBar: React.FC<{ active: string }> = ({ active }) => {
  const filters = [
    { id: "all", label: "Všechny (4)" },
    { id: "open", label: "Poptávané (2)" },
    { id: "closed", label: "Ukončené (1)" },
    { id: "sod", label: "Zasmluvněné (1)" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        border: `1px solid ${brand.line}`,
        borderRadius: 8,
        background: "rgba(46, 43, 39, 0.76)",
        marginBottom: 10,
        flexShrink: 0,
      }}
    >
      {filters.map((filter) => {
        const on = filter.id === active;
        return (
          <div
            key={filter.id}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: on ? brand.apricotSoft : brand.muted,
              background: on ? "rgba(234, 160, 121, 0.13)" : "transparent",
              border: on ? `1px solid rgba(234, 160, 121, 0.45)` : "1px solid transparent",
              boxShadow: on ? `inset 0 -2px 0 ${brand.apricot}` : "none",
            }}
          >
            {filter.label}
          </div>
        );
      })}
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
  priceLabel: string;
  price: string;
  contracts?: string;
  style?: CSSProperties;
}> = ({ title, status, tone, asked, offers, description, deadline, priceLabel, price, contracts, style }) => (
  <div
    style={{
      background: brand.card,
      border: `1px solid ${brand.line}`,
      borderRadius: 16,
      padding: "14px 14px 12px",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      ...style,
    }}
  >
    <Pill label={status} tone={tone} />
    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, letterSpacing: "-0.03em" }}>{title}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: brand.accent, fontSize: 13 }}>
      <Glyph d="M7 4h10v16H7zM7 8h10" size={13} color={brand.accent} />
      <span>Termín nabídky: {deadline}</span>
    </div>
    <div style={{ marginTop: 6, color: brand.muted, fontSize: 14, lineHeight: 1.3, flex: 1 }}>{description}</div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px solid ${brand.line}`,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: brand.muted }}>{priceLabel}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{price}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: brand.muted }}>Poptáno</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{asked}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: brand.muted }}>CN</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{offers}</div>
      </div>
      {contracts ? (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: brand.muted }}>Smlouvy</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: brand.green }}>{contracts}</div>
        </div>
      ) : null}
    </div>
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
        minWidth: 250,
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
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</div>
        <div
          style={{
            minWidth: 24,
            height: 22,
            padding: "0 7px",
            borderRadius: 99,
            background: "rgba(0,0,0,0.28)",
            border: `1px solid ${brand.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
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
      background: brand.card,
      border: winner ? `1px solid ${brand.accent}` : `1px solid ${brand.line}`,
      boxShadow: winner ? `0 0 0 1px ${brand.accent}` : "0 8px 18px rgba(0,0,0,0.18)",
      borderRadius: 12,
      padding: compact ? "10px 12px" : "12px 14px",
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
          width: 26,
          height: 26,
          borderRadius: 99,
          background: "#facc15",
          color: "#422006",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        ★
      </div>
    ) : null}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
      <div style={{ fontSize: compact ? 16 : 18, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{company}</div>
      {price ? (
        <div
          style={{
            background: "rgba(144, 204, 165, 0.18)",
            color: brand.green,
            border: "1px solid rgba(144, 204, 165, 0.32)",
            borderRadius: 8,
            padding: "3px 7px",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {price}
        </div>
      ) : null}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: brand.muted, fontSize: 13 }}>
      <Glyph d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 19c.8-3 3.4-5 7-5s6.2 2 7 5" />
      {person}
    </div>
    {phone && !compact ? (
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: brand.muted, fontSize: 12, marginTop: 3 }}>
        <Glyph d="M6 4h4l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v4c-8 1-16-7-14-14z" />
        {phone}
      </div>
    ) : null}
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: brand.muted, fontSize: 12, marginTop: 3 }}>
      <Glyph d="M4 6h16v12H4zM4 6l8 7 8-7" />
      {email}
    </div>
    {rounds ? (
      <div style={{ marginTop: 8, borderTop: `1px solid ${brand.line}`, paddingTop: 6 }}>
        {rounds.map((round, index) => {
          const selected = index === selectedRound;
          return (
            <div
              key={round.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
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
          fontSize: 12,
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
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              background: on ? "rgba(255, 138, 51, 0.14)" : brand.card,
              color: on ? brand.accentHi : brand.muted,
              border: on ? `1px solid ${brand.accent}` : `1px solid ${brand.line}`,
            }}
          >
            {chip}
          </div>
        );
      })}
    </div>
  );
};

export const DetailToolbar: React.FC<{ category: string; addLabel?: string }> = ({
  category,
  addLabel = "Přidat dodavatele",
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderBottom: `1px solid ${brand.line}`,
      background: brand.surface,
      flexShrink: 0,
    }}
  >
    <div style={{ color: brand.muted, fontSize: 13, fontWeight: 600, marginRight: "auto" }}>← Zpět na přehled</div>
    <div style={{ color: brand.text2, fontSize: 13, fontWeight: 700 }}>{category}</div>
    <div
      style={{
        background: brand.accentMid,
        color: brand.inkOnAccent,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      + {addLabel}
    </div>
  </div>
);

export const ContractRow: React.FC<{
  title: string;
  vendor?: string;
  number: string;
  status: string;
  amount?: string;
  billed: number;
  active?: boolean;
  style?: CSSProperties;
}> = ({ title, vendor, number, status, amount, billed, active, style }) => (
  <div
    style={{
      background: active ? "rgba(255, 138, 51, 0.10)" : brand.card,
      border: `1px solid ${brand.line}`,
      borderLeft: `3px solid ${active ? brand.accent : brand.line}`,
      borderRadius: 12,
      padding: 14,
      ...style,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontSize: 13, color: brand.muted, marginTop: 3 }}>{number}</div>
      </div>
      <Pill label={status} tone={status === "Aktivní" ? "closed" : "open"} />
    </div>
    <div style={{ marginTop: 6, color: brand.text2, fontSize: 14 }}>{vendor}</div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 14 }}>
      <span style={{ fontWeight: 800 }}>{amount}</span>
      <span style={{ color: brand.muted }}>Vyfakturováno {billed} %</span>
    </div>
    <div style={{ marginTop: 8, height: 4, borderRadius: 99, background: brand.line, overflow: "hidden" }}>
      <div
        style={{
          width: `${billed}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${brand.amber}, ${brand.green})`,
        }}
      />
    </div>
  </div>
);
