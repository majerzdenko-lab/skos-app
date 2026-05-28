import Layout from '../../components/Layout';
import pkg from '../../../package.json';

export default function About() {
  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">SKoS — Správa koseckých podujatí</h1>
        <p className="text-gray-500 mb-6">Aplikácia na správu koseckých podujatí</p>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Vytvorené pre <strong>Slovenský kosecký spolok (SKoS)</strong></p>
          <p>
            Softvér:{' '}
            <a href="https://veselykosec.sk" target="_blank" rel="noopener noreferrer" className="underline">
              Veselý Kosec
            </a>
            {' '}· veselykosec.sk
          </p>
          <p className="text-gray-400 text-xs mt-4">Verzia: {pkg.version}</p>
        </div>
      </div>
    </Layout>
  );
}
