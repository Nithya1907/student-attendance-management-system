import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CircleSlash, Percent } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../utils/useFetch';
import { Card, EmptyState, ErrorState, PageHeader, PercentBadge, Spinner, StatCard } from '../components/ui.jsx';
import { pct } from '../utils/format';

export default function StudentDashboard() {
  const { data, loading, error, reload } = useFetch('/dashboard');
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { overall, subjects, threshold, trend } = data;

  return (
    <div>
      <PageHeader title="My Dashboard" subtitle="Your attendance at a glance" actions={<Link to="/my-attendance" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">View detailed history</Link>} />
      {overall.belowThreshold && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={20} />
          <p className="text-sm"><b>Low attendance warning:</b> your overall attendance is {pct(overall.percentage)}, below the required {threshold}%. Please attend upcoming classes regularly.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Percent} label="Overall attendance" value={pct(overall.percentage)} tone={overall.belowThreshold ? 'red' : 'green'} />
        <StatCard icon={CheckCircle2} label="Classes attended" value={overall.present} tone="green" />
        <StatCard icon={CircleSlash} label="Classes missed" value={overall.absent} tone="red" />
        <StatCard icon={AlertTriangle} label="On leave" value={overall.leave} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Subject-wise attendance">
          {subjects.length === 0 ? <EmptyState title="No attendance recorded yet" /> : (
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjects}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="code" fontSize={12} /><YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => `${v}%`} /><ReferenceLine y={threshold} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `${threshold}%`, fontSize: 11, fill: '#dc2626' }} />
                <Bar dataKey="percentage" name="Attendance" radius={[4, 4, 0, 0]}>{subjects.map((s) => <Cell key={s.subjectId} fill={s.percentage >= threshold ? '#2563eb' : '#dc2626'} />)}</Bar></BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card title="Monthly trend">
          {trend.length === 0 ? <EmptyState title="No trend data yet" /> : (
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={12} /><YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => `${v}%`} /><Line type="monotone" dataKey="percentage" name="Attendance" stroke="#2563eb" strokeWidth={2} /></LineChart>
            </ResponsiveContainer></div>
          )}
        </Card>
      </div>
      {subjects.length > 0 && (
        <Card title="Subject summary" className="mt-6">
          <ul className="divide-y">
            {subjects.map((s) => (
              <li key={s.subjectId} className="flex items-center justify-between py-2 text-sm">
                <span><b>{s.code}</b> {s.name}</span>
                <span className="flex items-center gap-3 text-slate-500">{s.present}/{s.eligible} classes <PercentBadge value={s.percentage} threshold={threshold} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
