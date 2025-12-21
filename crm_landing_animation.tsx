import React, { useEffect, useState } from 'react';
import logo from './assets/logo.png';

export default function ConstructionAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{
      zIndex: 0
    }}>

      {/* Grid background */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(255, 138, 51, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 138, 51, 0.03) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite'
      }} />

      <style>{`
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 50px 50px; }
        }
        @keyframes floatUp {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          50% { opacity: 0.3; }
          100% { transform: translateY(-100vh) scale(1); opacity: 0; }
        }
        @keyframes floatSway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(10deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes helmetFloat {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -20px); }
        }
        @keyframes craneSwing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(20deg); }
        }
        @keyframes lightFlicker {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[0, 2, 4, 6, 8].map((delay, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: [80, 60, 100, 50, 70][i] + 'px',
              height: [80, 60, 100, 50, 70][i] + 'px',
              left: [10, 70, 40, 80, 20][i] + '%',
              background: 'rgba(255, 138, 51, 0.3)',
              animation: `floatUp 15s infinite`,
              animationDelay: `${delay}s`
            }}
          />
        ))}
      </div>

      {/* Helmet logo */}
      <div
        className="absolute left-1/2"
        style={{
          top: '80px',
          animation: 'helmetFloat 6s ease-in-out infinite'
        }}
      >
        <div className="relative" style={{ width: '100px', height: '100px', opacity: 0.15 }}>
          <div style={{
            width: '80px',
            height: '60px',
            background: 'rgba(255, 138, 51, 0.5)',
            borderRadius: '40px 40px 10px 10px',
            position: 'absolute',
            bottom: 0,
            left: '10px',
            border: '3px solid rgba(255, 138, 51, 0.7)'
          }} />
          <div style={{
            width: '70px',
            height: '8px',
            background: 'rgba(255, 138, 51, 0.8)',
            position: 'absolute',
            bottom: '20px',
            left: '15px',
            borderRadius: '4px'
          }} />
        </div>
      </div>

      {/* Floating logos */}
      {[[15, 12, 0, 75], [55, 'auto', 2, 60], [35, 8, 4, 68], [70, 25, 1, 52], [25, 'auto', 3, 82]].map((pos, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: pos[0] + '%',
            left: typeof pos[1] === 'number' ? pos[1] + '%' : 'auto',
            right: typeof pos[1] === 'string' ? (i === 1 ? '12%' : '20%') : 'auto',
            width: pos[3] + 'px',
            height: pos[3] + 'px',
            animation: 'floatSway 8s ease-in-out infinite',
            animationDelay: `${pos[2]}s`,
            opacity: 0.15
          }}
        >
          <img
            src={logo}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 10px rgba(255, 138, 51, 0.5))'
            }}
          />
        </div>
      ))}

      {/* Progress badges */}
      <div
        className="absolute"
        style={{
          top: '30%',
          left: '20%',
          padding: '8px 16px',
          background: 'rgba(255, 138, 51, 0.2)',
          border: '2px solid rgba(255, 138, 51, 0.5)',
          borderRadius: '20px',
          fontSize: '12px',
          color: 'rgba(255, 138, 51, 0.9)',
          fontWeight: 'bold',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      >
        📋 V procesu
      </div>

      <div
        className="absolute"
        style={{
          top: '50%',
          right: '25%',
          padding: '8px 16px',
          background: 'rgba(255, 138, 51, 0.2)',
          border: '2px solid rgba(255, 138, 51, 0.5)',
          borderRadius: '20px',
          fontSize: '12px',
          color: 'rgba(255, 138, 51, 0.9)',
          fontWeight: 'bold',
          animation: 'pulse 2s ease-in-out infinite',
          animationDelay: '1s'
        }}
      >
        ✓ Hotovo
      </div>

      <div
        className="absolute"
        style={{
          top: '20%',
          right: '15%',
          padding: '8px 16px',
          background: 'rgba(255, 138, 51, 0.2)',
          border: '2px solid rgba(255, 138, 51, 0.5)',
          borderRadius: '20px',
          fontSize: '12px',
          color: 'rgba(255, 138, 51, 0.9)',
          fontWeight: 'bold',
          animation: 'pulse 2s ease-in-out infinite',
          animationDelay: '0.5s'
        }}
      >
        🏗️ Výběrové řízení
      </div>

      <div
        className="absolute"
        style={{
          top: '40%',
          left: '10%',
          padding: '8px 16px',
          background: 'rgba(255, 138, 51, 0.2)',
          border: '2px solid rgba(255, 138, 51, 0.5)',
          borderRadius: '20px',
          fontSize: '12px',
          color: 'rgba(255, 138, 51, 0.9)',
          fontWeight: 'bold',
          animation: 'pulse 2s ease-in-out infinite',
          animationDelay: '1.5s'
        }}
      >
        📨 Poptávky
      </div>

      <div
        className="absolute"
        style={{
          top: '65%',
          left: '25%',
          padding: '8px 16px',
          background: 'rgba(255, 138, 51, 0.2)',
          border: '2px solid rgba(255, 138, 51, 0.5)',
          borderRadius: '20px',
          fontSize: '12px',
          color: 'rgba(255, 138, 51, 0.9)',
          fontWeight: 'bold',
          animation: 'pulse 2s ease-in-out infinite',
          animationDelay: '2s'
        }}
      >
        📝 Smlouvy
      </div>

      {/* Construction scene */}
      <div className="absolute bottom-0 left-1/2" style={{
        transform: 'translateX(-50%)',
        width: '800px',
        height: '400px',
        opacity: 0.1
      }}>

        {/* Buildings */}
        {[
          { left: 100, width: 120, height: 250, delay: 0.5 },
          { left: 250, width: 150, height: 300, delay: 1 },
          { left: 430, width: 130, height: 280, delay: 1.5 },
          { left: 590, width: 110, height: 230, delay: 2 }
        ].map((building, i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              left: building.left + 'px',
              width: building.width + 'px',
              height: mounted ? building.height + 'px' : '0px',
              background: 'linear-gradient(180deg, rgba(255, 138, 51, 0.2) 0%, rgba(255, 138, 51, 0.1) 100%)',
              border: '2px solid rgba(255, 138, 51, 0.3)',
              borderBottom: 'none',
              transition: 'height 3s ease-out, opacity 3s ease-out',
              transitionDelay: `${building.delay}s`,
              opacity: mounted ? 1 : 0
            }}
          >
            {/* Windows */}
            {[...Array(6)].map((_, j) => (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  width: '20px',
                  height: '25px',
                  background: 'rgba(255, 138, 51, 0.6)',
                  left: (j % 3) * 30 + 20 + 'px',
                  top: Math.floor(j / 3) * 40 + 30 + 'px',
                  animation: 'lightFlicker 3s infinite',
                  animationDelay: `${j * 0.5}s`
                }}
              />
            ))}
          </div>
        ))}

        {/* Crane */}
        <div
          className="absolute bottom-0"
          style={{
            right: '150px',
            width: '8px',
            height: mounted ? '350px' : '0px',
            background: 'rgba(255, 138, 51, 0.4)',
            transition: 'height 2s ease-out, opacity 2s ease-out',
            transitionDelay: '0.5s',
            opacity: mounted ? 1 : 0
          }}
        >
          <div style={{
            position: 'absolute',
            top: '20px',
            left: 0,
            width: '200px',
            height: '6px',
            background: 'rgba(255, 138, 51, 0.5)',
            transformOrigin: 'left center',
            animation: 'craneSwing 4s ease-in-out infinite',
            animationDelay: '2.5s'
          }} />
        </div>

      </div>

    </div>
  );
}