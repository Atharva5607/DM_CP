import { LuLoader, LuServerCrash, LuTriangleAlert, LuFlaskConical, LuRefreshCw } from 'react-icons/lu';

export function Spinner({ label = 'Working' }) {
  return (
    <span className="nx-spinner" role="status"><LuLoader className="nx-spin" /> {label}</span>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div role="alert" className="nx-alert">
      <LuTriangleAlert />
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss error">Dismiss</button>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="nx-empty">
      {Icon && <span className="nx-empty-icon"><Icon /></span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function OfflineState({ onRetry, onDemo, message }) {
  return (
    <div className="nx-offline">
      <div className="nx-card">
        <EmptyState icon={LuServerCrash} title="The analysis engine is not running"
          action={(
            <div className="nx-row">
              <button className="nx-btn primary" onClick={onRetry}><LuRefreshCw /> Try again</button>
              {onDemo && <button className="nx-btn" onClick={onDemo}><LuFlaskConical /> Explore the demo snapshot</button>}
            </div>
          )}>
          {message || 'Start the backend with "python run.py" inside the backend folder. It listens on port 8000.'} The demo snapshot replays the four built-in scenarios without a server.
        </EmptyState>
      </div>
    </div>
  );
}

export function PageLoader() {
  return <div className="nx-loader"><Spinner label="Loading infrastructure model" /></div>;
}

export function DemoBanner({ onRetry }) {
  return (
    <div className="nx-demo-banner" role="status">
      <LuFlaskConical />
      <span><b>Demo snapshot.</b> You are viewing the four built-in scenarios without the backend. Custom events and editing are disabled.</span>
      <button onClick={onRetry}>Connect to backend</button>
    </div>
  );
}
