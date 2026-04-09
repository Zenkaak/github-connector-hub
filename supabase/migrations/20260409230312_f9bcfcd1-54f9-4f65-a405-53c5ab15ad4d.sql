
-- Harambee application with detailed category questions
CREATE TABLE public.harambee_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('funeral', 'school_fees', 'medical', 'other')),
  beneficiary_name TEXT NOT NULL,
  beneficiary_phone TEXT,
  beneficiary_relationship TEXT NOT NULL,
  description TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  platform_fee_percent NUMERIC NOT NULL DEFAULT 3,
  is_public BOOLEAN NOT NULL DEFAULT true,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending_review',
  category_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  harambee_id UUID REFERENCES public.chama_harambees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.harambee_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own applications"
  ON public.harambee_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own applications"
  ON public.harambee_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all applications"
  ON public.harambee_applications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Documents for harambee verification
CREATE TABLE public.harambee_application_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.harambee_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.harambee_application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own docs"
  ON public.harambee_application_documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own docs"
  ON public.harambee_application_documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all docs"
  ON public.harambee_application_documents FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for harambee verification documents
INSERT INTO storage.buckets (id, name, public) VALUES ('harambee-verification', 'harambee-verification', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload verification docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'harambee-verification' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'harambee-verification' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'harambee-verification' AND has_role(auth.uid(), 'admin'::app_role));
