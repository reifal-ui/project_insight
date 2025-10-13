import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Navbar />
      <main className="ml-64 pt-16 p-8">
        {children}
      </main>
    </div>
  );
}