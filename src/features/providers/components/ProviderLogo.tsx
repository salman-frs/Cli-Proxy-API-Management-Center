import { PROVIDER_LOGOS } from '../brandLogos';
import type { ProviderBrand } from '../types';
import styles from './ProviderLogo.module.scss';

interface ProviderLogoProps {
  brand: ProviderBrand;
  size?: number;
  className?: string;
}

export function ProviderLogo({ brand, size = 16, className }: ProviderLogoProps) {
  const logo = PROVIDER_LOGOS[brand];
  if (!logo) return null;

  const surfaceClass = logo.themeSurface ? styles.themeSurface : '';
  const lightClassName = [
    styles.logo,
    surfaceClass,
    logo.darkSrc ? styles.lightOnly : '',
    logo.invertOnDark ? styles.invertOnDark : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const darkClassName = [styles.logo, surfaceClass, styles.darkOnly, className]
    .filter(Boolean)
    .join(' ');
  const sizeStyle = { width: size, height: size };

  return (
    <>
      <img src={logo.src} alt="" aria-hidden="true" className={lightClassName} style={sizeStyle} />
      {logo.darkSrc ? (
        <img
          src={logo.darkSrc}
          alt=""
          aria-hidden="true"
          className={darkClassName}
          style={sizeStyle}
        />
      ) : null}
    </>
  );
}
