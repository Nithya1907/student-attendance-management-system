import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const push = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, []);
  const value = { success: (m) => push('success', m), error: (m) => push('error', m) };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-80 max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-start gap-2 rounded-lg border p-3 shadow-lg bg-white ${t.type === 'success' ? 'border-green-300' : 'border-red-300'}`}>
            {t.type === 'success' ? <CheckCircle2 className="text-green-600 shrink-0" size={20} /> : <AlertCircle className="text-red-600 shrink-0" size={20} />}
            <p className="text-sm flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
