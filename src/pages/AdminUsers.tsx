import { useState, useMemo } from 'react';
import {
  Search,
  Mail,
  Phone,
  Calendar,
  X,
  User as UserIcon,
  Shield,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Power,
  ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import {
  useUsers,
  useBookings,
  updateUser,
  type User,
  type UserRole,
  type UserAccountStatus,
} from '@/lib/firestoreService';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils';

export default function AdminUsers() {
  const { user: currentAdmin } = useAuth();
  const { data: users, loading: usersLoading, error: usersError } = useUsers();
  const { data: bookings } = useBookings();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserAccountStatus>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Group bookings by user ID or email/phone for rapid metrics calculation
  const userMetrics = useMemo(() => {
    const metricsMap = new Map<
      string,
      {
        count: number;
        completedCount: number;
        totalSpend: number;
        recentBookings: typeof bookings;
      }
    >();

    bookings.forEach((b) => {
      // Key can match userId, or fallback match by phone/email
      const keys = [b.userId, b.phone, b.patientName].filter(Boolean) as string[];

      keys.forEach((k) => {
        const current = metricsMap.get(k) || {
          count: 0,
          completedCount: 0,
          totalSpend: 0,
          recentBookings: [],
        };

        current.count += 1;
        const isCompleted =
          b.status === 'completed' ||
          b.paymentStatus === 'paid' ||
          String(b.status).toLowerCase() === 'completed';

        if (isCompleted) {
          current.completedCount += 1;
          current.totalSpend += Number(b.amount) || 0;
        }

        if (current.recentBookings.length < 5) {
          current.recentBookings.push(b);
        }

        metricsMap.set(k, current);
      });
    });

    return metricsMap;
  }, [bookings]);

  const getUserMetrics = (u: User) => {
    return (
      userMetrics.get(u.id) ||
      userMetrics.get(u.phone) ||
      userMetrics.get(u.email) || {
        count: 0,
        completedCount: 0,
        totalSpend: 0,
        recentBookings: [],
      }
    );
  };

  // Filtered users list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Keep selected user in sync with real-time updates
  const activeDetailUser = useMemo(() => {
    if (!selectedUser) return null;
    return users.find((u) => u.id === selectedUser.id) || selectedUser;
  }, [selectedUser, users]);

  // Toggle user active / disabled status
  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.id === currentAdmin?.id) {
      alert('You cannot disable your own admin account.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const nextStatus: UserAccountStatus = targetUser.status === 'active' ? 'inactive' : 'active';
      await updateUser(targetUser.id, { status: nextStatus });
      if (selectedUser?.id === targetUser.id) {
        setSelectedUser((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: unknown) {
      console.error('[AdminUsers] Failed to update user status:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update user status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Change user role (admin cannot remove their own admin role)
  const handleChangeRole = async (targetUser: User, newRole: UserRole) => {
    if (targetUser.id === currentAdmin?.id && newRole !== 'admin') {
      alert('You cannot remove your own admin role.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await updateUser(targetUser.id, { role: newRole });
      if (selectedUser?.id === targetUser.id) {
        setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : null));
      }
    } catch (err: unknown) {
      console.error('[AdminUsers] Failed to update user role:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update user role.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  return (
    <AdminLayout title="Users">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-5 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 pr-9 py-2 text-sm w-full"
              placeholder="Search by name, email, or phone..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter by Role */}
          <div className="relative min-w-[140px]">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="input-field py-2 text-sm w-full bg-white cursor-pointer"
              aria-label="Filter by role"
            >
              <option value="all">All Roles</option>
              <option value="user">Users</option>
              <option value="admin">Admins</option>
              <option value="driver">Drivers</option>
            </select>
          </div>

          {/* Filter by Status */}
          <div className="relative min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserAccountStatus)}
              className="input-field py-2 text-sm w-full bg-white cursor-pointer"
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled / Inactive</option>
            </select>
          </div>
        </div>

        {/* Real-time Indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500 self-end md:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="font-medium">Live onSnapshot</span>
        </div>
      </div>

      {/* Result Count and Active Filters Header */}
      {!usersLoading && !usersError && users.length > 0 && (
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 mb-4 px-1">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-gray-800">{filtered.length}</strong> of{' '}
              <strong className="text-gray-800">{users.length}</strong> registered users
            </span>
            {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-brand-600 hover:text-brand-800 font-semibold underline ml-1"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {usersLoading && (
        <div className="card overflow-hidden p-6 animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-6 bg-gray-200 rounded-full w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!usersLoading && usersError && (
        <div className="card p-10 text-center max-w-lg mx-auto border-red-200 bg-red-50/50 my-8">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">Failed to Load Users</h3>
          <p className="text-sm text-gray-600 mb-6">{usersError.message}</p>
        </div>
      )}

      {/* Empty State: No Users Yet */}
      {!usersLoading && !usersError && users.length === 0 && (
        <div className="card p-12 text-center text-gray-500 max-w-md mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <UserIcon className="w-6 h-6" />
          </div>
          <p className="font-semibold text-gray-800 text-base mb-1">No users yet</p>
          <p className="text-xs text-gray-500">
            Registered users will appear here automatically via real-time sync.
          </p>
        </div>
      )}

      {/* Empty State: Search filter has no match */}
      {!usersLoading && !usersError && users.length > 0 && filtered.length === 0 && (
        <div className="card p-12 text-center text-gray-500 max-w-md mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <p className="font-semibold text-gray-800 text-base mb-1">No users found</p>
          <p className="text-xs text-gray-500 mb-4">
            No users match your search query or selected filters.
          </p>
          <button type="button" onClick={resetFilters} className="btn-secondary text-xs">
            Clear Filters
          </button>
        </div>
      )}

      {/* Users Table */}
      {!usersLoading && !usersError && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3">Bookings</th>
                  <th className="px-5 py-3">Total Spend</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => {
                  const metrics = getUserMetrics(u);
                  const isCurrentAdmin = u.id === currentAdmin?.id;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                      onClick={() => setSelectedUser(u)}
                    >
                      {/* Name & Avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                            {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {u.name}
                              </span>
                              {isCurrentAdmin && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-brand-50 text-brand-700 border border-brand-200 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 block font-mono truncate">
                              ID: {u.id.slice(0, 10)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            u.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : u.role === 'driver'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.role === 'admin' && <Shield className="w-3 h-3" />}
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5 text-xs truncate" title={u.email}>
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{u.email || '—'}</span>
                        </div>
                        {u.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{formatDate(u.createdAt)}</span>
                        </div>
                      </td>

                      {/* Booking Count */}
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                        {metrics.count}
                      </td>

                      {/* Total Spend */}
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                        {formatCurrency(metrics.totalSpend)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`status-badge text-[11px] ${
                            u.status === 'active'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {u.status === 'active' ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="px-5 py-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUser(u)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-brand-600 transition-colors"
                            title="View User Details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isCurrentAdmin || actionLoading}
                            className={`p-1.5 rounded-lg transition-colors text-xs font-semibold ${
                              isCurrentAdmin
                                ? 'opacity-30 cursor-not-allowed text-gray-400'
                                : u.status === 'active'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={
                              isCurrentAdmin
                                ? 'You cannot disable your own admin account'
                                : u.status === 'active'
                                ? 'Disable Account'
                                : 'Enable Account'
                            }
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {activeDetailUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {(activeDetailUser.name || activeDetailUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-900">{activeDetailUser.name}</h3>
                    {activeDetailUser.id === currentAdmin?.id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-brand-50 text-brand-700 border border-brand-200 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{activeDetailUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Alert inside modal */}
            {actionError && (
              <div className="my-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Metrics Highlights */}
            {(() => {
              const metrics = getUserMetrics(activeDetailUser);
              return (
                <div className="grid grid-cols-3 gap-3 my-5">
                  <div className="card p-3 text-center bg-gray-50 border border-gray-100">
                    <p className="text-[11px] text-gray-500 font-medium">Total Bookings</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-0.5">{metrics.count}</p>
                  </div>
                  <div className="card p-3 text-center bg-gray-50 border border-gray-100">
                    <p className="text-[11px] text-gray-500 font-medium">Completed</p>
                    <p className="text-xl font-extrabold text-green-600 mt-0.5">
                      {metrics.completedCount}
                    </p>
                  </div>
                  <div className="card p-3 text-center bg-gray-50 border border-gray-100">
                    <p className="text-[11px] text-gray-500 font-medium">Total Spend</p>
                    <p className="text-xl font-extrabold text-brand-600 mt-0.5">
                      {formatCurrency(metrics.totalSpend)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Profile Information List */}
            <div className="space-y-3 text-sm">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Account Details
              </h4>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <span className="text-xs text-gray-500">Firebase UID</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {activeDetailUser.id}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyUid(activeDetailUser.id)}
                    className="p-1 text-gray-400 hover:text-brand-600"
                    title="Copy UID"
                  >
                    {copiedUid ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <span className="text-xs text-gray-500">Contact Phone</span>
                <span className="text-xs font-semibold text-gray-900">
                  {activeDetailUser.phone || 'Not provided'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <span className="text-xs text-gray-500">Registered On</span>
                <span className="text-xs font-semibold text-gray-900">
                  {formatDateTime(activeDetailUser.createdAt)}
                </span>
              </div>

              {/* Role Management with Self-Protection Safeguard */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <span className="text-xs text-gray-500 block">User Role</span>
                  {activeDetailUser.id === currentAdmin?.id && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Admin cannot remove their own admin role
                    </span>
                  )}
                </div>
                <select
                  value={activeDetailUser.role}
                  disabled={activeDetailUser.id === currentAdmin?.id || actionLoading}
                  onChange={(e) =>
                    handleChangeRole(activeDetailUser, e.target.value as UserRole)
                  }
                  className="input-field py-1 text-xs w-auto bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="driver">Driver</option>
                </select>
              </div>

              {/* Status Management with Self-Protection Safeguard */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <span className="text-xs text-gray-500 block">Account Status</span>
                  {activeDetailUser.id === currentAdmin?.id && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      You cannot disable your own admin account
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={activeDetailUser.id === currentAdmin?.id || actionLoading}
                  onClick={() => handleToggleStatus(activeDetailUser)}
                  className={`btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeDetailUser.status === 'active'
                      ? 'text-amber-700 hover:bg-amber-50'
                      : 'text-green-700 hover:bg-green-50'
                  }`}
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {activeDetailUser.status === 'active' ? 'Disable Account' : 'Enable Account'}
                  </span>
                </button>
              </div>
            </div>

            {/* Recent Bookings for this User */}
            {(() => {
              const metrics = getUserMetrics(activeDetailUser);
              return (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Recent Bookings ({metrics.count})
                  </h4>
                  {metrics.recentBookings.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">
                      No bookings recorded for this user yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.recentBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-brand-600">
                                {b.bookingCode || b.id.slice(0, 8)}
                              </span>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-700 font-medium">{b.destination}</span>
                            </div>
                            <span className="text-[11px] text-gray-400 mt-0.5 block">
                              {formatDate(b.createdAt || b.scheduledTime)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-gray-900 block">
                              {formatCurrency(b.amount)}
                            </span>
                            <span className="text-[10px] text-gray-500 capitalize">{b.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
