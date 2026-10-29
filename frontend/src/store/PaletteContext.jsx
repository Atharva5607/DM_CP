import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuHouse, LuLayoutDashboard, LuWrench } from 'react-icons/lu';
import CommandPalette from '../components/CommandPalette';

const Ctx = createContext({ open: () => {}, setPageItems: () => {} });
export const usePalette = () => useContext(Ctx);

/** Pages call usePageCommands(items) to add their own commands to the global palette. */
export function usePageCommands(items) {
  const { setPageItems } = useContext(Ctx);
  useEffect(() => {
    setPageItems(items);
    return () => setPageItems([]);
  }, [items, setPageItems]);
}

export function PaletteProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [pageItems, setPageItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = useMemo(() => [
    ['/', 'Go to Home', LuHouse], ['/dashboard', 'Go to Dashboard', LuLayoutDashboard], ['/builder', 'Go to Scenario builder', LuWrench]
  ].map(([to, label, Icon]) => ({ id: `nav-${to}`, label, group: 'Navigate', icon: <Icon />, run: () => navigate(to) })), [navigate]);

  const items = useMemo(() => [...pageItems, ...nav], [pageItems, nav]);
  const value = useMemo(() => ({ open: () => setOpen(true), setPageItems }), []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Ctx.Provider value={value}>
      {children}
      <CommandPalette open={open} onClose={close} items={items} />
    </Ctx.Provider>
  );
}
