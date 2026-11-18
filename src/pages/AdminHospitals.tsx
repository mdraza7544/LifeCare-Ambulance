import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Hospital as HospitalIcon,
  Phone,
  MapPin,
  Search,
  BedDouble,
  AlertTriangle,
  RotateCw,
  X,
  Star,
  Filter,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { getHospitals } from '@/lib/hospitalApi';
import type { Hospital } from '@/lib/types';

const ITEMS_PER_PAGE = 18;

export default function AdminHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSpeciality, setSelectedSpeciality] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const loadHospitals = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getHospitals({ forceRefresh });
      setHospitals(data);
    } catch (err: unknown) {
      console.error('[AdminHospitals] Failed to fetch hospitals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch hospital records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  // Extract all unique specialities from the fetched hospital list
  const availableSpecialities = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach((h) => {
      h.specialties?.forEach((s) => {
        const trimmed = s.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [hospitals]);

  // Filter hospitals by search (name/city/area) and selected speciality
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hospitals.filter((h) => {
      const matchesSearch =
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q);

      const matchesSpeciality =
        selectedSpeciality === 'all' ||
        (h.specialties &&
          h.specialties.some((s) => s.toLowerCase() === selectedSpeciality.toLowerCase()));

      return matchesSearch && matchesSpeciality;
    });
  }, [hospitals, search, selectedSpeciality]);

  // Reset to first page whenever search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedSpeciality]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedHospitals = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const resetFilters = () => {
    setSearch('');
    setSelectedSpeciality('all');
    setPage(1);
  };

  return (
    <AdminLayout title="Hospitals">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-5 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search by Name or City */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 pr-9 py-2 text-sm w-full"
              placeholder="Search by hospital name or city..."
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

          {/* Speciality Filter */}
          {availableSpecialities.length > 0 && (
            <div className="relative min-w-[180px] sm:max-w-xs">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={selectedSpeciality}
                onChange={(e) => setSelectedSpeciality(e.target.value)}
                className="input-field pl-9 py-2 text-sm w-full appearance-none bg-white cursor-pointer"
                aria-label="Filter by speciality"
              >
                <option value="all">All Specialities ({availableSpecialities.length})</option>
                {availableSpecialities.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={() => loadHospitals(true)}
            disabled={loading || refreshing}
            className="btn-secondary text-sm flex items-center gap-1.5 whitespace-nowrap"
            title="Refresh hospital data from API"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Result Count and Active Filters Header */}
      {!loading && !error && hospitals.length > 0 && (
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 mb-4 px-1">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-gray-800">{filtered.length}</strong> of{' '}
              <strong className="text-gray-800">{hospitals.length}</strong> hospitals
            </span>
            {(search || selectedSpeciality !== 'all') && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-brand-600 hover:text-brand-800 font-semibold underline ml-1"
              >
                Reset filters
              </button>
            )}
          </div>
          {totalPages > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="hospital-skeletons">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-50">
                <div className="h-5 bg-gray-200 rounded-full w-16" />
                <div className="h-5 bg-gray-200 rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry Button */}
      {!loading && error && (
        <div className="card p-10 text-center max-w-lg mx-auto border-red-200 bg-red-50/50 my-8">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">Failed to Load Hospital Directory</h3>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => loadHospitals(true)}
            className="btn-primary inline-flex items-center gap-2 mx-auto text-sm"
          >
            <RotateCw className="w-4 h-4" /> Retry Connection
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="card p-12 text-center text-gray-500 max-w-md mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <HospitalIcon className="w-6 h-6" />
          </div>
          <p className="font-semibold text-gray-800 text-base mb-1">No hospitals found</p>
          <p className="text-xs text-gray-500 mb-4">
            {search || selectedSpeciality !== 'all'
              ? 'No hospitals match your search query or speciality filter.'
              : 'The hospital directory returned no results.'}
          </p>
          {(search || selectedSpeciality !== 'all') && (
            <button type="button" onClick={resetFilters} className="btn-secondary text-xs">
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Hospital Cards Grid */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedHospitals.map((h) => (
              <div
                key={h.id}
                className="card p-5 hover:shadow-card-hover transition-shadow flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                      <HospitalIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate" title={h.name}>
                        {h.name}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0 text-gray-400" />
                        <span className="truncate">{h.area ? `${h.area}, ${h.city}` : h.city}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {h.emergency && (
                        <span className="status-badge bg-red-50 text-brand-700 border border-brand-200 text-[10px]">
                          ER
                        </span>
                      )}
                      {h.rating != null && (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {h.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hospital Details */}
                  <div className="space-y-2 text-sm pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Facility Type</span>
                      <span className="font-semibold text-gray-800 px-2 py-0.5 rounded bg-gray-100 text-[11px]">
                        {h.type || 'General'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Capacity</span>
                      <span className="font-semibold text-gray-900 flex items-center gap-1">
                        <BedDouble className="w-3.5 h-3.5 text-gray-400" />
                        {h.beds > 0 ? `${h.beds} beds` : 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Contact</span>
                      {h.phone ? (
                        <a
                          href={`tel:${h.phone.replace(/[^+\d]/g, '')}`}
                          className="font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> {h.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">Not provided</span>
                      )}
                    </div>

                    {h.address && (
                      <p className="text-[11px] text-gray-500 line-clamp-2 pt-1 border-t border-gray-50" title={h.address}>
                        {h.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Specialties Tag Cloud */}
                {h.specialties && h.specialties.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium mb-1.5">
                      <Stethoscope className="w-3 h-3 text-brand-500" />
                      <span>Specialities</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {h.specialties.slice(0, 3).map((spec, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium"
                        >
                          {spec}
                        </span>
                      ))}
                      {h.specialties.length > 3 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium"
                          title={h.specialties.slice(3).join(', ')}
                        >
                          +{h.specialties.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 mt-6 pt-4 text-sm text-gray-600">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-xs font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
