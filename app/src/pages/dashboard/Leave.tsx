// ClockMate Pro - Leave Management Page
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Briefcase, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Search,
  Filter,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  getLeaveTypes, 
  getLeaveBalances, 
  getLeaveRequests, 
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest
} from '@/lib/api';
import { useLeaveStore, useAuthStore } from '@/store';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import type { LeaveRequest, LeaveBalance } from '@/types';

export default function LeavePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuthStore();
  const { 
    leaveTypes, 
    leaveBalances, 
    leaveRequests, 
    setLeaveTypes, 
    setLeaveBalances, 
    setLeaveRequests,
    updateLeaveRequest
  } = useLeaveStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('balances');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  
  // Form state
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState<'FULL' | 'AM' | 'PM'>('FULL');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Approval filter
  const [approvalFilter, setApprovalFilter] = useState('PENDING');

  const isManager = ['ADMIN', 'OWNER', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    loadData();
  }, [orgId, user]);

  async function loadData() {
    if (!orgId || !user) return;
    
    try {
      setLoading(true);
      // Load leave types and balances
      const [types, balances] = await Promise.all([
        getLeaveTypes(orgId),
        getLeaveBalances(user.id),
      ]);
      
      setLeaveTypes(types);
      setLeaveBalances(balances);
      
      // Load requests - for managers, load all; for employees, load own
      const requestFilters: { userId?: string; status?: string } = {};
      if (!isManager) {
        requestFilters.userId = user.id;
      }
      const requests = await getLeaveRequests(orgId, requestFilters);
      setLeaveRequests(requests);
    } catch (error) {
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 className="size-4 text-emerald-600" />;
      case 'REJECTED': return <XCircle className="size-4 text-red-600" />;
      default: return <Loader2 className="size-4 text-amber-600" />;
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const days = differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1;
    if (days <= 0) return 0;
    return duration === 'FULL' ? days : days * 0.5;
  };

  const handleSubmitRequest = async () => {
    if (!orgId || !user) return;
    
    const days = calculateDays();
    if (days <= 0) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      setSubmitting(true);
      await createLeaveRequest({
        orgId,
        userId: user.id,
        leaveTypeId: selectedLeaveType,
        startDate,
        endDate,
        duration,
        reason,
        days,
      });
      
      toast.success('Leave request submitted successfully');
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedLeaveType('');
    setStartDate('');
    setEndDate('');
    setDuration('FULL');
    setReason('');
  };

  const handleApprove = async (requestId: string) => {
    try {
      setApprovingId(requestId);
      const updated = await approveLeaveRequest(requestId, user!.id);
      updateLeaveRequest(updated);
      toast.success('Leave request approved');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve request');
    } finally {
      setApprovingId(null);
    }
  };

  const openRejectDialog = (requestId: string) => {
    setSelectedRequestId(requestId);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequestId || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setRejectingId(selectedRequestId);
      const updated = await rejectLeaveRequest(selectedRequestId, rejectReason);
      updateLeaveRequest(updated);
      toast.success('Leave request rejected');
      setIsRejectDialogOpen(false);
      setSelectedRequestId(null);
      setRejectReason('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject request');
    } finally {
      setRejectingId(null);
    }
  };

  const filteredApprovals = leaveRequests.filter(r => {
    if (approvalFilter === 'ALL') return true;
    return r.status === approvalFilter;
  });

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
        <span className="text-sm text-slate-500">Leave Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Leave Management</h2>
          <p className="text-sm text-slate-500">Manage your leave balances and requests</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Leave Type */}
              <div>
                <label className="text-sm font-medium">Leave Type *</label>
                <select
                  value={selectedLeaveType}
                  onChange={(e) => setSelectedLeaveType(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.isPaid ? 'Paid' : 'Unpaid'})</option>
                  ))}
                </select>
              </div>
              
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), 'yyyy-MM-dd')}
                    className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Days Preview */}
              {calculateDays() > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Total: <strong>{calculateDays()} {calculateDays() === 1 ? 'day' : 'days'}</strong>
                  </p>
                </div>
              )}
              
              {/* Duration */}
              <div>
                <label className="text-sm font-medium">Duration</label>
                <div className="flex gap-2 mt-1">
                  {(['FULL', 'AM', 'PM'] as const).map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant={duration === d ? 'default' : 'outline'}
                      onClick={() => setDuration(d)}
                      className="flex-1"
                      size="sm"
                    >
                      {d === 'FULL' ? 'Full Day' : d}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Reason */}
              <div>
                <label className="text-sm font-medium">Reason <span className="text-slate-400">(optional)</span></label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for leave..."
                  className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={handleSubmitRequest}
                disabled={!selectedLeaveType || !startDate || !endDate || submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Rejection Reason *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsRejectDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectingId !== null}
                className="flex-1"
              >
                {rejectingId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Reject'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          {isManager && (
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          )}
        </TabsList>

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-4 mt-4">
          {leaveBalances.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Briefcase className="size-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No leave balances found</p>
                <p className="text-sm text-slate-400 mt-1">Contact your administrator to set up leave types</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaveBalances.map(balance => (
                <Card key={balance.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="size-12 rounded-xl flex items-center justify-center"
                          style={{ 
                            backgroundColor: (balance.leaveType?.color || '#3b82f6') + '20', 
                            color: balance.leaveType?.color || '#3b82f6' 
                          }}
                        >
                          <Briefcase className="size-6" />
                        </div>
                        <div>
                          <p className="font-semibold">{balance.leaveType?.name || 'Unknown'}</p>
                          <p className="text-sm text-slate-500">
                            {balance.leaveType?.isPaid ? 'Paid' : 'Unpaid'} Leave
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-slate-800">{balance.availableDays}</p>
                        <p className="text-xs text-slate-500">days available</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Entitlement: <strong>{balance.entitlementDays} days</strong></span>
                        <span className="text-slate-500">Used: <strong className="text-amber-600">{balance.usedDays} days</strong></span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Pending: <strong className="text-amber-600">{balance.pendingDays} days</strong></span>
                        <span className="text-slate-500">Carried Over: <strong className="text-emerald-600">{balance.carriedOverDays || 0} days</strong></span>
                      </div>
                      <Progress 
                        value={balance.entitlementDays > 0 ? ((balance.usedDays + balance.pendingDays) / balance.entitlementDays) * 100 : 0} 
                        className="h-2.5"
                      />
                      <p className="text-xs text-slate-400 text-right">
                        {balance.entitlementDays > 0 ? Math.round(((balance.usedDays + balance.pendingDays) / balance.entitlementDays) * 100) : 0}% used
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-5" />
                My Leave Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.filter(r => r.userId === user?.id).length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="size-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">No leave requests yet</p>
                  <p className="text-sm text-slate-400 mt-1">Click "Request Leave" to submit your first request</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests
                    .filter(r => r.userId === user?.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(request => (
                      <div 
                        key={request.id} 
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="size-12 rounded-xl flex items-center justify-center"
                            style={{ 
                              backgroundColor: (request.leaveType?.color || '#3b82f6') + '20', 
                              color: request.leaveType?.color || '#3b82f6' 
                            }}
                          >
                            <Calendar className="size-6" />
                          </div>
                          <div>
                            <p className="font-semibold">{request.leaveType?.name || 'Unknown'}</p>
                            <p className="text-sm text-slate-500">
                              {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {request.days} {request.days === 1 ? 'day' : 'days'} • {request.duration === 'FULL' ? 'Full Day' : request.duration}
                            </p>
                            {request.reason && (
                              <p className="text-xs text-slate-400 mt-0.5 italic">"{request.reason}"</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="secondary" className={getStatusColor(request.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(request.status)}
                              {request.status}
                            </span>
                          </Badge>
                          <p className="text-xs text-slate-400">
                            {format(new Date(request.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        {isManager && (
          <TabsContent value="approvals" className="mt-4 space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-slate-400" />
              <div className="flex gap-1">
                {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
                  <Button
                    key={status}
                    variant={approvalFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setApprovalFilter(status)}
                  >
                    {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {approvalFilter === 'ALL' ? 'All Requests' : `${approvalFilter.charAt(0) + approvalFilter.slice(1).toLowerCase()} Requests`}
                  <span className="ml-2 text-sm font-normal text-slate-400">({filteredApprovals.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredApprovals.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="size-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">
                      {approvalFilter === 'PENDING' ? 'No pending approvals' : 'No requests found'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredApprovals
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(request => (
                        <div 
                          key={request.id} 
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                              {request.employee?.firstName?.[0]}{request.employee?.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold">
                                {request.employee?.firstName} {request.employee?.lastName}
                              </p>
                              <p className="text-sm text-slate-500">
                                {request.leaveType?.name} • {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d')}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {request.days} {request.days === 1 ? 'day' : 'days'} • {request.duration === 'FULL' ? 'Full Day' : request.duration}
                              </p>
                              {request.reason && (
                                <p className="text-xs text-slate-400 mt-0.5 italic">"{request.reason}"</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="secondary" className={getStatusColor(request.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(request.status)}
                                {request.status}
                              </span>
                            </Badge>
                            
                            {request.status === 'PENDING' && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleApprove(request.id)}
                                  disabled={approvingId === request.id}
                                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                >
                                  {approvingId === request.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-4" />
                                  )}
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openRejectDialog(request.id)}
                                  disabled={rejectingId === request.id}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <XCircle className="size-4" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            
                            {request.status !== 'PENDING' && request.approvedBy && (
                              <p className="text-xs text-slate-400">
                                by {request.approvedBy}
                              </p>
                            )}
                            
                            {request.rejectionReason && (
                              <p className="text-xs text-red-400 italic max-w-[200px] truncate">
                                "{request.rejectionReason}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
