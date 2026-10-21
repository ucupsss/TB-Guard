import LiveTestView from '@/views/LiveTestView';

export const metadata = {
  title: 'Uji Suara Mic (Live) | TB-Guard',
  description: 'Uji langsung rekaman suara batuk dari mikrofon laptop atau edge device untuk klasifikasi TB-Guard.',
};

export default function LiveTestPage() {
  return <LiveTestView />;
}
