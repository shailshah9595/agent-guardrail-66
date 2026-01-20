import { cn } from '@/lib/utils';

type Status = 'allowed' | 'blocked' | 'draft' | 'published' | 'archived' | 'development' | 'staging' | 'production';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusStyles: Record<Status, string> = {
  allowed: 'badge-allowed',
  blocked: 'badge-blocked',
  draft: 'badge-draft',
  published: 'badge-published',
  archived: 'bg-muted text-muted-foreground border border-border',
  development: 'bg-primary/10 text-primary border border-primary/20',
  staging: 'bg-warning/10 text-warning border border-warning/20',
  production: 'bg-success/10 text-success border border-success/20',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status],
        className
      )}
    >
      {status}
    </span>
  );
}
