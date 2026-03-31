import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle, Clock, XCircle, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DOCUMENT_TYPES = [
  { value: 'national_id_front', label: 'National ID (Front)' },
  { value: 'national_id_back', label: 'National ID (Back)' },
  { value: 'payslip', label: 'Latest Payslip' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'passport_photo', label: 'Passport Photo' },
  { value: 'other', label: 'Other Document' },
];

interface UserDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  status: string;
  created_at: string;
}

export function DocumentUpload() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setDocuments((data as UserDocument[]) || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docType || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${docType}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('user_documents').insert({
        user_id: user.id,
        document_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast.success('Document uploaded successfully');
      setDocType('');
      if (fileRef.current) fileRef.current.value = '';
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: UserDocument) => {
    try {
      await supabase.storage.from('user-documents').remove([doc.file_path]);
      await supabase.from('user_documents').delete().eq('id', doc.id);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (err: any) {
      toast.error('Failed to delete');
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle size={14} className="text-success" />;
    if (status === 'rejected') return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-accent" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending Review';
  };

  const getTypeLabel = (type: string) =>
    DOCUMENT_TYPES.find((d) => d.value === type)?.label || type;

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <CardTitle className="text-base">My Documents</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        <div className="p-4 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleUpload}
                disabled={!docType || uploading}
                className="hidden"
                id="doc-upload"
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={!docType || uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                ) : (
                  <><Upload size={14} /> Choose File</>
                )}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG up to 5MB. Select document type first.</p>
        </div>

        {/* Documents list */}
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center">
            <FileText size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload your ID, payslips, and other required documents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{getTypeLabel(doc.document_type)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground truncate">{doc.file_name}</span>
                    {doc.file_size && <span className="text-[10px] text-muted-foreground/60">{formatSize(doc.file_size)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                    doc.status === 'approved' && 'bg-success/10 text-success',
                    doc.status === 'rejected' && 'bg-destructive/10 text-destructive',
                    doc.status === 'pending' && 'bg-accent/10 text-accent',
                  )}>
                    {statusIcon(doc.status)} {statusLabel(doc.status)}
                  </span>
                  {doc.status === 'pending' && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(doc)}>
                      <Trash2 size={13} className="text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
