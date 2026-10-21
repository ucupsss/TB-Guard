'use client';

import * as React from 'react';
import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** tautan internal (/devices/401) pakai navigasi Next; tautan luar dibuka di tab baru */
const components: Components = {
  a: ({ href = '', children }) => (href.startsWith('/')
    ? <Link href={href}>{children}</Link>
    : <a href={href} target="_blank" rel="noreferrer">{children}</a>),
  table: ({ children }) => <div className="agent-md-table"><table>{children}</table></div>,
};

export const Markdown = React.memo(function Markdown({ text }: { text: string }) {
  return <div className="agent-md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown></div>;
});
