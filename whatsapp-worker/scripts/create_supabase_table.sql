-- Create WhatsApp sessions table in Supabase
-- Run this script in your Supabase SQL editor

-- Create the whatsapp_sessions table
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(255) UNIQUE NOT NULL,
    session_data JSONB NOT NULL,
    authenticated BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_name 
ON public.whatsapp_sessions(session_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_last_seen 
ON public.whatsapp_sessions(last_seen);

-- Enable Row Level Security (RLS)
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (full access)
CREATE POLICY "Service role can manage all sessions" 
ON public.whatsapp_sessions 
FOR ALL 
TO service_role 
USING (true);

-- Create policy for authenticated users (read their own sessions only)
CREATE POLICY "Users can view their own sessions" 
ON public.whatsapp_sessions 
FOR SELECT 
TO authenticated 
USING (session_name = auth.jwt() ->> 'sub' OR session_name = auth.jwt() ->> 'email');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_whatsapp_sessions_updated_at 
    BEFORE UPDATE ON public.whatsapp_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create function to cleanup old sessions
CREATE OR REPLACE FUNCTION cleanup_old_whatsapp_sessions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.whatsapp_sessions 
    WHERE last_seen < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on cleanup function to service role
GRANT EXECUTE ON FUNCTION cleanup_old_whatsapp_sessions(INTEGER) TO service_role;

-- Insert a comment to track when this was created
COMMENT ON TABLE public.whatsapp_sessions IS 'Stores WhatsApp Web.js authentication sessions for cloud deployment';

-- Display success message
SELECT 'WhatsApp sessions table created successfully!' as result;