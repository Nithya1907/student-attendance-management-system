import CrudPage from '../components/CrudPage.jsx';

export default function FacultyManagement() {
  return (
    <CrudPage
      title="Faculty Management" subtitle="Add, edit and remove faculty members" endpoint="/faculty" entity="Faculty"
      searchKeys={['employeeId', 'fullName', 'email', 'departmentName']}
      lookups={{ departments: '/departments' }}
      toRow={(r) => ({ employeeId: r.employeeId, fullName: r.fullName, email: r.email, phone: r.phone || '', departmentId: r.departmentId })}
      columns={[
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'fullName', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'departmentName', label: 'Department' },
        { key: 'assignments', label: 'Assignments' },
      ]}
      fields={[
        { name: 'fullName', label: 'Full name', required: true, minLength: 2 },
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone', pattern: /^[0-9+\-\s]{7,20}$/, patternMessage: 'Enter a valid phone number (7-20 digits)' },
        { name: 'departmentId', label: 'Department', type: 'select', required: true, lookup: { key: 'departments', label: 'name' } },
        { name: 'password', label: 'Initial password', type: 'password', required: true, minLength: 8, createOnly: true, hint: 'At least 8 characters' },
      ]}
    />
  );
}
