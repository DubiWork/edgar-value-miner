import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';

/**
 * AuthGuard protects content that requires authentication.
 *
 * - Renders `children` when the user is authenticated.
 * - Renders `fallback` (default: null) when the user is not authenticated.
 * - Renders `loadingFallback` (default: null) while auth state is initializing.
 *
 * Note: The A4 sprint will replace the redirect fallback with a proper login
 * route redirect once React Router is added to the project.
 *
 * @example
 * // Basic usage — hide content from unauthenticated users
 * <AuthGuard>
 *   <DebatePanel />
 * </AuthGuard>
 *
 * @example
 * // With custom fallbacks
 * <AuthGuard fallback={<LoginPrompt />} loadingFallback={<Spinner />}>
 *   <UserDashboard />
 * </AuthGuard>
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children - Content to render when authenticated
 * @param {import('react').ReactNode} [props.fallback] - Content to render when not authenticated
 * @param {import('react').ReactNode} [props.loadingFallback] - Content to render during loading
 * @returns {import('react').ReactNode}
 */
export function AuthGuard({ children, fallback = null, loadingFallback = null }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return loadingFallback;
  }

  if (!isAuthenticated) {
    return fallback;
  }

  return children;
}

AuthGuard.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
  loadingFallback: PropTypes.node,
};

export default AuthGuard;
