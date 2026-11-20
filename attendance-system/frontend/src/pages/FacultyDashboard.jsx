import { Link } from 'react-router-dom';
import { BookOpen, CalendarCheck, ClipboardCheck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../utils/useFetch';
import { Card, EmptyState, ErrorState, PageHeader, PercentBadge, Spinner, StatCard } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';

export default function FacultyDashboard() {
  const { data, loading, error, reload } = useFetch('/dashboard');
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const rows = data.assignments.map((a, i) => ({ ...a, id: i, label: `${a.subjectName.slice(0, 12)} (${a.className.split(' ')[0]})` }));

  return (
    <div>
      <PageHeader title="Faculty Dashboard" subtitle="Your classes, subjects and attendance summaries"
        actions={<Link to="/mark-attendance" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><ClipboardCheck size={16} /> Mark attendance</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Assigned classes" value={data.classes} />
        <StatCard icon={BookOpen} label="Assigned subjects" value={data.subjects} tone="amber" />
        <StatCard icon={CalendarCheck} label="Sessions marked today" value={data.sessionsToday} tone="green" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Attendance % by class & subject">
          {rows.length === 0 ? <EmptyState title="No assignments yet" message="Ask the admin to assign you to a class and subject." /> : (
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} /><YAxis domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(v) => `${v}%`} /><Bar dataKey="percentage" name="Attendance" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <div>
          <DataTable rows={rows} pageSize={6} emptyTitle="No assignments"
            columns={[{ key: 'className', label: 'Class' }, { key: 'subjectName', label: 'Subject' }, { key: 'students', label: 'Students' }, { key: 'sessions', label: 'Sessions' },
              { key: 'percentage', label: 'Attendance', render: (r) => <PercentBadge value={r.percentage} /> }]} />
        </div>
      </div>
    </div>
  );
}
