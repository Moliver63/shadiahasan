import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
// CSS imports removed - styles will be handled by Tailwind

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  fileUrl: string;
  title?: string;
}

export default function PdfViewer({ fileUrl, title }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages));
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  }

  function zoomOut() {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Controls */}
      <div className="bg-white border-b sticky top-0 z-10 w-full px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={previousPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            Página {pageNumber} de {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <a href={fileUrl} download={title || 'document.pdf'}>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </a>
        </div>
      </div>

      {/* PDF Document */}
      <div className="overflow-auto w-full flex justify-center bg-gray-100 p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          }
          error={
            <div className="text-center py-20 text-red-600">
              Erro ao carregar PDF. Verifique o arquivo.
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
}
