import type { ReactNode } from "react";
import { BackgroundPattern, BorderBeam } from "@appica/ui-react";

interface SpaceBeamFrameProps {
  children: ReactNode;
  className?: string;
}

export const SpaceBackdrop = () => (
  <BackgroundPattern
    aria-hidden="true"
    className="tf-space-backdrop"
    variant="dots"
    cellSize={18}
  />
);

export const SpaceBeamFrame = ({ children, className }: SpaceBeamFrameProps) => (
  <BorderBeam
    className={className}
    color="var(--tf-space-red)"
    length={24}
    thickness={1.5}
    speed={5.5}
    showOnTouch
    pressScale
  >
    {children}
  </BorderBeam>
);
