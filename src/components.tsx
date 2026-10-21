import type { ComponentType, ReactNode } from 'react';
import { useEffect } from 'react';
import { MdClose } from 'react-icons/md';

export type ThemeColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';

/** NumberWidget asli dari react-reduction (src/components/Widget/NumberWidget.js). */
export function Stat({
  title,
  value,
  hint,
  color = 'primary',
  progress = 75,
  progressLabel,
}: {
  title: string;
  value: ReactNode;
  hint: ReactNode;
  icon?: string;
  color?: ThemeColor;
  progress?: number;
  progressLabel?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="card card-body">
      <div className="d-flex justify-content-between">
        <div>
          <p className="mb-0">
            <strong>{title}</strong>
          </p>
          <p className="mb-0 text-muted small">{hint}</p>
        </div>
        <h4 className={`mb-0 text-${color}`}>{value}</h4>
      </div>
      <div className="progress my-2" style={{ height: '8px' }}>
        <div
          className={`progress-bar bg-${color}`}
          role="progressbar"
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="d-flex justify-content-between text-muted small">
        <span>{progressLabel ?? 'Bulan ini'}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

/** IconWidget asli dari react-reduction (src/components/Widget/IconWidget.js). */
export function IconWidget({
  Icon,
  title,
  subtitle,
  bgColor = 'primary',
  onClick,
}: {
  Icon: ComponentType<{ size?: number; className?: string }>;
  title: ReactNode;
  subtitle: ReactNode;
  bgColor?: ThemeColor | 'white';
  onClick?: () => void;
}) {
  const inverse = bgColor !== 'white';
  return (
    <div
      className={`card card-body cr-widget ${inverse ? `text-white bg-${bgColor}` : 'bg-white'}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="cr-widget__icon">
        <Icon size={50} />
      </div>
      <div className="cr-widget__body">
        <h5 className="card-title mb-1">{title}</h5>
        <h6 className="card-subtitle mb-0">{subtitle}</h6>
      </div>
    </div>
  );
}

/** SupportTicket item dari react-reduction (src/components/SupportTicket.js). */
export function Complaint({
  title,
  meta,
  state,
  red = false,
  done = false,
  onClick,
}: {
  title: string;
  meta: string;
  state: string;
  red?: boolean;
  done?: boolean;
  onClick?: () => void;
}) {
  const badgeColor = done ? 'success' : red ? 'danger' : 'warning';
  return (
    <div className="cr-ticket">
      <div className="cr-ticket__left">
        <img src="/img/user.jpg" alt="" className="cr-avatar cr-avatar--sm mr-2" />
        <div>
          <div className="cr-ticket__title">{title}</div>
          <small className="text-muted">{meta}</small>
        </div>
      </div>
      <div className="cr-ticket__right">
        <span className={`badge badge-${badgeColor}`}>{state}</span>
        {onClick && (
          <button type="button" className="btn btn-sm btn-outline-secondary ml-2" onClick={onClick}>
            Buka
          </button>
        )}
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? 'invalid' : ''}`}>
      <span className="flabel">{label}</span>
      {children}
      {error ? <span className="ferror" role="alert">{error}</span> : hint ? <span className="fhint">{hint}</span> : null}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>{title}</strong>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Tutup">
            <MdClose size={20} />
          </button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: 'Kosong' | 'Terisi' }) {
  return <span className={`badge badge-${status === 'Kosong' ? 'success' : 'primary'}`}>{status}</span>;
}
