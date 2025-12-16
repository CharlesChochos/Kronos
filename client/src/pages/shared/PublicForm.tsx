import { useState, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { usePublicForm, useSubmitPublicForm, type FormField } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, FileText, Send, Upload, X, File, Loader2 } from "lucide-react";

export default function PublicForm() {
  const params = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken;
  const { data: form, isLoading, error } = usePublicForm(shareToken);
  const submitForm = useSubmitPublicForm();
  const [, setLocation] = useLocation();

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateResponse = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  };

  const shouldShowField = (field: FormField): boolean => {
    if (!field.showWhen) return true;
    const triggerValue = responses[field.showWhen.fieldId];
    const conditionValue = field.showWhen.value;
    
    switch (field.showWhen.operator) {
      case 'equals':
        return triggerValue === conditionValue || (Array.isArray(triggerValue) && triggerValue.includes(conditionValue));
      case 'not_equals':
        return triggerValue !== conditionValue && (!Array.isArray(triggerValue) || !triggerValue.includes(conditionValue));
      case 'contains':
        return Array.isArray(triggerValue) ? triggerValue.includes(conditionValue) : String(triggerValue || '').includes(conditionValue);
      default:
        return true;
    }
  };

  const visibleFields = useMemo(() => {
    return (form?.fields || []).filter(shouldShowField);
  }, [form?.fields, responses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = visibleFields.filter(f => f.required && f.type !== 'heading' && f.type !== 'content' && f.type !== 'table');
    for (const field of requiredFields) {
      const value = responses[field.id];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        toast.error(`Please fill in "${field.label}"`);
        return;
      }
    }

    try {
      const responseArray = Object.entries(responses).map(([fieldId, value]) => ({
        fieldId,
        value,
      }));

      await submitForm.mutateAsync({
        shareToken: shareToken!,
        responses: responseArray,
        submitterName: submitterName || undefined,
        submitterEmail: submitterEmail || undefined,
      });

      setSubmitted(true);
      toast.success("Form submitted successfully");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#5c4f3d]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading form...</span>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-sm border border-[#e5ddd0] p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-[#8b7355]" />
          <h2 className="text-xl font-semibold mb-2 text-[#3d3428]">Form Not Found</h2>
          <p className="text-[#6b5d4d]">This form may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-[#e5ddd0] p-12 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
          <h2 className="text-2xl font-semibold mb-2 text-[#3d3428]">Thank You!</h2>
          <p className="text-[#6b5d4d]">Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {form.coverImage && (
          <div className="h-20 rounded-t-lg overflow-hidden mb-0">
            <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className={`bg-white shadow-sm border border-[#e5ddd0] ${form.coverImage ? 'rounded-b-lg' : 'rounded-lg'}`}>
          <div className="p-8 border-b border-[#e5ddd0]">
            <h1 className="text-2xl font-bold text-[#3d3428]" data-testid="form-title">{form.title}</h1>
            {form.description && (
              <p className="text-[#6b5d4d] mt-3 leading-relaxed">{form.description}</p>
            )}
          </div>
          
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="submitter-name" className="text-[#3d3428] font-medium">Your Name (optional)</Label>
                  <Input
                    id="submitter-name"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    placeholder="Enter your name"
                    className="mt-1.5 border-[#d4cbc0] focus:border-[#8b7355] focus:ring-[#8b7355]"
                    data-testid="input-submitter-name"
                  />
                </div>
                <div>
                  <Label htmlFor="submitter-email" className="text-[#3d3428] font-medium">Your Email (optional)</Label>
                  <Input
                    id="submitter-email"
                    type="email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="mt-1.5 border-[#d4cbc0] focus:border-[#8b7355] focus:ring-[#8b7355]"
                    data-testid="input-submitter-email"
                  />
                </div>
              </div>

              {visibleFields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={responses[field.id]}
                  onChange={(value) => updateResponse(field.id, value)}
                  shareToken={shareToken}
                />
              ))}

              <Button
                type="submit"
                className="w-full bg-[#5c4f3d] hover:bg-[#4a3f31] text-white"
                size="lg"
                disabled={submitForm.isPending}
                data-testid="button-submit-form"
              >
                {submitForm.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-[#8b7355] mt-6">
          Powered by Kronos
        </p>
      </div>
    </div>
  );
}

interface UploadedFileData {
  name: string;
  size: number;
  type: string;
  objectPath: string; // Storage path reference
}

function FieldRenderer({ field, value, onChange, shareToken }: { field: FormField; value: any; onChange: (value: any) => void; shareToken?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileData[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  if (field.type === 'heading') {
    return (
      <div className="pt-6 border-t border-[#e5ddd0]">
        <h3 className="text-lg font-semibold text-[#3d3428]" data-testid={`heading-${field.id}`}>{field.label}</h3>
        {field.description && <p className="text-[#6b5d4d] text-sm mt-1">{field.description}</p>}
      </div>
    );
  }

  if (field.type === 'content') {
    return (
      <div className="py-3 px-4 bg-[#faf7f2] rounded-md border border-[#e5ddd0]">
        <h4 className="font-medium text-[#3d3428] mb-2">{field.label}</h4>
        <div className="text-[#6b5d4d] text-sm space-y-2">
          {field.contentBlocks?.map((block, bi) => (
            <div key={bi}>
              {block.type === 'heading' && <h5 className="font-semibold text-[#3d3428]">{block.text}</h5>}
              {block.type === 'paragraph' && <p>{block.text}</p>}
              {block.type === 'list' && (
                <ul className="list-disc pl-5 space-y-1">
                  {block.items?.map((item, ii) => <li key={ii}>{item}</li>)}
                </ul>
              )}
              {block.type === 'link' && (
                <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-[#8b5a2b] underline hover:no-underline">
                  {block.linkText}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'table') {
    return (
      <div className="py-2">
        <Label className="font-medium text-[#3d3428]">{field.label}</Label>
        {field.description && <p className="text-[#6b5d4d] text-sm mt-1 mb-2">{field.description}</p>}
        <div className="border border-[#d4cbc0] rounded-md overflow-x-auto mt-2 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f5f0e8]">
              <tr>
                {field.tableColumns?.map((col) => (
                  <th key={col.id} className="p-3 text-left font-medium text-[#3d3428] border-r border-[#e5ddd0] last:border-r-0">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.tableRows?.map((row, ri) => (
                <tr key={ri} className="border-t border-[#e5ddd0]">
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-3 text-[#5c4f3d] border-r border-[#e5ddd0] last:border-r-0">
                      {cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const labelElement = (
    <Label htmlFor={field.id} className="flex items-center gap-1 text-[#3d3428] font-medium">
      {field.label}
      {field.required && <span className="text-red-600">*</span>}
    </Label>
  );

  const descriptionElement = field.description ? (
    <p className="text-sm text-[#8b7355] mt-1">{field.description}</p>
  ) : null;

  const inputClassName = "mt-1.5 border-[#d4cbc0] bg-white focus:border-[#8b7355] focus:ring-[#8b7355]";

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !shareToken) return;

    setIsUploading(true);
    const newFiles: UploadedFileData[] = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit per file
    
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds 10MB limit, skipping`);
        continue;
      }
      
      try {
        // Get presigned URL from server
        const urlResponse = await fetch(`/api/public/forms/${shareToken}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filename: file.name,
            size: file.size,
            type: file.type 
          }),
        });
        
        if (!urlResponse.ok) {
          const error = await urlResponse.json();
          throw new Error(error.error || 'Failed to get upload URL');
        }
        
        const { uploadURL, objectPath } = await urlResponse.json();
        
        // Upload file to object storage
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.open('PUT', uploadURL);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });
        
        // Confirm upload
        await fetch(`/api/public/forms/${shareToken}/upload/confirm`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectPath, filename: file.name, size: file.size, type: file.type }),
        });
        
        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          objectPath
        });
      } catch (error: any) {
        console.error(`Failed to upload file ${file.name}:`, error);
      }
    }
    
    const allFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(allFiles);
    // Store file references (not content) in the form value
    onChange(allFiles);
    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileName: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.name !== fileName);
    setUploadedFiles(updatedFiles);
    onChange(updatedFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  switch (field.type) {
    case 'text':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <Input
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputClassName}
            data-testid={`input-${field.id}`}
          />
        </div>
      );

    case 'textarea':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <Textarea
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={inputClassName}
            rows={4}
            data-testid={`input-${field.id}`}
          />
        </div>
      );

    case 'email':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <Input
            id={field.id}
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || "Enter email address"}
            className={inputClassName}
            data-testid={`input-${field.id}`}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <Input
            id={field.id}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || "Enter number"}
            className={inputClassName}
            data-testid={`input-${field.id}`}
          />
        </div>
      );

    case 'date':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <Input
            id={field.id}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={inputClassName}
            data-testid={`input-${field.id}`}
          />
        </div>
      );

    case 'single-select':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className={`mt-1.5 border-[#d4cbc0] bg-white ${value ? '' : 'text-[#8b7355]'}`} data-testid={`select-${field.id}`}>
              <SelectValue placeholder={field.placeholder || "Choose one..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'multi-select':
      const selected = Array.isArray(value) ? value : [];
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <div className="space-y-2 mt-2">
            {field.options?.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-${opt}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selected, opt]);
                    } else {
                      onChange(selected.filter((s: string) => s !== opt));
                    }
                  }}
                  className="border-[#d4cbc0] data-[state=checked]:bg-[#5c4f3d] data-[state=checked]:border-[#5c4f3d]"
                  data-testid={`checkbox-${field.id}-${opt}`}
                />
                <Label htmlFor={`${field.id}-${opt}`} className="font-normal text-[#5c4f3d]">{opt}</Label>
              </div>
            ))}
          </div>
        </div>
      );

    case 'file':
      return (
        <div>
          {labelElement}
          {descriptionElement}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            data-testid={`file-input-${field.id}`}
          />
          <div 
            className="border-2 border-dashed border-[#d4cbc0] rounded-lg p-6 text-center mt-1.5 cursor-pointer hover:border-[#8b7355] hover:bg-[#faf7f2] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-[#8b7355] animate-spin" />
            ) : (
              <Upload className="h-8 w-8 mx-auto mb-2 text-[#8b7355]" />
            )}
            <p className="text-sm text-[#5c4f3d] font-medium">
              {isUploading ? 'Uploading...' : 'Click to upload files'}
            </p>
            <p className="text-xs text-[#8b7355] mt-1">Drag and drop or click to browse</p>
          </div>
          {uploadedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-[#faf7f2] rounded border border-[#e5ddd0]">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-[#8b7355]" />
                    <span className="text-sm text-[#5c4f3d]">{file.name}</span>
                    <span className="text-xs text-[#8b7355]">({formatFileSize(file.size)})</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-[#8b7355] hover:text-red-600"
                    onClick={() => removeFile(file.name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}
