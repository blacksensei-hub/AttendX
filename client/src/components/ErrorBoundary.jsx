import { Component }     from 'react';
import { motion }        from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * ════════════════════════════════════════════════════════════════════
 * ErrorBoundary (WEB) — global catch-all for uncaught render errors.
 *
 * Why a class component:
 *   React's error boundary API is only available on class components
 *   via componentDidCatch / getDerivedStateFromError. There's no
 *   hook equivalent. Everything else in the codebase is functional;
 *   this is the one exception.
 *
 * What it catches:
 *   • Render-time errors anywhere below it in the React tree
 *   • Errors in lifecycle methods of any descendant
 *   • Errors in constructors of any descendant
 *
 * What it does NOT catch (handled elsewhere):
 *   • Errors inside event handlers       → toast.error
 *   • Errors in async code outside React → react-query onError, try/catch
 *   • Server-rendering errors            → we don't SSR
 *
 * Recovery options:
 *   • Reload  — full page reload, clears all state.
 *   • Go home — hard navigate to /, useful if a specific page broke
 *               but the rest of the app is fine. We use window.location
 *               rather than react-router's navigate() because the
 *               router itself may be in the broken state.
 *
 * Stack traces are logged to the console but NOT shown to the user —
 * noise to non-developers and a leak risk in production.
 * ════════════════════════════════════════════════════════════════════
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight:       '100vh',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         'var(--space-4)',
        background:      'var(--bg)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.3 }}
          style={{
            width:         '100%',
            maxWidth:      '480px',
            background:    'var(--bg-card)',
            border:        '1px solid var(--border)',
            borderRadius:  'var(--radius-molecular)',
            padding:       'var(--space-5)',
            boxShadow:     'var(--shadow-lg)',
            textAlign:     'center',
          }}
        >
          {/* Icon tile — same pattern as page-level empty states */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              width:           '64px',
              height:          '64px',
              borderRadius:    'var(--radius-molecular)',
              background:      'var(--red-bg)',
              border:          '1px solid var(--red-border)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              margin:          '0 auto var(--space-3)',
            }}
          >
            <AlertTriangle size={28} style={{ color: 'var(--red)' }} />
          </motion.div>

          <h1 style={{
            color:         'var(--text-primary)',
            fontFamily:    'var(--font-display)',
            fontWeight:    700,
            fontSize:      'var(--text-xl)',
            marginBottom:  '6px',
            letterSpacing: '-0.01em',
          }}>
            Something went wrong
          </h1>

          <p style={{
            color:        'var(--text-muted)',
            fontSize:     'var(--text-sm)',
            lineHeight:   1.5,
            marginBottom: 'var(--space-4)',
            maxWidth:     '380px',
            margin:       '0 auto var(--space-4)',
          }}>
            AttendX hit an unexpected error. Reloading the page usually fixes it.
            If this keeps happening, please let your administrator know.
          </p>

          {/* Show the error message in a code block — helpful for users
              to paste when reporting, not too scary because it's clearly
              a technical detail in mono font */}
          {this.state.error?.message && (
            <div style={{
              background:    'var(--bg-raised)',
              border:        '1px solid var(--border)',
              borderRadius:  'var(--radius-atomic)',
              padding:       'var(--space-2)',
              marginBottom:  'var(--space-4)',
              textAlign:     'left',
            }}>
              <p style={{
                color:         'var(--text-muted)',
                fontSize:      '10px',
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom:  '4px',
              }}>
                Error detail
              </p>
              <p style={{
                color:      'var(--text-secondary)',
                fontSize:   'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                wordBreak:  'break-word',
              }}>
                {this.state.error.message}
              </p>
            </div>
          )}

          <div style={{
            display:         'flex',
            gap:             'var(--space-2)',
            justifyContent:  'center',
            flexWrap:        'wrap',
          }}>
            <button
              onClick={this.handleReload}
              className="btn-primary"
            >
              <RefreshCw size={15} />
              Reload page
            </button>
            <button
              onClick={this.handleGoHome}
              className="btn-ghost"
            >
              <Home size={15} />
              Go home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }
}