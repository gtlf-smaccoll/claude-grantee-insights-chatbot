declare module "pdf-parse" {
  interface PDFData {
    /** Number of pages */
    numpages: number;
    /** Number of rendered pages */
    numrender: number;
    /** PDF info object */
    info: Record<string, unknown>;
    /** PDF metadata */
    metadata: unknown;
    /** Extracted text content */
    text: string;
    /** PDF version */
    version: string;
  }

  function pdf(buffer: Buffer, options?: Record<string, unknown>): Promise<PDFData>;

  export default pdf;
}
