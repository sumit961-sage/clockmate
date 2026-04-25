import { useState } from 'react';
import { Search, Users, Circle } from 'lucide-react';
import type { Employee } from '@/types';

interface EmployeeSidebarProps {
  employees: Employee[];
  selectedId: string;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  showAllOption?: boolean;
  title?: string;
}

/** Extract string ID from various formats (populated object, string, etc.) */
function extractId(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && obj !== null) {
    const o = obj as Record<string, unknown>;
    if (typeof o.id === 'string') return o.id;
    if (typeof o._id === 'string') return o._id;
  }
  return null;
}

/** Get the User ID from an Employee (handles populated userId field) */
function getEmployeeUserId(emp: Employee): string {
  const uid = extractId(((emp as unknown) as Record<string, unknown>).userId);
  if (uid) return uid;
  return emp.id;
}

export default function EmployeeSidebar({
  employees,
  selectedId,
  onSelect,
  onSelectAll,
  showAllOption = true,
  title = 'Employees'
}: EmployeeSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.position?.toLowerCase().includes(q);
  });

  return (
    <div className="w-full lg:w-60 flex-shrink-0 bg-white border rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm mb-2">{title}</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-blue-300 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showAllOption && (
          <button
            onClick={onSelectAll}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50`}
            style={selectedId === 'all' ? { borderLeftWidth: '3px', borderLeftColor: '#3b82f6', backgroundColor: '#eff6ff' } : { borderLeftWidth: '3px', borderLeftColor: 'transparent' }}
          >
            <Users className="size-4 text-slate-400" />
            <span className="font-medium">All Staff</span>
          </button>
        )}

        {filtered.map(emp => {
          const empUserId = getEmployeeUserId(emp);
          const isSelected = selectedId === empUserId;
          return (
            <button
              key={emp.id}
              onClick={() => onSelect(empUserId)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50`}
              style={isSelected ? { borderLeftWidth: '3px', borderLeftColor: '#3b82f6', backgroundColor: '#eff6ff' } : { borderLeftWidth: '3px', borderLeftColor: 'transparent' }}
            >
              <div className="size-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {emp.firstName?.[0]}{emp.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{emp.firstName} {emp.lastName}</p>
                <p className="text-[11px] text-slate-400 truncate">{emp.position}</p>
              </div>
              <Circle className={`size-2 rounded-full shrink-0 ${emp.isActive ? 'text-emerald-400' : 'text-slate-300'}`} fill="currentColor" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
