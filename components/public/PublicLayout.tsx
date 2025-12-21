import React from "react";
import { ConstructionBackground } from "../ConstructionBackground";

export const PublicLayout: React.FC<{
  children: React.ReactNode;
  contentClassName?: string;
}> = ({ children, contentClassName }) => {
  return (
    <div className="h-screen w-full bg-gray-900 relative flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <ConstructionBackground />
      </div>
      <div className={`relative z-10 flex-1 flex flex-col overflow-y-auto ${contentClassName || ""}`}>
        {children}
      </div>
    </div>
  );
};
