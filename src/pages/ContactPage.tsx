import { Phone, Mail, MapPin, Clock, Send, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/UI';
import { sendSafetyEmail } from '@/lib/email';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // Safety-related email delivered through EmailJS (fire & forget — the UI
    // success banner shows regardless so email failures never block users).
    void sendSafetyEmail({
      to_email: 'support@lifecare.com',
      to_name: 'LifeCare Support',
      subject: `New contact message from ${form.name}`,
      message: `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\n\n${form.message}`,
      reply_to: form.email,
    });
    setForm({ name: '', email: '', phone: '', message: '' });
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="Contact Us" subtitle="We're here for you, 24/7" icon={<MessageSquare className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {[
          { icon: Phone, title: 'Call Us', value: '1800-LIFECARE', sub: '24/7 Emergency Helpline' },
          { icon: Mail, title: 'Email Us', value: 'support@lifecare.com', sub: 'Response within 2 hours' },
          { icon: MapPin, title: 'Visit Us', value: 'LifeCare Plaza, MG Road', sub: 'Bengaluru 560001' },
        ].map((c, i) => (
          <div key={i} className="card-hover p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-4">
              <c.icon className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-900">{c.title}</h3>
            <p className="text-brand-600 font-semibold mt-1">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Send Us a Message</h3>
          {submitted && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium animate-fade-in">
              Thank you! Your message has been sent. We'll get back to you shortly.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Full Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Enter your name" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="you@email.com" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Phone</label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+91 98765 43210" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Message</label>
              <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-field resize-none" placeholder="How can we help you?" />
            </div>
            <button type="submit" className="btn-primary w-full">
              <Send className="w-4 h-4" /> Send Message
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-brand-600" />
              <h3 className="text-xl font-bold text-gray-900">Operating Hours</h3>
            </div>
            <div className="space-y-3">
              {[
                { day: 'Emergency Service', hours: '24/7 Available', highlight: true },
                { day: 'Monday - Friday', hours: '8:00 AM - 10:00 PM' },
                { day: 'Saturday', hours: '8:00 AM - 8:00 PM' },
                { day: 'Sunday', hours: '9:00 AM - 6:00 PM' },
              ].map((h, i) => (
                <div key={i} className={`flex items-center justify-between py-2 ${i < 3 ? 'border-b border-gray-100' : ''}`}>
                  <span className="text-sm font-medium text-gray-700">{h.day}</span>
                  <span className={`text-sm font-semibold ${h.highlight ? 'text-brand-600' : 'text-gray-600'}`}>{h.hours}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-8 bg-gradient-to-br from-brand-50 to-accent-50">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Emergency?</h3>
            <p className="text-sm text-gray-600 mb-4">Don't wait. Call our 24/7 emergency helpline and get an ambulance dispatched immediately.</p>
            <a href="tel:1800LIFECARE" className="btn-primary w-full">
              <Phone className="w-4 h-4" /> Call 1800-LIFECARE
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
