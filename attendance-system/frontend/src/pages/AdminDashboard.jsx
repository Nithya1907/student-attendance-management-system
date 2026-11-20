import { BookOpen, Building2, GraduationCap, Library, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../utils/useFetch';
import { Card, EmptyState, ErrorState, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import { fmtDate, pct } from '../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch('/dashboard');
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { counts, totals, daily, byClass, threshold } = data;
  const pie = [{ name: 'Present', value: totals.present, color: '#16a34a' }, { name: 'Absent', value: totals.absent, color: '#dc2626' }, { name: 'Leave', value: totals.leave, color: '#d97706' }];
  const hasData = totals.present + totals.absent + totals.leave > 0;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Institution-wide overview" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={GraduationCap} label="Students" value={counts.students} />
        <StatCard icon={Users} label="Faculty" value={counts.faculty} tone="amber" />
        <StatCard icon={Building2} label="Classes" value={counts.classes} tone="green" />
        <StatCard icon={BookOpen} label="Subjects" value={counts.subjects} tone="slate" />
        <StatCard icon={Library} label="Overall attendance" value={pct(totals.percentage)} tone={totals.percentage >= threshold ? 'green' : 'red'} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Attendance trend (last 14 days)" className="lg:col-span-2">
          {daily.length === 0 ? <EmptyState title="No attendance recorded recently" /> : (
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily.map((d) => ({ ...d, label: fmtDate(d.date).slice(0, 6) }))}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={12} /><YAxis domain={[0, 100]} fontSize={12} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} /><Line type="monotone" dataKey="percentage" name="Attendance" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card title="Present / Absent / Leave">
          {!hasData ? <EmptyState title="No data yet" /> : (
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card title="Attendance by class" className="lg:col-span-3">
          {byClass.length === 0 ? <EmptyState title="No class data yet" /> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="className" fontSize={12} /><YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => `${v}%`} /><Bar dataKey="percentage" name="Attendance" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
      </div>
    </div>
  );
}
