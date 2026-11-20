import { useState } from 'react';
import CrudPage from '../components/CrudPage.jsx';
import { PageHeader, Tabs } from '../components/ui.jsx';
import { Badge } from '../components/ui.jsx';

const dept = { name: 'departmentId', label: 'Department', type: 'select', required: true, lookup: { key: 'departments', label: 'name' } };

export default function Academics() {
  const [tab, setTab] = useState('classes');
  return (
    <div>
      <PageHeader title="Classes & Subjects" subtitle="Manage departments, academic years, classes and subjects" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'classes', label: 'Classes' }, { value: 'subjects', label: 'Subjects' },
        { value: 'departments', label: 'Departments' }, { value: 'years', label: 'Academic Years' },
      ]} />
      {tab === 'classes' && (
        <CrudPage key="classes" embedded endpoint="/classes" entity="Class" searchKeys={['name', 'departmentName', 'academicYear']}
          lookups={{ departments: '/departments', years: '/academic-years' }}
          toRow={(r) => ({ name: r.name, semester: r.semester, departmentId: r.departmentId, academicYearId: r.academicYearId })}
          columns={[{ key: 'name', label: 'Class' }, { key: 'semester', label: 'Semester' }, { key: 'departmentName', label: 'Department' }, { key: 'academicYear', label: 'Academic Year' }, { key: 'studentCount', label: 'Students' }]}
          fields={[
            { name: 'name', label: 'Class name', required: true }, { name: 'semester', label: 'Semester (1-12)', type: 'number', required: true },
            dept, { name: 'academicYearId', label: 'Academic year', type: 'select', required: true, lookup: { key: 'years', label: 'label' } },
          ]} />
      )}
      {tab === 'subjects' && (
        <CrudPage key="subjects" embedded endpoint="/subjects" entity="Subject" searchKeys={['code', 'name', 'departmentName']}
          lookups={{ departments: '/departments' }}
          toRow={(r) => ({ code: r.code, name: r.name, departmentId: r.departmentId })}
          columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Subject' }, { key: 'departmentName', label: 'Department' }]}
          fields={[{ name: 'code', label: 'Subject code', required: true }, { name: 'name', label: 'Subject name', required: true, minLength: 2 }, dept]} />
      )}
      {tab === 'departments' && (
        <CrudPage key="departments" embedded endpoint="/departments" entity="Department" searchKeys={['name', 'code']}
          toRow={(r) => ({ name: r.name, code: r.code })}
          columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Department' }]}
          fields={[{ name: 'name', label: 'Department name', required: true, minLength: 2 }, { name: 'code', label: 'Code', required: true }]} />
      )}
      {tab === 'years' && (
        <CrudPage key="years" embedded endpoint="/academic-years" entity="Academic year" searchKeys={['label']}
          toRow={(r) => ({ label: r.label, isCurrent: !!r.isCurrent })}
          columns={[{ key: 'label', label: 'Academic Year' }, { key: 'isCurrent', label: 'Current', render: (r) => (r.isCurrent ? <Badge tone="green">Current</Badge> : '-') }]}
          fields={[{ name: 'label', label: 'Label (e.g. 2025-26)', required: true, pattern: /^\d{4}-\d{2,4}$/, patternMessage: 'Use the format 2025-26' }, { name: 'isCurrent', label: 'Current year', type: 'checkbox' }]} />
      )}
    </div>
  );
}
