import React from "react";

export const PublicLayout: React.FC<{
  children: React.ReactNode;
  contentClassName?: string;
}> = ({ children, contentClassName }) => {
  return (
    <div className="h-screen w-full bg-gray-900 relative flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255, 138, 51, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 138, 51, 0.04) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(255, 138, 51, 0.12) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255, 138, 51, 0.08) 0%, transparent 45%)",
          }}
        />
      </div>
      <div className={`relative z-10 flex-1 flex flex-col overflow-y-auto ${contentClassName || ""}`}>
        {children}
      </div>
    </div>
  );
};
