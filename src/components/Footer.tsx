export default function Footer() {
  return (
    <footer className="w-full py-8 mt-auto border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div>
            <h2 className="text-white font-bold text-lg">DASNET VENTURES LTD</h2>
            <p className="text-xs">Support: +254725336731</p>
          </div>
          
          <div className="flex gap-6 text-xs">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
          
          <p className="text-[10px] uppercase tracking-widest">
            &copy; 2026 DASNET VENTURES LTD. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
