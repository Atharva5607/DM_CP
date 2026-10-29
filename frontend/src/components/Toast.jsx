import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { LuCircleCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu';

const ToastCtx = createContext({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const push = useCallback((text, kind = 'info') => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-3), { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  const Icon = { info: LuInfo, ok: LuCircleCheck, warn: LuTriangleAlert };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="nx-toasts" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind] || LuInfo;
          return <div key={t.id} className={`nx-toast is-${t.kind}`}><I />{t.text}</div>;
        })}
      </div>
    </ToastCtx.Provider>
  );
}
