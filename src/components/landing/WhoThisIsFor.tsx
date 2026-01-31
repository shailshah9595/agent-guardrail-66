import { Shield, Users, XCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Positioning panel that clearly explains the target audience.
 * 
 * This filters the right users in: teams with agents that have
 * financial or operational authority. Not for read-only chatbots.
 */
export function WhoThisIsFor() {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Who this is for
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target audience */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Agent Firewall is built for teams running AI agents with{' '}
            <span className="text-foreground font-medium">financial or operational authority</span>.
          </p>
          
          <div className="grid gap-2 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <span>FinTech agents processing payments and refunds</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <span>Marketplace agents managing orders and payouts</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <span>Support agents with refund and account authority</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <span>Internal ops automation with database writes</span>
            </div>
          </div>
        </div>

        {/* What this is NOT for */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">This is NOT for:</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <XCircle className="h-3 w-3 flex-shrink-0" />
              <span>Read-only chatbots or Q&A assistants</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <XCircle className="h-3 w-3 flex-shrink-0" />
              <span>Experimentation without side effects</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <XCircle className="h-3 w-3 flex-shrink-0" />
              <span>Agents that only retrieve information</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
