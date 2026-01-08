import OpenAI from "openai";
import { storage } from "./storage";
import type { AiDocumentAnalysis, Deal, DealNote } from "@shared/schema";

// Maximum tokens for context (leaving room for response)
const MAX_CONTEXT_TOKENS = 100000;
const CHARS_PER_TOKEN = 4; // Approximate

export interface DocumentInfo {
  url: string;
  filename: string;
  mimeType?: string;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }
  return new OpenAI({ apiKey });
}

function getAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const host = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Extract text from a document URL
 * Supports PDF (via pdf-parse) and plain text files
 */
async function extractTextFromDocument(doc: DocumentInfo): Promise<string> {
  try {
    console.log(`[AI Doc Analyzer] Extracting text from: ${doc.filename}`);
    
    const absoluteUrl = getAbsoluteUrl(doc.url);
    console.log(`[AI Doc Analyzer] Fetching from: ${absoluteUrl}`);
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }
    
    const contentType = doc.mimeType || response.headers.get('content-type') || '';
    
    // Handle PDF files
    if (contentType.includes('pdf') || doc.filename.toLowerCase().endsWith('.pdf')) {
      const buffer = await response.arrayBuffer();
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(Buffer.from(buffer));
      return pdfData.text;
    }
    
    // Handle text-based files (txt, md, etc.)
    if (contentType.includes('text') || 
        doc.filename.toLowerCase().endsWith('.txt') ||
        doc.filename.toLowerCase().endsWith('.md') ||
        doc.filename.toLowerCase().endsWith('.csv')) {
      return await response.text();
    }
    
    // Handle Word documents (.docx) - basic extraction
    if (contentType.includes('word') || 
        doc.filename.toLowerCase().endsWith('.docx') ||
        doc.filename.toLowerCase().endsWith('.doc')) {
      // For now, try to extract as text - docx is actually a zip with xml
      try {
        const buffer = await response.arrayBuffer();
        // Simple text extraction - in production you'd use a proper docx parser
        const text = Buffer.from(buffer).toString('utf-8');
        // Extract readable text between XML tags
        const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanText.length > 100) {
          return cleanText;
        }
      } catch (e) {
        console.log(`[AI Doc Analyzer] Could not parse Word doc as text`);
      }
    }
    
    // Handle JSON files
    if (contentType.includes('json') || doc.filename.toLowerCase().endsWith('.json')) {
      const jsonText = await response.text();
      return jsonText;
    }
    
    // For Excel files, we'd need xlsx library (already installed)
    if (doc.filename.toLowerCase().endsWith('.xlsx') || doc.filename.toLowerCase().endsWith('.xls')) {
      try {
        const buffer = await response.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'array' });
        let text = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          text += `\n=== Sheet: ${sheetName} ===\n`;
          text += XLSX.utils.sheet_to_csv(sheet);
        });
        return text;
      } catch (e) {
        console.log(`[AI Doc Analyzer] Could not parse Excel file:`, e);
      }
    }
    
    // Fallback: try to read as text
    const text = await response.text();
    if (text.length > 0 && text.length < 1000000) {
      return text;
    }
    
    return `[Could not extract text from ${doc.filename}]`;
  } catch (error: any) {
    console.error(`[AI Doc Analyzer] Error extracting text from ${doc.filename}:`, error);
    return `[Error extracting text from ${doc.filename}: ${error.message}]`;
  }
}

/**
 * Chunk text into smaller pieces if it exceeds token limits
 */
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    // Try to find a good break point (paragraph, sentence, or word boundary)
    let chunkEnd = maxChars;
    
    if (remaining.length > maxChars) {
      // Look for paragraph break
      const paraBreak = remaining.lastIndexOf('\n\n', maxChars);
      if (paraBreak > maxChars * 0.5) {
        chunkEnd = paraBreak;
      } else {
        // Look for sentence break
        const sentenceBreak = remaining.lastIndexOf('. ', maxChars);
        if (sentenceBreak > maxChars * 0.5) {
          chunkEnd = sentenceBreak + 1;
        } else {
          // Look for word break
          const wordBreak = remaining.lastIndexOf(' ', maxChars);
          if (wordBreak > maxChars * 0.5) {
            chunkEnd = wordBreak;
          }
        }
      }
    }
    
    chunks.push(remaining.substring(0, chunkEnd).trim());
    remaining = remaining.substring(chunkEnd).trim();
  }
  
  return chunks;
}

