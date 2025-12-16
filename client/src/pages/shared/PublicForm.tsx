import { useState, useMemo } from "react";
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
import { CheckCircle2, FileText, Send, Upload } from "lucide-react";

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <p className="text-muted-foreground">Loading form...</p>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Form Not Found</h2>
            <p className="text-muted-foreground">This form may have been removed or the link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">Your response has been submitted successfully.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {form.coverImage && (
          <div className="h-48 rounded-t-xl overflow-hidden mb-0">
            <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        
        <Card className={form.coverImage ? "rounded-t-none" : ""}>
          <CardHeader className="border-b">
            <CardTitle className="text-2xl" data-testid="form-title">{form.title}</CardTitle>
            {form.description && (
              <CardDescription className="text-base">{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="submitter-name">Your Name (optional)</Label>
                  <Input
                    id="submitter-name"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    placeholder="Enter your name"
                    data-testid="input-submitter-name"
                  />
                </div>
                <div>
                  <Label htmlFor="submitter-email">Your Email (optional)</Label>
                  <Input
                    id="submitter-email"
                    type="email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    placeholder="Enter your email"
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
                />
              ))}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitForm.isPending}
                data-testid="button-submit-form"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitForm.isPending ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Powered by Kronos
        </p>
      </div>
    </div>
  );
}

function FieldRenderer({ field, value, onChange }: { field: FormField; value: any; onChange: (value: any) => void }) {
  if (field.type === 'heading') {
    return (
      <div className="pt-4 border-t">
        <h3 className="text-lg font-semibold" data-testid={`heading-${field.id}`}>{field.label}</h3>
        {field.description && <p className="text-muted-foreground text-sm mt-1">{field.description}</p>}
      </div>
    );
  }

  if (field.type === 'content') {
    return (
      <div className="py-2">
        <h4 className="font-medium text-base mb-2">{field.label}</h4>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          {field.contentBlocks?.map((block, bi) => (
            <div key={bi}>
              {block.type === 'heading' && <h5 className="font-semibold text-foreground">{block.text}</h5>}
              {block.type === 'paragraph' && <p>{block.text}</p>}
              {block.type === 'list' && (
                <ul className="list-disc pl-5">
                  {block.items?.map((item, ii) => <li key={ii}>{item}</li>)}
                </ul>
              )}
              {block.type === 'link' && (
                <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
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
        <Label className="font-medium">{field.label}</Label>
        {field.description && <p className="text-muted-foreground text-sm mt-1 mb-2">{field.description}</p>}
        <div className="border rounded-md overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {field.tableColumns?.map((col) => (
                  <th key={col.id} className="p-3 text-left font-medium border-r last:border-r-0">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.tableRows?.map((row, ri) => (
                <tr key={ri} className="border-t">
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-3 border-r last:border-r-0">
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
    <Label htmlFor={field.id} className="flex items-center gap-1">
      {field.label}
      {field.required && <span className="text-destructive">*</span>}
    </Label>
  );

  const descriptionElement = field.description ? (
    <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
  ) : null;

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
            className="mt-1"
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
            className="mt-1"
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
            className="mt-1"
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
            className="mt-1"
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
            className="mt-1"
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
            <SelectTrigger className="mt-1" data-testid={`select-${field.id}`}>
              <SelectValue placeholder={field.placeholder || "Select an option"} />
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
                  data-testid={`checkbox-${field.id}-${opt}`}
                />
                <Label htmlFor={`${field.id}-${opt}`} className="font-normal">{opt}</Label>
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
          <div className="border-2 border-dashed rounded-lg p-6 text-center mt-1">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">File upload coming soon</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}
