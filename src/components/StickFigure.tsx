import { cn } from "@/lib/utils";

interface StickFigureProps {
  pose?: "standing" | "walking" | "pointing" | "waving" | "holding-phone" | "celebrating";
  size?: number;
  className?: string;
  color?: string;
}

export const StickFigure = ({ 
  pose = "standing", 
  size = 80, 
  className,
  color = "hsl(var(--primary))"
}: StickFigureProps) => {
  const renderPose = () => {
    switch (pose) {
      case "standing":
        return (
          <g className="animate-bounce-subtle">
            {/* Head */}
            <circle cx="40" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
            {/* Body */}
            <line x1="40" y1="32" x2="40" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms */}
            <line x1="40" y1="38" x2="28" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="38" x2="52" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Legs */}
            <line x1="40" y1="55" x2="30" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="55" x2="50" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      
      case "walking":
        return (
          <g className="animate-walk">
            {/* Head */}
            <circle cx="40" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
            {/* Body */}
            <line x1="40" y1="32" x2="42" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms - moving */}
            <line x1="42" y1="38" x2="28" y2="52" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-swing-left" />
            <line x1="42" y1="38" x2="54" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-swing-right" />
            {/* Legs - walking */}
            <line x1="42" y1="55" x2="28" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-leg-left" />
            <line x1="42" y1="55" x2="54" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-leg-right" />
          </g>
        );
      
      case "pointing":
        return (
          <g>
            {/* Head */}
            <circle cx="40" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
            {/* Body */}
            <line x1="40" y1="32" x2="40" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms - one pointing */}
            <line x1="40" y1="38" x2="25" y2="45" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="38" x2="62" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
            {/* Legs */}
            <line x1="40" y1="55" x2="32" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="55" x2="48" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      
      case "waving":
        return (
          <g>
            {/* Head */}
            <circle cx="40" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
            {/* Body */}
            <line x1="40" y1="32" x2="40" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms - one waving */}
            <line x1="40" y1="38" x2="28" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="38" x2="58" y2="22" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-wave" />
            {/* Legs */}
            <line x1="40" y1="55" x2="32" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="55" x2="48" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      
      case "holding-phone":
        return (
          <g>
            {/* Head */}
            <circle cx="40" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
            {/* Body */}
            <line x1="40" y1="32" x2="40" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms - holding phone */}
            <line x1="40" y1="38" x2="32" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="38" x2="48" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Phone */}
            <rect x="32" y="38" width="16" height="24" rx="2" fill="none" stroke={color} strokeWidth="2" className="animate-pulse" />
            <line x1="36" y1="56" x2="44" y2="56" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            {/* Legs */}
            <line x1="40" y1="55" x2="32" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="55" x2="48" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      
      case "celebrating":
        return (
          <g className="animate-bounce">
            {/* Head */}
            <circle cx="40" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
            {/* Happy face */}
            <circle cx="35" cy="18" r="1.5" fill={color} />
            <circle cx="45" cy="18" r="1.5" fill={color} />
            <path d="M 32 23 Q 40 27 48 23" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            {/* Body */}
            <line x1="40" y1="32" x2="40" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms - celebrating up */}
            <line x1="40" y1="38" x2="22" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-celebrate-left" />
            <line x1="40" y1="38" x2="58" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" className="animate-celebrate-right" />
            {/* Legs */}
            <line x1="40" y1="55" x2="32" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="55" x2="48" y2="75" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={cn("transition-all duration-300", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {renderPose()}
    </svg>
  );
};
