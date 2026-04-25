// ClockMate Pro - Analytics Dashboard Page (Real Data)
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  Calendar,
  MapPin,
  Loader2,
  Download,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAdminDashboard, getManagerDashboard, getEmployees, getTimeEntries, getLeaveRequests, getTimesheets } from '@/lib/api';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316'];

export default function AnalyticsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Real data states
  const [dashboard, setDashboard] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);

  useEffect(() => {
    loadAllData();
  }, [orgId, user]);

  async function loadAllData() {
    if (!orgId || !user) return;
    
    try {
      setLoading(true);
      
      // Get dashboard data
      let dashData = null;
      if (['OWNER', 'ADMIN'].includes(user.role)) {
        dashData = await getAdminDashboard(orgId);
      } else if (user.role === 'MANAGER') {
        dashData = await getManagerDashboard(orgId, user.id);
      }
      setDashboard(dashData);
      
      // Get employees for department chart
      const emps = await getEmployees(orgId);
      setEmployees(emps);
      
      // Get time entries for the past week for charts
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const entries = await getTimeEntries(orgId, {
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString()
      });
      setTimeEntries(entries);
      
      // Get leave requests
      const leaves = await getLeaveRequests(orgId);
      setLeaveRequests(leaves);
      
      // Get timesheets
      const sheets = await getTimesheets(orgId);
      setTimesheets(sheets);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  // Compute real attendance data for the week
  const computeWeeklyAttendance = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    return days.map(day => {
      const dayEntries = timeEntries.filter(e => {
        const entryDate = new Date(e.clockIn?.time || e.createdAt);
        return isSameDay(entryDate, day);
      });
      
      const completedEntries = dayEntries.filter(e => e.status === 'COMPLETED');
      const activeEntries = dayEntries.filter(e => e.status === 'ACTIVE');
      const lateEntries = completedEntries.filter(e => {
        const hour = new Date(e.clockIn.time).getHours();
        return hour >= 9;
      });
      
      return {
        day: format(day, 'EEE'),
        present: completedEntries.length + activeEntries.length,
        absent: Math.max(0, employees.filter(e => e.inviteStatus === 'JOINED').length - completedEntries.length - activeEntries.length),
        late: lateEntries.length,
      };
    });
  };

  // Compute real hours data for the week
  const computeWeeklyHours = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    return days.map(day => {
      const dayEntries = timeEntries.filter(e => {
        const entryDate = new Date(e.clockIn?.time || e.createdAt);
        return isSameDay(entryDate, day);
      });
      
      const regular = dayEntries.reduce((sum, e) => sum + (e.regularHours || 0), 0);
      const overtime = dayEntries.reduce((sum, e) => sum + (e.overtimeHours || 0), 0);
      
      return {
        day: format(day, 'EEE'),
        regular: Math.round(regular * 10) / 10,
        overtime: Math.round(overtime * 10) / 10,
      };
    });
  };

  // Compute department distribution from real employees
  const computeDepartmentData = () => {
    const deptMap: Record<string, number> = {};
    employees.forEach(emp => {
      const dept = emp.department || 'Unassigned';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    
    return Object.entries(deptMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  };

  // Compute attendance rate
  const computeAttendanceRate = () => {
    const joinedEmployees = employees.filter(e => e.inviteStatus === 'JOINED');
    if (joinedEmployees.length === 0) return 0;
    
    const todayEntries = timeEntries.filter(e => {
      const entryDate = new Date(e.clockIn?.time || e.createdAt);
      return isSameDay(entryDate, new Date());
    });
    
    return Math.round((todayEntries.length / joinedEmployees.length) * 100);
  };

  const weeklyAttendance = computeWeeklyAttendance();
  const weeklyHours = computeWeeklyHours();
  const departmentData = computeDepartmentData();
  const attendanceRate = computeAttendanceRate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back indicator */}
      <div className="flex items-center gap-2">
        <ArrowLeft className="size-4 text-slate-400" />
        <span className="text-sm text-slate-500">Analytics</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Analytics</h2>
          <p className="text-sm text-slate-500">Insights and reports for your organization</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics - Real Data */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{dashboard?.todayAttendance?.present ?? 0}</p>
                    <p className="text-xs text-slate-500">Present Today</p>
                  </div>
                  <div className="size-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Users className="size-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{dashboard?.todayAttendance?.late ?? 0}</p>
                    <p className="text-xs text-slate-500">Late Today</p>
                  </div>
                  <div className="size-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{dashboard?.pendingApprovals?.timesheets ?? 0}</p>
                    <p className="text-xs text-slate-500">Pending Timesheets</p>
                  </div>
                  <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="size-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{dashboard?.pendingApprovals?.leaveRequests ?? 0}</p>
                    <p className="text-xs text-slate-500">Leave Requests</p>
                  </div>
                  <div className="size-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Calendar className="size-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyAttendance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="present" fill="#10b981" name="Present" />
                    <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                    <Bar dataKey="late" fill="#f59e0b" name="Late" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hours Worked</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyHours}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="regular" fill="#3b82f6" name="Regular" />
                    <Bar dataKey="overtime" fill="#f59e0b" name="Overtime" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          {/* Attendance Rate Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-emerald-600">{attendanceRate}%</p>
                  <p className="text-sm text-slate-500">Attendance Rate This Week</p>
                </div>
                <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="size-8 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Attendance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} name="Present" />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Absent" />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} name="Late" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Upcoming Leave */}
          {dashboard?.upcomingLeave && dashboard.upcomingLeave.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Leave</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboard.upcomingLeave.map((leave: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Calendar className="size-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{leave.employeeName}</p>
                          <p className="text-sm text-slate-500">
                            {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{leave.days} days</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hours" className="space-y-6">
          {/* Total Hours Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">
                  {Math.round(weeklyHours.reduce((s, d) => s + d.regular, 0) * 10) / 10}h
                </p>
                <p className="text-xs text-slate-500">Regular Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">
                  {Math.round(weeklyHours.reduce((s, d) => s + d.overtime, 0) * 10) / 10}h
                </p>
                <p className="text-xs text-slate-500">Overtime Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">
                  {Math.round((weeklyHours.reduce((s, d) => s + d.regular + d.overtime, 0)) * 10) / 10}h
                </p>
                <p className="text-xs text-slate-500">Total Hours</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="regular" stackId="a" fill="#3b82f6" name="Regular" />
                  <Bar dataKey="overtime" stackId="a" fill="#f59e0b" name="Overtime" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Department Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {departmentData.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No department data yet</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={departmentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {departmentData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {departmentData.map((dept, i) => (
                        <div key={dept.name} className="flex items-center gap-2">
                          <div className="size-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-slate-600">{dept.name} ({dept.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">Attendance Rate</p>
                      <p className="text-sm text-slate-500">This week</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{attendanceRate}%</p>
                      <Badge variant="outline" className="text-emerald-600">
                        {attendanceRate >= 90 ? <TrendingUp className="size-3 mr-1" /> : <TrendingDown className="size-3 mr-1" />}
                        {attendanceRate >= 90 ? 'Good' : 'Needs Attention'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">Total Employees</p>
                      <p className="text-sm text-slate-500">Joined</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {employees.filter(e => e.inviteStatus === 'JOINED').length}
                      </p>
                      <Badge variant="outline" className="text-blue-600">
                        <Users className="size-3 mr-1" />
                        {employees.filter(e => e.inviteStatus === 'INVITED').length} invited
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">Departments</p>
                      <p className="text-sm text-slate-500">Active</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-600">{departmentData.length}</p>
                      <Badge variant="outline" className="text-purple-600">
                        <MapPin className="size-3 mr-1" />
                        {employees.length} total members
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
