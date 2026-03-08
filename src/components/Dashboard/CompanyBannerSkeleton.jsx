import PropTypes from 'prop-types';
import './CompanyBannerSkeleton.css';

/**
 * CompanyBannerSkeleton - Loading placeholder for CompanyBanner.
 *
 * Renders a shimmer skeleton that matches the shape and layout
 * of the CompanyBanner component (name, ticker badge, price).
 *
 * Uses CSS-only @keyframes shimmer animation.
 * Accessible with aria-busy and role="status".
 */
export function CompanyBannerSkeleton({ className = '' }) {
  return (
    <div
      className={`company-banner-skeleton ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label="Loading company banner"
      data-testid="company-banner-skeleton"
    >
      <div className="company-banner-skeleton__identity">
        <div className="company-banner-skeleton__bone company-banner-skeleton__bone--name" />
        <div className="company-banner-skeleton__bone company-banner-skeleton__bone--ticker" />
      </div>
      <div className="company-banner-skeleton__bone company-banner-skeleton__bone--price" />
      <span className="sr-only">Loading company banner...</span>
    </div>
  );
}

CompanyBannerSkeleton.propTypes = {
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default CompanyBannerSkeleton;
