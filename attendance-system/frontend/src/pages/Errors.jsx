import { Link } from 'react-router-dom';
import { ShieldAlert, SearchX } from 'lucide-react';

function Screen({ icon: Icon, code, title, text, standalone }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${standalone ? 'min-h-screen' : 'py-20'}`}>
      <Icon size={56} className="mb-4 text-blue-600" />
      <p className="text-5xl font-bold text-slate-900">{code}</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      <Link to="/dashboard" className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Back to dashboard</Link>
    </div>
  );
}

export const Unauthorized = () => <Screen icon={ShieldAlert} code="403" title="Access denied" text="Your role does not have permission to view this page." />;
export const NotFound = ({ standalone }) => <Screen standalone={standalone} icon={SearchX} code="404" title="Page not found" text="The page you are looking for does not exist or was moved." />;
