export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-100 py-5">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-gray-400">
        <img src="/logo.png" alt="Veselý Kosec" className="h-10 w-10 opacity-70" />
        <span className="text-center sm:text-left">
          Softvér vytvoril{' '}
          <a
            href="https://veselykosec.sk"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            Veselý Kosec
          </a>
          {' '}(MIDOMA s.r.o.) pre Slovenský kosecký spolok
        </span>
      </div>
    </footer>
  );
}
