import { Ambulance, Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { useApp } from '@/lib/context';

export default function Footer() {
  const { navigate } = useApp();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                <Ambulance className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-lg text-white">LifeCare</div>
                <div className="text-[11px] text-brand-400 font-semibold tracking-wide">AMBULANCE SERVICE</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Trusted emergency medical transportation, available 24/7. Your safety is our priority.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-500 flex items-center justify-center transition-colors" aria-label="Facebook"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-500 flex items-center justify-center transition-colors" aria-label="Twitter"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-500 flex items-center justify-center transition-colors" aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-brand-500 flex items-center justify-center transition-colors" aria-label="LinkedIn"><Linkedin className="w-4 h-4" /></a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => navigate('/')} className="hover:text-brand-400 transition-colors">Home</button></li>
              <li><button onClick={() => navigate('/services')} className="hover:text-brand-400 transition-colors">Services</button></li>
              <li><button onClick={() => navigate('/how-it-works')} className="hover:text-brand-400 transition-colors">How It Works</button></li>
              <li><button onClick={() => navigate('/about')} className="hover:text-brand-400 transition-colors">About Us</button></li>
              <li><button onClick={() => navigate('/contact')} className="hover:text-brand-400 transition-colors">Contact Us</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => navigate('/book')} className="hover:text-brand-400 transition-colors">Book Ambulance</button></li>
              <li><button onClick={() => navigate('/track')} className="hover:text-brand-400 transition-colors">Track Ambulance</button></li>
              <li><button onClick={() => navigate('/dashboard')} className="hover:text-brand-400 transition-colors">My Dashboard</button></li>
              <li><button onClick={() => navigate('/bookings')} className="hover:text-brand-400 transition-colors">My Bookings</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5"><Phone className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" /><span>1800-LIFECARE (24/7)</span></li>
              <li className="flex items-start gap-2.5"><Mail className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" /><span>support@lifecare.com</span></li>
              <li className="flex items-start gap-2.5"><MapPin className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" /><span>LifeCare Plaza, MG Road, Bengaluru 560001</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>&copy; 2026 LifeCare Ambulance Service. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-brand-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-brand-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
