interface LogoProps {
  className?: string;
  title?: string;
}

/**
 * Logo Free QR Code : trois carrés de positionnement + quatrième coin
 * « en construction » (dynamique, modifiable). Les découpes blanches
 * supposent un fond clair (headers) ; voir public/logo.svg pour le favicon.
 */
export function Logo({ className = 'h-8 w-8', title }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <rect x="3" y="3" width="11" height="11" rx="2.5" fill="currentColor" />
      <rect x="6.5" y="6.5" width="4" height="4" rx="1" fill="white" />
      <rect x="18" y="3" width="11" height="11" rx="2.5" fill="currentColor" />
      <rect x="21.5" y="6.5" width="4" height="4" rx="1" fill="white" />
      <rect x="3" y="18" width="11" height="11" rx="2.5" fill="currentColor" />
      <rect x="6.5" y="21.5" width="4" height="4" rx="1" fill="white" />
      <rect x="18" y="18" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="24" y="18" width="5" height="4" rx="1" fill="currentColor" opacity=".45" />
      <rect x="18" y="24" width="5" height="5" rx="1" fill="currentColor" opacity=".45" />
      <rect x="25" y="25" width="4" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}
