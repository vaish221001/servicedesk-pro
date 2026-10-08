import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import assetService from '../services/assetService.js';
import ticketService from '../services/ticketService.js';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Alert from '../components/ui/Alert';

import EditAssetModal from '../components/assets/EditAssetModal';
import AssignAssetModal from '../components/assets/AssignAssetModal';
import ReturnAssetModal from '../components/assets/ReturnAssetModal';

import {
  ArrowLeft,
  Edit,
  UserCheck,
  RotateCcw,
  Trash2,
  Building2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Ticket,
} from 'lucide-react';

export const AssetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';
  const canManage = ['SYSTEM_ADMIN', 'ASSET_MANAGER'].includes(user?.role);

  const [asset, setAsset] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [linkedTickets, setLinkedTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // Load Asset Details, Assignment History, and Linked Tickets
  const loadAssetData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const assetRes = await assetService.getAssetById(id);
      if (assetRes && assetRes.success) {
        setAsset(assetRes.data);
      }

      // If user has permission, load assignment history
      if (!isEmployee) {
        try {
          const assignRes = await assetService.getAssetAssignments(id);
          if (assignRes && assignRes.success) {
            setAssignments(assignRes.data || []);
          }
        } catch {
          // assignment history might be empty or restricted
        }

        try {
          const tRes = await ticketService.getTickets({ limit: 50 });
          if (tRes && tRes.success) {
            const matches = (tRes.data || []).filter(
              (t) => t.relatedAssetId?._id === id || t.relatedAssetId === id
            );
            setLinkedTickets(matches);
          }
        } catch {
          // tickets fail-safe
        }
      }
    } catch (err) {
      console.error('Failed to load asset details:', err);
      setError(err.message || 'Failed to load asset details');
    } finally {
      setIsLoading(false);
    }
  }, [id, isEmployee]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const assetRes = await assetService.getAssetById(id);
        if (!ignore && assetRes && assetRes.success) {
          setAsset(assetRes.data);
        }

        if (!ignore && !isEmployee) {
          try {
            const assignRes = await assetService.getAssetAssignments(id);
            if (!ignore && assignRes && assignRes.success) {
              setAssignments(assignRes.data || []);
            }
          } catch {
            // ignore
          }

          try {
            const tRes = await ticketService.getTickets({ limit: 50 });
            if (!ignore && tRes && tRes.success) {
              const matches = (tRes.data || []).filter(
                (t) => t.relatedAssetId?._id === id || t.relatedAssetId === id
              );
              setLinkedTickets(matches);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load asset details:', err);
          setError(err.message || 'Failed to load asset details');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [id, isEmployee]);

  const handleDeleteAsset = async () => {
    if (!window.confirm(`Are you sure you want to deactivate and retire asset ${asset.assetTag}?`)) {
      return;
    }
    try {
      await assetService.deleteAsset(asset._id);
      navigate('/assets');
    } catch (err) {
      setError(err.message || 'Failed to deactivate asset');
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <LoadingSpinner size="lg" color="primary" />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Retrieving hardware specifications and custody logs...
        </p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto' }}>
        <Alert variant="error" title="Asset Error">
          {error || 'The requested asset could not be found or you do not have permission to view it.'}
        </Alert>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Button variant="secondary" onClick={() => navigate('/assets')} icon={<ArrowLeft size={16} />}>
            Return to Inventory Directory
          </Button>
        </div>
      </div>
    );
  }

  const isAssigned = asset.status === 'ASSIGNED' && asset.currentAssigneeId;
  const isWarrantyActive = asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Breadcrumb & Action Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link
            to="/assets"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back to Inventory
          </Link>

          {/* Action Toolbar */}
          {!isEmployee && canManage && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditOpen(true)}
                icon={<Edit size={14} />}
              >
                Edit Asset
              </Button>

              {isAssigned ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsReturnOpen(true)}
                  icon={<RotateCcw size={14} />}
                >
                  Check In / Return
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAssignOpen(true)}
                  icon={<UserCheck size={14} />}
                  disabled={asset.status === 'RETIRED' || asset.status === 'DISPOSED'}
                >
                  Check Out / Assign
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAsset}
                icon={<Trash2 size={14} style={{ color: 'var(--color-rose-600)' }} />}
                disabled={isAssigned}
              >
                Deactivate
              </Button>
            </div>
          )}
        </div>

        {/* Title & Metadata Badges */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-primary-600)', fontFamily: 'var(--font-mono)' }}>
              {asset.assetTag}
            </span>
            <Badge variant="status">{asset.status}</Badge>
            <Badge color="slate">{asset.assetType}</Badge>
            {asset.category && <Badge color="indigo">{asset.category}</Badge>}
            {asset.departmentId && <Badge color="blue">{asset.departmentId.name}</Badge>}
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {asset.name}
          </h2>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '1.5rem',
        }}
        className="dashboard-columns"
      >
        {/* Left Column: Specifications, Timeline History, Linked Tickets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Technical Specifications Card */}
          <Card>
            <CardHeader>
              <CardTitle>Hardware & Technical Specifications</CardTitle>
            </CardHeader>
            <CardBody>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.875rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Manufacturer
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {asset.manufacturer || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Model
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {asset.model || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Serial Number
                  </div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {asset.serialNumber || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Assigned Location
                  </div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {asset.location || '—'}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {asset.notes && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Configuration & Notes
                  </div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {asset.notes}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Assignment History Timeline Card (Staff Only) */}
          {!isEmployee && (
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} style={{ color: 'var(--color-primary-600)' }} />
                  <CardTitle>Custody & Assignment History ({assignments.length})</CardTitle>
                </div>
              </CardHeader>
              <CardBody>
                {assignments.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    No assignment transitions recorded in the immutable audit log yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {assignments.map((asgn) => {
                      const targetUser = asgn.assignedTo;
                      const author = asgn.assignedBy;
                      const targetName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : 'Unknown';
                      const authorName = author ? `${author.firstName} ${author.lastName}` : 'System';

                      return (
                        <div
                          key={asgn._id}
                          style={{
                            padding: '0.875rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: asgn.returnedAt ? 'var(--color-slate-50)' : '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                {targetName}
                              </span>
                              <Badge color={asgn.returnedAt ? 'slate' : 'emerald'}>
                                {asgn.returnedAt ? 'Returned' : 'Current Custody'}
                              </Badge>
                            </div>

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Checked out: {new Date(asgn.assignedAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Authorized by {authorName}
                            {asgn.returnedAt && (
                              <span> • Returned on {new Date(asgn.returnedAt).toLocaleDateString()} (Condition: {asgn.returnCondition || 'GOOD'})</span>
                            )}
                          </div>

                          {asgn.notes && (
                            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              "{asgn.notes}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Linked Tickets Card (Staff Only) */}
          {!isEmployee && (
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Ticket size={18} style={{ color: 'var(--color-primary-600)' }} />
                  <CardTitle>Linked Helpdesk Tickets ({linkedTickets.length})</CardTitle>
                </div>
              </CardHeader>
              <CardBody>
                {linkedTickets.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    No support tickets currently associated with this device.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {linkedTickets.map((tk) => (
                      <div
                        key={tk._id}
                        onClick={() => navigate(`/tickets/${tk._id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          backgroundColor: '#ffffff',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-50)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-primary-600)' }}>
                            {tk.ticketNumber}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {tk.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Badge variant="status">{tk.status}</Badge>
                          <Badge variant="priority">{tk.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right Column: Custody Status, Financials & Vendor Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Current Custody / Assignment Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Custody Status</CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              {isAssigned ? (
                <>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      Assigned Custodian
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {asset.currentAssigneeId.firstName} {asset.currentAssigneeId.lastName}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem' }}>
                      {asset.currentAssigneeId.email}
                    </div>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      Department
                    </div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {asset.departmentId?.name || 'General Inventory'}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <Badge color="emerald">In Stock</Badge>
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    This asset is currently in inventory and available for assignment.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Warranty & Purchase Card */}
          <Card>
            <CardHeader>
              <CardTitle>Warranty & Procurement</CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Warranty Coverage
                </div>
                {asset.warrantyExpiry ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '4px' }}>
                    {isWarrantyActive ? (
                      <ShieldCheck size={16} style={{ color: 'var(--color-emerald-600)' }} />
                    ) : (
                      <ShieldAlert size={16} style={{ color: 'var(--color-rose-600)' }} />
                    )}
                    <span style={{ fontWeight: 600, color: isWarrantyActive ? 'var(--color-emerald-700)' : 'var(--color-rose-700)' }}>
                      {isWarrantyActive ? 'Active' : 'Expired'}: {new Date(asset.warrantyExpiry).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>No warranty recorded</div>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Procurement Date
                </div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '—'}
                </div>
              </div>

              {asset.purchaseCost !== null && asset.purchaseCost !== undefined && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Purchase Cost
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    ${Number(asset.purchaseCost).toFixed(2)}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Supplier Vendor Card */}
          {asset.vendorId && (
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building2 size={16} style={{ color: 'var(--color-primary-600)' }} />
                  <CardTitle>Supplier Information</CardTitle>
                </div>
              </CardHeader>
              <CardBody style={{ fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {asset.vendorId.name}
                </div>
                {asset.vendorId.contactPerson && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', marginTop: '2px' }}>
                    Contact: {asset.vendorId.contactPerson}
                  </div>
                )}
                {asset.vendorId.email && (
                  <div style={{ color: 'var(--color-primary-600)', fontSize: '0.775rem', marginTop: '2px' }}>
                    {asset.vendorId.email}
                  </div>
                )}
                {asset.vendorId.phone && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', marginTop: '2px' }}>
                    {asset.vendorId.phone}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Asset Modal */}
      {isEditOpen && (
        <EditAssetModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          asset={asset}
          onAssetUpdated={(updated) => setAsset(updated)}
        />
      )}

      {/* Assign Asset Modal */}
      {isAssignOpen && (
        <AssignAssetModal
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          asset={asset}
          onAssigned={(updated) => {
            setAsset(updated);
            loadAssetData();
          }}
        />
      )}

      {/* Return Asset Modal */}
      {isReturnOpen && (
        <ReturnAssetModal
          isOpen={isReturnOpen}
          onClose={() => setIsReturnOpen(false)}
          asset={asset}
          onReturned={(updated) => {
            setAsset(updated);
            loadAssetData();
          }}
        />
      )}
    </div>
  );
};

export default AssetDetailPage;
