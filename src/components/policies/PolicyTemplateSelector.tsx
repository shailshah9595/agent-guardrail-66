import { useState } from 'react';
import { CreditCard, Shield, Settings, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { policyTemplates, PolicyTemplate } from '@/lib/policy-templates';
import { Badge } from '@/components/ui/badge';

interface PolicyTemplateSelectorProps {
  onSelect: (template: PolicyTemplate) => void;
  trigger?: React.ReactNode;
}

const categoryIcons = {
  financial: CreditCard,
  operations: Settings,
  security: Shield,
};

const categoryColors = {
  financial: 'bg-success/10 text-success border-success/20',
  operations: 'bg-primary/10 text-primary border-primary/20',
  security: 'bg-warning/10 text-warning border-warning/20',
};

/**
 * Policy Template Selector
 * 
 * Allows users to start with pre-built templates tailored for
 * financial and operational use cases.
 */
export function PolicyTemplateSelector({ onSelect, trigger }: PolicyTemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (template: PolicyTemplate) => {
    setSelectedId(template.id);
    onSelect(template);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Start from Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Policy Template</DialogTitle>
          <DialogDescription>
            Pre-built policies for common financial and operational patterns.
            Customize after selecting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {policyTemplates.map((template) => {
            const Icon = categoryIcons[template.category];
            const colorClass = categoryColors[template.category];
            
            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedId === template.id ? 'border-primary ring-1 ring-primary' : ''
                }`}
                onClick={() => handleSelect(template)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-1 text-xs capitalize">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                    {selectedId === template.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{template.description}</CardDescription>
                  
                  {/* Template highlights */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {template.spec.toolRules.slice(0, 4).map((rule) => (
                      <span
                        key={rule.toolName}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          rule.effect === 'allow'
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {rule.effect === 'allow' ? '✓' : '✕'} {rule.toolName}
                      </span>
                    ))}
                    {template.spec.toolRules.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{template.spec.toolRules.length - 4} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground mt-4">
          Templates are starting points. You can customize all rules after creation.
        </div>
      </DialogContent>
    </Dialog>
  );
}
