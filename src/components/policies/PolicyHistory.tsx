import { useState, useEffect } from 'react';
import { History, ChevronRight, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface PolicyVersion {
  id: string;
  version: number;
  policy_spec: Record<string, unknown>;
  policy_hash: string;
  published_at: string;
}

interface PolicyHistoryProps {
  policyId: string;
  currentVersion: number;
}

/**
 * PolicyHistory Component
 * 
 * Displays immutable history of all published policy versions.
 * Allows viewing JSON diff between versions.
 * 
 * ENTERPRISE TRUST: Every published policy is recorded permanently.
 */
export function PolicyHistory({ policyId, currentVersion }: PolicyHistoryProps) {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<[PolicyVersion | null, PolicyVersion | null]>([null, null]);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [policyId]);

  async function loadVersions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('policy_versions')
        .select('*')
        .eq('policy_id', policyId)
        .order('version', { ascending: false });

      if (error) throw error;
      setVersions((data || []) as PolicyVersion[]);
    } catch (error) {
      console.error('Failed to load policy versions:', error);
    } finally {
      setLoading(false);
    }
  }

  function openDiff(v1: PolicyVersion, v2: PolicyVersion) {
    setSelectedVersions([v1, v2]);
    setDiffDialogOpen(true);
  }

  function renderDiff(oldSpec: Record<string, unknown>, newSpec: Record<string, unknown>): React.ReactNode {
    const oldJson = JSON.stringify(oldSpec, null, 2).split('\n');
    const newJson = JSON.stringify(newSpec, null, 2).split('\n');
    
    const maxLines = Math.max(oldJson.length, newJson.length);
    const lines: React.ReactNode[] = [];
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldJson[i] || '';
      const newLine = newJson[i] || '';
      
      if (oldLine !== newLine) {
        if (oldLine) {
          lines.push(
            <div key={`old-${i}`} className="bg-destructive/20 text-destructive px-2 font-mono text-xs">
              - {oldLine}
            </div>
          );
        }
        if (newLine) {
          lines.push(
            <div key={`new-${i}`} className="bg-success/20 text-success px-2 font-mono text-xs">
              + {newLine}
            </div>
          );
        }
      } else {
        lines.push(
          <div key={`same-${i}`} className="px-2 font-mono text-xs text-muted-foreground">
            &nbsp; {oldLine}
          </div>
        );
      }
    }
    
    return lines;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>
            No versions published yet. Publish this policy to create an immutable version record.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>
            Immutable record of all published policy versions. Once published, versions cannot be modified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  version.version === currentVersion 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{version.version}</span>
                      {version.version === currentVersion && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Published {new Date(version.published_at).toLocaleString()}
                    </span>
                    <code className="text-xs text-muted-foreground font-mono">
                      {version.policy_hash.substring(0, 16)}...
                    </code>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {index < versions.length - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDiff(versions[index + 1], version)}
                    >
                      Compare with v{versions[index + 1].version}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={diffDialogOpen} onOpenChange={setDiffDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Policy Diff: v{selectedVersions[0]?.version} → v{selectedVersions[1]?.version}
            </DialogTitle>
            <DialogDescription>
              Comparing policy changes between versions. Red lines were removed, green lines were added.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] rounded border bg-muted/30">
            <div className="p-2">
              {selectedVersions[0] && selectedVersions[1] && 
                renderDiff(selectedVersions[0].policy_spec, selectedVersions[1].policy_spec)
              }
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
