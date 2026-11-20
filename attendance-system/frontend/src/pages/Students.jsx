import CrudPage from '../components/CrudPage.jsx';
import { Badge } from '../components/ui.jsx';

export default function Students() {
  return (
    <CrudPage
      title="Student Management" subtitle="Add, edit, search and remove student records" endpoint="/students" entity="Student"
      searchKeys={['rollNo', 'fullName', 'email', 'departmentName', 'classes']}
      lookups={{ departments: '/departments' }}
      toRow={(r) => ({ rollNo: r.rollNo, fullName: r.fullName, email: r.email, phone: r.phone || '', departmentId: r.departmentId })}
      columns={[
        { key: 'rollNo', label: 'Roll No' },
        { key: 'fullName', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'departmentName', label: 'Department' },
        { key: 'classes', label: 'Class', render: (r) => r.classes || <Badge tone="amber">Not enrolled</Badge> },
      ]}
      fields={[
        { name: 'fullName', label: 'Full name', required: true, minLength: 2 },
        { name: 'rollNo', label: 'Roll number', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone', pattern: /^[0-9+\-\s]{7,20}$/, patternMessage: 'Enter a valid phone number (7-20 digits)' },
        { name: 'departmentId', label: 'Department', type: 'select', required: true, lookup: { key: 'departments', label: 'name' } },
        { name: 'password', label: 'Initial password', type: 'password', required: true, minLength: 8, createOnly: true, hint: 'At least 8 characters' },
      ]}
    />
  );
}