const IB_ANALYST_SYSTEM_PROMPT = `You are "IB Analyst GPT", an institutional investment banking analyst. Your job is to ingest any uploaded document and return a decision ready analyst style summary of that document only. You write with precision, zero fluff, and an internal deal team tone. You do not use emojis. You do not use any dashes or hyphens of any kind.

Scope
Summarize each uploaded document in a structured, investment banking format that enables senior bankers and principals to make decisions quickly. You do not produce diligence request lists. You do not ask questions before producing the summary. If information is missing, you explicitly flag it in a dedicated section and move on.

Operating principles
1. Document first, then interpretation. Separate extracted facts from your analysis.
2. Do not assume facts that are not in the document. When you must infer, label it as inference.
3. Always quantify when numbers exist. If numbers do not exist, say so.
4. When possible, reference where key facts appear using page numbers, headings, or section titles. Keep quotes minimal.
5. Never provide legal, tax, or accounting advice. You may flag issues for counsel, tax advisers, or auditors to review.
6. If multiple documents are uploaded, produce one standalone summary per document, clearly separated.

Default deliverable for each document
Produce the sections below in this order, using tight paragraphs and minimal numbered lists only when clarity improves.

1. Document Identification
Document type and purpose
Date and version if stated
Author or source if stated
Parties involved if applicable
What decision this document supports

2. One Paragraph Executive Summary
What this document says
Why it matters
What a decision maker should take away

3. Key Facts Extract
Bullet the hard facts only, no interpretation.
Include, as applicable:
Company or asset description
Transaction type and context
Capital structure elements mentioned
Use of proceeds
Timeline and process status
Key counterparties and roles
Material KPIs
Stated risks, constraints, or conditions

4. Economics and Financial Content
Capture all economics and financials presented in the document.
Examples:
Historical financials, projections, assumptions
Revenue model and margin profile
Cash burn and runway if stated
Debt terms and interest burden if stated
Valuation, pricing, or implied valuation
Fees, retainers, success fees if applicable
If not included, state "Not provided in the document."

5. Terms and Obligations
If the document is contractual or quasi contractual, extract the operative terms:
Binding versus non binding status
Exclusivity and duration
Conditions to close or conditions precedent
Termination rights
Information rights and confidentiality
Transfer restrictions or assignment
Governing law and venue
Any economic triggers, penalties, or earnouts
If not applicable, state "Not applicable for this document type."

6. Critical Drivers and What Actually Matters
Summarize the 5 to 10 points that drive the outcome.
Focus on decision critical drivers such as:
Revenue concentration or dependency
Unit economics signals
Liquidity constraints
Regulatory dependencies
Execution complexity and timeline risk
Counterparty quality
Legal or structural bottlenecks
Reliance on assumptions

7. Red Flags and Gaps
Two subsections:
Red flags stated or implied by the document
Gaps meaning information a decision maker would need that is not present
Do not turn gaps into a diligence checklist. Keep it as missing decision inputs.

8. Analyst View
Your professional interpretation in a conservative banker frame.
Include:
What is strong
What is weak
What is uncertain
What must be true for success

9. Decision Frame
Provide a clear decision oriented conclusion, one of:
Proceed
Proceed conditionally
Do not proceed yet
Then list the 3 to 7 conditions or gating items in plain language, not as a request list.

Formatting and tone constraints
No emojis.
No dashes or hyphens.
No marketing language.
No long preambles.
Do not include any diligence request lists.
Do not ask the user questions before producing output.`;

/**
 * Generate a summary of a single text chunk
 */
async function summarizeChunk(openai: OpenAI, text: string, dealContext: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: IB_ANALYST_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `Deal Context: ${dealContext}\n\nDocument Content:\n${text}`
      }
    ],
    max_tokens: 4000,
    temperature: 0.3,
  });
  
  return response.choices[0]?.message?.content || '';
}

const IB_CONSOLIDATION_PROMPT = `You are "IB Analyst GPT", a senior institutional investment banking analyst. You are consolidating multiple document summaries into a single comprehensive deal analysis.

Your job is to synthesize the individual document analyses into a unified, decision ready summary. You write with precision, zero fluff, and an internal deal team tone. You do not use emojis. You do not use any dashes or hyphens of any kind.

When consolidating multiple documents, produce this structure:

1. Deal Overview
Synthesize what the combined documents tell us about this deal. What is the transaction? Who are the parties? What stage is it at?

2. Consolidated Executive Summary
A single paragraph that captures the most important takeaways across all documents. What does a senior banker need to know?

3. Key Facts Across Documents
Consolidate the hard facts from all documents. Remove duplication but preserve all unique material facts.

4. Economics and Financial Summary
Consolidate all financial information. Note where documents agree or conflict. Highlight the most reliable figures.

5. Terms and Obligations Summary
If any documents contained contractual terms, summarize them here. Note binding versus non binding status across documents.

6. Critical Drivers for This Deal
Synthesize the 5 to 10 most important drivers that will determine success or failure. Draw from all documents.

7. Red Flags and Gaps Consolidated
Combine red flags from all documents. Identify any gaps that remain even after reviewing all materials.

8. Analyst View
Your consolidated professional interpretation. What is the overall picture? What should the deal team focus on?

9. Decision Frame
Based on all documents reviewed, provide a clear recommendation:
Proceed
Proceed conditionally
Do not proceed yet
List the 3 to 7 most important conditions or gating items.

Formatting constraints
No emojis
No dashes or hyphens
No marketing language
Clear section headers`;

/**
 * Generate a final consolidated summary from multiple chunk summaries
 */
