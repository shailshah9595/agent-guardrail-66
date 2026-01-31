import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, Activity, Zap, CheckCircle2, ArrowRight, CreditCard, AlertTriangle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { WhoThisIsFor } from '@/components/landing/WhoThisIsFor';

const features = [
  {
    icon: Lock,
    title: 'Prevent Unauthorized Refunds',
    description: 'Block refund actions until identity verification is complete. No more fraudulent chargebacks from agent mistakes.',
  },
  {
    icon: CreditCard,
    title: 'Guard Payment Actions',
    description: 'Enforce approval workflows before charges. Prevent double-payments with session-level limits and state gates.',
  },
  {
    icon: Activity,
    title: 'Complete Audit Trail',
    description: 'Every payment action logged with decision reasons, state transitions, and policy version for compliance.',
  },
];

const useCases = [
  {
    text: 'Block refund_payment until verify_identity succeeds',
    category: 'Refund Safety',
  },
  {
    text: 'Limit charge_customer to 1 call per session',
    category: 'Double-Charge Prevention',
  },
  {
    text: 'Require orderId and amount fields on all refunds',
    category: 'Data Validation',
  },
  {
    text: 'Deny email_customer more than once per session',
    category: 'Communication Limits',
  },
  {
    text: 'Block all delete_database and drop_table operations',
    category: 'Destructive Action Block',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/projects');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold">Agent Firewall</span>
          </div>
          <Button onClick={handleGetStarted} className="gap-2">
            {user ? 'Go to Dashboard' : 'Get Started'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-glow opacity-50" />
        
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Runtime security for financial agents
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Stop unauthorized{' '}
              <span className="gradient-text">payments and refunds</span>
              {' '}before they happen
            </h1>
            
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Deterministic policy enforcement for AI agents with financial authority. 
              Block unsafe refunds, prevent double-charges, and maintain complete audit trails.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/quickstart')} className="gap-2 glow-primary">
                <DollarSign className="h-4 w-4" />
                See Refund Protection Demo
              </Button>
              <Button size="lg" variant="outline" onClick={handleGetStarted}>
                {user ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 border-t border-border bg-gradient-dark">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What you can enforce</h2>
            <p className="text-muted-foreground">
              Define policies once, enforce on every payment action. No more hoping the agent makes the right call.
            </p>
          </div>

          <div className="max-w-xl mx-auto space-y-4">
            {useCases.map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border/50"
              >
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-primary font-medium uppercase tracking-wide">{useCase.category}</span>
                  <p className="text-foreground">{useCase.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <div className="max-w-xl mx-auto">
            <WhoThisIsFor />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border bg-gradient-dark">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Stop agent-caused financial losses</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Ready to secure your payment agents?</h2>
            <p className="text-muted-foreground mb-8">
              Create your first refund protection policy in under 2 minutes.
            </p>
            <Button size="lg" onClick={handleGetStarted} className="gap-2 glow-primary">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span className="text-sm">Agent Firewall</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Runtime security for financial AI agents
          </p>
        </div>
      </footer>
    </div>
  );
}
