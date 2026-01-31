import { useState } from 'react';
import { AlertTriangle, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PublishConfirmDialogProps {
  policyName: string;
  environmentName: string;
  currentVersion: number;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}

/**
 * PublishConfirmDialog
 * 
 * ENTERPRISE READINESS: Requires explicit confirmation before publishing.
 * Warns that this affects production agents.
 */
export function PublishConfirmDialog({
  policyName,
  environmentName,
  currentVersion,
  onConfirm,
  disabled,
}: PublishConfirmDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [open, setOpen] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPublishing(false);
      setConfirmed(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled}>
          <Upload className="h-4 w-4 mr-2" />
          Publish
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Publish Policy to Production
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              You are about to publish <strong>{policyName}</strong> to the{' '}
              <strong>{environmentName}</strong> environment.
            </p>
            
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-sm">
              <p className="font-medium text-warning mb-2">⚠️ This action affects production agents</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>New sessions will use version {currentVersion + 1}</li>
                <li>Existing sessions will continue using their locked version</li>
                <li>This version will be immutably recorded for audit</li>
                <li>Policy changes take effect immediately for new tool calls</li>
              </ul>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="confirm-publish"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label 
                htmlFor="confirm-publish" 
                className="text-sm font-normal cursor-pointer"
              >
                I understand this will affect production agents
              </Label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={publishing}>Cancel</AlertDialogCancel>
          <Button
            onClick={handlePublish}
            disabled={!confirmed || publishing}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {publishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Publishing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Publish v{currentVersion + 1}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
