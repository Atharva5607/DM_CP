import { NavLink, Link } from 'react-router-dom';
import { LuCommand } from 'react-icons/lu';
import { useNexus } from '../store/NexusContext';
import { usePalette } from '../store/PaletteContext';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/builder', label: 'Scenario builder' },
  { to: '/methodology', label: 'Methodology' },
  { to: '/developers', label: 'Developers' },
];

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 29 9.5 16 16 3 9.5Z" fill="#a78bfa" fillOpacity=".92" />
      <path d="M3 15.5 16 22 29 15.5" fill="none" stroke="#38d6ff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 21.5 16 28 29 21.5" fill="none" stroke="#ffd84d" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function NavBar() {
  const { boot, mode } = useNexus();
  const { open: onPalette } = usePalette();
  const tone = boot === 'ready' ? (mode === 'demo' ? 'demo' : 'ok') : boot === 'loading' ? 'wait' : 'off';
  const text = boot === 'ready' ? (mode === 'demo' ? 'Demo snapshot' : 'Engine connected') : boot === 'loading' ? 'Connecting' : 'Engine offline';
  return (
    <header className="nx-nav">
      <div className="nx-nav-inner">
        <Link to="/" className="nx-brand"><Logo />NexusGraph</Link>
        <nav aria-label="Primary" className="nx-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>{l.label}</NavLink>
          ))}
        </nav>
        {onPalette && <button className="nx-kbd-btn" onClick={onPalette} aria-label="Open command palette"><LuCommand /> Search <kbd>Ctrl K</kbd></button>}
        <div className={`nx-conn is-${tone}`} role="status"><i />{text}</div>
      </div>
    </header>
  );
}
