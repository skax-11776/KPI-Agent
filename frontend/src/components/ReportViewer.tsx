/**
 * 리포트 뷰어 컴포넌트 (마크다운)
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ReportViewerProps {
  report: string;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 prose prose-sm max-w-none">
      <ReactMarkdown>{report}</ReactMarkdown>
    </div>
  );
};

export default ReportViewer;