const SyncoLogo = ({ size = 32, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="synco-primary" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4A75C4" />
        <stop offset="100%" stopColor="#1C325B" />
      </linearGradient>
    </defs>
    
    {/* Map Pin / Trust Badge Outer Shape */}
    <path 
      d="M32 4 C18.7 4 8 14.7 8 28 C8 45.5 32 60 32 60 C32 60 56 45.5 56 28 C56 14.7 45.3 4 32 4 Z" 
      fill="url(#synco-primary)"
    />
    
    {/* Stylized 'S' inner cutout */}
    <path 
      d="M38 22 C38 17, 26 17, 26 23 C26 29, 38 29, 38 35 C38 41, 26 41, 26 36" 
      stroke="#FFFFFF" 
      strokeWidth="4.5" 
      strokeLinecap="round" 
      fill="none"
    />
  </svg>
);

export default SyncoLogo;
