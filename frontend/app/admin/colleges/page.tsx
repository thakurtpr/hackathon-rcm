'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Users,
  CheckCircle2,
  FileText,
  BookOpen,
  Landmark,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import {
  getAdminOverview,
  getAdminCollegeStats,
  getAdminUsers,
  AdminOverview,
  CollegeStat,
  AdminUser,
} from '@/lib/api';

export default function CollegeDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [colleges, setColleges] = useState<CollegeStat[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof CollegeStat>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchBase = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, cs] = await Promise.all([getAdminOverview(), getAdminCollegeStats()]);
      setOverview(ov);
      setColleges(cs.colleges);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  const openCollege = async (college: string) => {
    setSelectedCollege(college);
    setUsersLoading(true);
    try {
      const res = await getAdminUsers(college);
      setUsers(res.users);
    } finally {
      setUsersLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedCollege(null);
    setUsers([]);
  };

  const toggleSort = (field: keyof CollegeStat) => {
    if (sortField === field) {
      setSortAsc((p) => !p);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filtered = colleges
    .filter((c) => c.college.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortField] as number;
      const bv = b[sortField] as number;
      return sortAsc ? av - bv : bv - av;
    });

  const SortIcon = ({ field }: { field: keyof CollegeStat }) =>
    sortField === field ? (
      sortAsc ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
    ) : null;

  const intentBar = (loan: number, scholarship: number, both: number) => {
    const total = loan + scholarship + both || 1;
    return (
      <div className="flex h-1.5 rounded-full overflow-hidden w-24 gap-px">
        <div style={{ width: `${(loan / total) * 100}%` }} className="bg-indigo-500 rounded-l-full" />
        <div style={{ width: `${(scholarship / total) * 100}%` }} className="bg-emerald-500" />
        <div style={{ width: `${(both / total) * 100}%` }} className="bg-amber-500 rounded-r-full" />
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Registered', value: overview?.total_users ?? '—', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
          { label: 'Verified', value: overview?.verified_users ?? '—', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Applications', value: overview?.total_applications ?? '—', icon: FileText, color: 'text-sky-400', bg: 'bg-sky-400/10' },
          { label: 'Loan Apps', value: overview?.loan_applications ?? '—', icon: Landmark, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'Scholarship Apps', value: overview?.scholarship_applications ?? '—', icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { label: 'Colleges', value: overview?.total_colleges ?? '—', icon: GraduationCap, color: 'text-rose-400', bg: 'bg-rose-400/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-950 border border-gray-800 p-4 rounded-2xl flex flex-col gap-3 hover:border-gray-700 transition-all">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-black mt-0.5 ${stat.color}`}>
                {loading ? <span className="opacity-30">—</span> : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* College Table */}
      <div className="bg-gray-950 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-8 py-5 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap size={20} className="text-indigo-400" />
              College-wise Registrations
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Click a row to see registered students</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl focus-within:border-indigo-500/50 transition-all">
              <Search size={14} className="text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search college..."
                className="bg-transparent text-sm text-white outline-none w-48 placeholder-gray-600 font-medium"
              />
            </div>
            <button
              onClick={fetchBase}
              className="p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-all"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/40 border-b border-gray-800">
                {[
                  { label: 'College', field: 'college' as keyof CollegeStat },
                  { label: 'Registered', field: 'total' as keyof CollegeStat },
                  { label: 'Verified', field: 'verified' as keyof CollegeStat },
                  { label: 'Applications', field: 'applications' as keyof CollegeStat },
                  { label: 'Intent Split', field: null },
                ].map(({ label, field }) => (
                  <th
                    key={label}
                    onClick={field ? () => toggleSort(field) : undefined}
                    className={`px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ${field ? 'cursor-pointer hover:text-gray-300 select-none' : ''}`}
                  >
                    {label}
                    {field && <SortIcon field={field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-3 bg-gray-800 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-600 text-sm font-bold uppercase tracking-widest">
                    No colleges found
                  </td>
                </tr>
              ) : (
                filtered.map((col) => {
                  const verifiedPct = col.total > 0 ? Math.round((col.verified / col.total) * 100) : 0;
                  return (
                    <tr
                      key={col.college}
                      onClick={() => openCollege(col.college)}
                      className="hover:bg-gray-900/60 cursor-pointer transition-all group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <GraduationCap size={16} className="text-indigo-400" />
                          </div>
                          <span className="font-bold text-gray-200 group-hover:text-white transition-colors text-sm">{col.college}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-lg font-black text-white">{col.total}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-400">{col.verified}</span>
                          <span className="text-[10px] text-gray-600 font-semibold">{verifiedPct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-sky-400">{col.applications}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1.5">
                          {intentBar(col.loan_intent, col.scholarship_intent, col.both_intent)}
                          <div className="flex gap-3 text-[9px] font-bold uppercase tracking-wide">
                            <span className="text-indigo-400">L {col.loan_intent}</span>
                            <span className="text-emerald-400">S {col.scholarship_intent}</span>
                            <span className="text-amber-400">B {col.both_intent}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-6 py-3 border-t border-gray-800 flex gap-6 text-[10px] font-bold uppercase tracking-wider text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" />Loan</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Scholarship</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Both</span>
        </div>
      </div>

      {/* Student Drawer */}
      {selectedCollege && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative w-full max-w-2xl bg-gray-950 border-l border-gray-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <GraduationCap size={18} className="text-indigo-400" />
                  {selectedCollege}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{users.length} student{users.length !== 1 ? 's' : ''} registered</p>
              </div>
              <button onClick={closeDrawer} className="p-2 rounded-xl hover:bg-gray-800 text-gray-500 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {usersLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-900 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                  <Users size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-bold uppercase tracking-widest">No students found</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl px-5 py-4 hover:border-gray-700 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 font-black text-indigo-400 text-sm">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-100 text-sm truncate">{u.full_name}</p>
                            <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                            u.is_verified
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-gray-800 text-gray-500 border border-gray-700'
                          }`}>
                            {u.is_verified ? 'Verified' : 'Unverified'}
                          </div>
                          <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                            u.kyc_status === 'digilocker_verified' || u.kyc_status === 'approved'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-gray-800 text-gray-500 border border-gray-700'
                          }`}>
                            KYC: {u.kyc_status}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        <span className="text-indigo-400/80">{u.intent}</span>
                        <span>{u.app_count} app{u.app_count !== 1 ? 's' : ''}</span>
                        <span>{u.mobile}</span>
                        <span className="ml-auto text-gray-700">{new Date(u.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