async function generateFinalSummary(
  openai: OpenAI,
  chunkSummaries: string[], 
  deal: Deal,
  documentNames: string[]
): Promise<string> {
  const combinedSummaries = chunkSummaries.join('\n\n---\n\n');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: IB_CONSOLIDATION_PROMPT
      },
      {
        role: "user",
        content: `Deal: ${deal.name}
Client: ${deal.client}
Sector: ${deal.sector}
Deal Type: ${deal.dealType}
Value: $${deal.value}M
Stage: ${deal.stage}

Documents analyzed: ${documentNames.join(', ')}

Individual Document Analyses:
${combinedSummaries}`
      }
    ],
    max_tokens: 6000,
    temperature: 0.3,
  });
  
  return response.choices[0]?.message?.content || 'Unable to generate summary.';
}

/**
 * Main function to analyze documents for a deal
 */
export async function analyzeDocumentsForDeal(
  analysisId: string,
  dealId: string,
  documents: DocumentInfo[],
  userId: string
): Promise<void> {
  console.log(`[AI Doc Analyzer] Starting analysis ${analysisId} for deal ${dealId}`);
  
  try {
    // Validate OpenAI API key upfront
    const openai = getOpenAIClient();
    
    // Update status to processing immediately
    await storage.updateAiDocumentAnalysis(analysisId, { status: 'processing' });
    
    // Get deal info
    const deal = await storage.getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }
    
    // Validate we have documents to process
    if (!documents || documents.length === 0) {
      throw new Error('No documents provided for analysis');
    }
    
    // Extract text from all documents
    console.log(`[AI Doc Analyzer] Extracting text from ${documents.length} documents`);
    const documentTexts: { filename: string; text: string }[] = [];
    let totalText = '';
    
    for (const doc of documents) {
      if (!doc.url) {
        console.warn(`[AI Doc Analyzer] Skipping document ${doc.filename} - no URL provided`);
        continue;
      }
      const text = await extractTextFromDocument(doc);
      documentTexts.push({ filename: doc.filename, text });
      totalText += `\n\n=== Document: ${doc.filename} ===\n${text}`;
    }
    
    if (documentTexts.length === 0) {
      throw new Error('No valid documents could be processed');
    }
    
    // Store extracted text
    await storage.updateAiDocumentAnalysis(analysisId, { 
      extractedText: totalText.substring(0, 500000) // Limit stored text
    });
    
    const dealContext = `${deal.name} - ${deal.client} (${deal.sector}) - $${deal.value}M ${deal.dealType}`;
    const maxCharsPerChunk = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN * 0.7; // Leave room for prompt
    
    // Process each document's text
    const allSummaries: string[] = [];
    
    for (const { filename, text } of documentTexts) {
      if (text.length < 100 || text.startsWith('[Could not') || text.startsWith('[Error')) {
        allSummaries.push(`${filename}: ${text}`);
        continue;
      }
      
      const chunks = chunkText(text, maxCharsPerChunk);
      console.log(`[AI Doc Analyzer] Document ${filename} split into ${chunks.length} chunks`);
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunkSummary = await summarizeChunk(openai, chunks[i], dealContext);
          allSummaries.push(`### ${filename}${chunks.length > 1 ? ` (Part ${i + 1}/${chunks.length})` : ''}\n${chunkSummary}`);
        } catch (chunkError: any) {
          console.error(`[AI Doc Analyzer] Error summarizing chunk ${i + 1} of ${filename}:`, chunkError);
          allSummaries.push(`### ${filename} (Part ${i + 1}/${chunks.length})\n[Error analyzing this section: ${chunkError.message}]`);
        }
      }
    }
    
    if (allSummaries.length === 0) {
      throw new Error('Failed to generate any summaries from the documents');
    }
    
    // Generate final consolidated summary
    const documentNames = documents.map(d => d.filename);
    const finalSummary = await generateFinalSummary(openai, allSummaries, deal, documentNames);
    
    // Update analysis with completed summary
    await storage.updateAiDocumentAnalysis(analysisId, {
      status: 'completed',
      summary: finalSummary,
      completedAt: new Date()
    });
    
    console.log(`[AI Doc Analyzer] Analysis ${analysisId} completed successfully`);
    
  } catch (error: any) {
    console.error(`[AI Doc Analyzer] Analysis ${analysisId} failed:`, error);
    
    // Attempt to update status to failed
    try {
      await storage.updateAiDocumentAnalysis(analysisId, {
        status: 'failed',
        error: error.message || 'Unknown error occurred'
      });
    } catch (updateError) {
      console.error(`[AI Doc Analyzer] Failed to update analysis status:`, updateError);
    }
  }
}

/**
 * Create a deal note from an AI summary
 */
export async function createNoteFromSummary(
  dealId: string,
  userId: string,
  userName: string,
  summary: string,
  userAvatar?: string
): Promise<DealNote> {
  const noteContent = `## AI-Generated Deal Summary\n\n${summary}\n\n---\n*This summary was automatically generated by analyzing deal documents.*`;
  
  const note = await storage.createDealNote({
    dealId,
    userId,
    userName,
    userAvatar: userAvatar || null,
    content: noteContent
  });
  
  return note;
}
