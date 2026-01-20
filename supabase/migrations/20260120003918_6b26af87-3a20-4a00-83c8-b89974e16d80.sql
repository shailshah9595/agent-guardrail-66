-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (links users to orgs)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email TEXT,
    full_name TEXT,
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table for RBAC
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Environments table (dev/staging/prod)
CREATE TABLE public.environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('development', 'staging', 'production')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, name)
);

-- API Keys table (store hashed secret only)
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

-- Policy status enum
CREATE TYPE public.policy_status AS ENUM ('draft', 'published', 'archived');

-- Policies table
CREATE TABLE public.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status policy_status NOT NULL DEFAULT 'draft',
    policy_spec JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- Execution sessions table
CREATE TABLE public.execution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    current_state TEXT DEFAULT 'initial',
    counters JSONB DEFAULT '{}',
    tool_calls_history TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (env_id, session_id)
);

-- Tool call decision enum
CREATE TYPE public.decision_type AS ENUM ('allowed', 'blocked');

-- Tool call logs table
CREATE TABLE public.tool_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_session_id UUID NOT NULL REFERENCES public.execution_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    tool_name TEXT NOT NULL,
    action_type TEXT,
    payload_redacted JSONB DEFAULT '{}',
    decision decision_type NOT NULL,
    decision_reasons TEXT[] NOT NULL DEFAULT '{}',
    policy_version_used INTEGER,
    state_before TEXT,
    state_after TEXT,
    counters_before JSONB DEFAULT '{}',
    counters_after JSONB DEFAULT '{}'
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_call_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT org_id FROM public.profiles WHERE user_id = _user_id
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their org"
    ON public.organizations FOR SELECT
    TO authenticated
    USING (id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update their org"
    ON public.organizations FOR UPDATE
    TO authenticated
    USING (id = public.get_user_org_id(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- RLS Policies for projects
CREATE POLICY "Users can view projects in their org"
    ON public.projects FOR SELECT
    TO authenticated
    USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create projects in their org"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update projects in their org"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete projects in their org"
    ON public.projects FOR DELETE
    TO authenticated
    USING (org_id = public.get_user_org_id(auth.uid()));

-- RLS Policies for environments
CREATE POLICY "Users can view environments in their org projects"
    ON public.environments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can create environments in their org projects"
    ON public.environments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can update environments in their org projects"
    ON public.environments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can delete environments in their org projects"
    ON public.environments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

-- RLS Policies for api_keys
CREATE POLICY "Users can view api_keys in their environments"
    ON public.api_keys FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can create api_keys in their environments"
    ON public.api_keys FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can update api_keys in their environments"
    ON public.api_keys FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

-- RLS Policies for policies
CREATE POLICY "Users can view policies in their environments"
    ON public.policies FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can create policies in their environments"
    ON public.policies FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can update policies in their environments"
    ON public.policies FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

CREATE POLICY "Users can delete policies in their environments"
    ON public.policies FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

-- RLS Policies for execution_sessions
CREATE POLICY "Users can view execution_sessions in their environments"
    ON public.execution_sessions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.environments e
            JOIN public.projects p ON p.id = e.project_id
            WHERE e.id = env_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

-- RLS Policies for tool_call_logs
CREATE POLICY "Users can view tool_call_logs in their sessions"
    ON public.tool_call_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.execution_sessions es
            JOIN public.environments e ON e.id = es.env_id
            JOIN public.projects p ON p.id = e.project_id
            WHERE es.id = execution_session_id
            AND p.org_id = public.get_user_org_id(auth.uid())
        )
    );

-- Trigger function to auto-create profile and org on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create a new organization for the user
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Organization')
    RETURNING id INTO new_org_id;
    
    -- Create profile linked to user and org
    INSERT INTO public.profiles (user_id, email, full_name, org_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
        new_org_id
    );
    
    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_policies_updated_at
    BEFORE UPDATE ON public.policies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_execution_sessions_updated_at
    BEFORE UPDATE ON public.execution_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX idx_projects_org_id ON public.projects(org_id);
CREATE INDEX idx_environments_project_id ON public.environments(project_id);
CREATE INDEX idx_api_keys_env_id ON public.api_keys(env_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_policies_env_id ON public.policies(env_id);
CREATE INDEX idx_policies_status ON public.policies(status);
CREATE INDEX idx_execution_sessions_env_id ON public.execution_sessions(env_id);
CREATE INDEX idx_execution_sessions_session_id ON public.execution_sessions(session_id);
CREATE INDEX idx_tool_call_logs_session_id ON public.tool_call_logs(execution_session_id);
CREATE INDEX idx_tool_call_logs_timestamp ON public.tool_call_logs(timestamp DESC);