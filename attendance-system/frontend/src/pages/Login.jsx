
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api, { errorMessage } from '../api/client';
import { Button, Field, inputCls } from '../components/ui.jsx';

const DEMO = [
  { role: 'Admin', email: 'admin@college.edu', password: 'Admin@123' },
  { role: 'Faculty', email: 'faculty1@college.edu', password: 'Faculty@123' },
  { role: 'Student', email: 'student1@college.edu', password: 'Student@123' },
];

const emptyRegistration = {
  fullName: '',
  rollNo: '',
  email: '',
  password: '',
  departmentId: '',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [registration, setRegistration] = useState(emptyRegistration);
  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isRegister) return;

    api.get('/auth/departments')
      .then((response) => setDepartments(response.data))
      .catch((error) => setServerError(errorMessage(error)));
  }, [isRegister]);

  const switchMode = (registerMode) => {
    setIsRegister(registerMode);
    setErrors({});
    setServerError('');
    setSuccess('');
  };

  const submitLogin = async (e) => {
    e.preventDefault();

    const validation = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      validation.email = 'Enter a valid email address';
    }
    if (!form.password) {
      validation.password = 'Password is required';
    }

    setErrors(validation);
    setServerError('');
    setSuccess('');

    if (Object.keys(validation).length) return;

    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from?.pathname || '/dashboard', {
        replace: true,
      });
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submitRegistration = async (e) => {
    e.preventDefault();

    const validation = {};

    if (registration.fullName.trim().length < 2) {
      validation.fullName = 'Enter your full name';
    }
    if (!registration.rollNo.trim()) {
      validation.rollNo = 'Enter your roll number';
    }
    if (!/^\S+@\S+\.\S+$/.test(registration.email.trim())) {
      validation.email = 'Enter a valid email address';
    }
    if (registration.password.length < 8) {
      validation.password = 'Password must be at least 8 characters';
    }
    if (!registration.departmentId) {
      validation.departmentId = 'Please select your department';
    }

    setErrors(validation);
    setServerError('');
    setSuccess('');

    if (Object.keys(validation).length) return;

    setBusy(true);
    try {
      const response = await api.post('/auth/register', {
        ...registration,
        fullName: registration.fullName.trim(),
        rollNo: registration.rollNo.trim(),
        email: registration.email.trim(),
        departmentId: Number(registration.departmentId),
      });

      setForm({
        email: registration.email.trim(),
        password: '',
      });
      setRegistration(emptyRegistration);
      setSuccess(
        response.data.message || 'Account created! Please sign in.'
      );
      setIsRegister(false);
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-gradient-to-br from-blue-700 to-blue-900 p-8 text-white lg:p-16">
        <CalendarCheck size={48} className="mb-4" />
        <h1 className="text-3xl font-bold lg:text-4xl">
          Student Attendance
          <br />
          Management System
        </h1>
        <p className="mt-4 max-w-md text-blue-100">
          Track attendance, monitor shortages and generate reports for
          admins, faculty and students in one place.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-900">
            {isRegister ? 'Create Student Account' : 'Sign in'}
          </h2>

          <p className="mb-6 mt-2 text-sm text-slate-500">
            {isRegister
              ? 'Enter your details to create your account.'
              : 'Use your registered email and password to continue.'}
          </p>

          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              {success}
            </div>
          )}

          {!isRegister ? (
            <form onSubmit={submitLogin} noValidate className="space-y-4">
              <Field label="Email" error={errors.email} htmlFor="email">
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className={`${inputCls} pl-9`}
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
              </Field>

              <Field
                label="Password"
                error={errors.password}
                htmlFor="password"
              >
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`${inputCls} px-9`}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <Button type="submit" busy={busy} className="w-full">
                Sign in
              </Button>
            </form>
          ) : (
            <form
              onSubmit={submitRegistration}
              noValidate
              className="space-y-4"
            >
              <Field
                label="Full Name"
                error={errors.fullName}
                htmlFor="fullName"
              >
                <input
                  id="fullName"
                  className={inputCls}
                  value={registration.fullName}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      fullName: e.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Roll Number"
                error={errors.rollNo}
                htmlFor="rollNo"
              >
                <input
                  id="rollNo"
                  className={inputCls}
                  value={registration.rollNo}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      rollNo: e.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Email"
                error={errors.email}
                htmlFor="registerEmail"
              >
                <input
                  id="registerEmail"
                  type="email"
                  autoComplete="email"
                  className={inputCls}
                  value={registration.email}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      email: e.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Password (minimum 8 characters)"
                error={errors.password}
                htmlFor="registerPassword"
              >
                <div className="relative">
                  <input
                    id="registerPassword"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${inputCls} pr-10`}
                    value={registration.password}
                    onChange={(e) =>
                      setRegistration({
                        ...registration,
                        password: e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <Field
                label="Department"
                error={errors.departmentId}
                htmlFor="departmentId"
              >
                <select
                  id="departmentId"
                  className={inputCls}
                  value={registration.departmentId}
                  onChange={(e) =>
                    setRegistration({
                      ...registration,
                      departmentId: e.target.value,
                    })
                  }
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Button type="submit" busy={busy} className="w-full">
                Create Account
              </Button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-slate-600">
            {isRegister
              ? 'Already have an account? '
              : "Don't have an account? "}
            <button
              type="button"
              onClick={() => switchMode(!isRegister)}
              className="font-semibold text-blue-700 hover:underline"
            >
              {isRegister ? 'Sign in' : 'Create Account'}
            </button>
          </p>

          {!isRegister && (
            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Demo accounts (click to fill)
              </p>
              <div className="space-y-1">
                {DEMO.map((demo) => (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() =>
                      setForm({
                        email: demo.email,
                        password: demo.password,
                      })
                    }
                    className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-white"
                  >
                    <span className="font-medium">{demo.role}:</span>{' '}
                    <span className="text-slate-600">{demo.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
