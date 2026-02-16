import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RunDemoButton } from '@/components/demo/RunDemoButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  environments?: { id: string; name: string }[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          created_at,
          environments (id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: 'Failed to load projects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    setCreating(true);

    try {
      // Get user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          org_id: profile.org_id,
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create default environments
      const { error: envError } = await supabase
        .from('environments')
        .insert([
          { project_id: project.id, name: 'development' },
          { project_id: project.id, name: 'staging' },
          { project_id: project.id, name: 'production' },
        ]);

      if (envError) throw envError;

      toast({
        title: 'Project created',
        description: 'Your project has been created with dev/staging/prod environments.',
      });

      setDialogOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    } catch (error: any) {
      toast({
        title: 'Failed to create project',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <PageHeader
          title="Projects"
          description="Manage your agent firewall projects and environments."
          actions={
            <div className="flex items-center gap-3">
              <RunDemoButton />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                  <DialogDescription>
                    Create a new project with development, staging, and production environments.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input
                      id="projectName"
                      placeholder="My AI Agent"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectDesc">Description (optional)</Label>
                    <Textarea
                      id="projectDesc"
                      placeholder="A brief description of this project..."
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                    />
                  </div>
                  <Button onClick={createProject} disabled={creating || !newProjectName.trim()} className="w-full">
                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Project
                  </Button>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          }
        />

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start defining policies for your AI agents."
            action={{
              label: 'Create Project',
              onClick: () => setDialogOpen(true),
            }}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => navigate(`/environments?project=${project.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-muted-foreground" />
                    {project.name}
                  </CardTitle>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{project.environments?.length || 0} environments</span>
                    <span>•</span>
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
