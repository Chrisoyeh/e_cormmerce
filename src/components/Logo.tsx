import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = true }) => {
  const dimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`} id="nazareth-logo-wrapper">
      <img 
        id="bento-logo-icon"
        src="/logo.png"
        alt="Nazareth School Festac Logo"
        className={`${dimensions[size]} object-contain select-none shrink-0`}
      />

      {showText && (
        <div className="flex flex-col text-left" id="nazareth-logo-text">
          <span className="font-sans font-extrabold text-base md:text-lg tracking-tight text-[#065f46] dark:text-emerald-400 leading-none font-sans">
            Nazareth School Festac
          </span>
          <span className="font-sans font-bold text-[9px] text-[#065f46] dark:text-emerald-400 tracking-widest leading-none mt-1 uppercase">
            Institutional Portal
          </span>
        </div>
      )}
    </div>
  );
};

