import { ReactNode } from 'react';
import Footer from './Footer';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function Layout({ children, className = '' }: Props) {
  return (
    <div className={`min-h-screen flex flex-col bg-white ${className}`}>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
