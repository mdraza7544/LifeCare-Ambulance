import { useState } from 'react';
import { Star, MessageSquare, ThumbsUp, Send, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';

export default function FeedbackPage() {
  const { navigate } = useApp();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ service: '', driver: '', comments: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in">
        <div className="card p-10 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Thank You for Your Feedback!</h2>
          <p className="text-gray-600 mb-6">Your input helps us improve our service and provide better care for our patients.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <PageHeader title="Share Your Feedback" subtitle="Help us improve our ambulance service" icon={<MessageSquare className="w-5 h-5" />} />

      <form onSubmit={handleSubmit} className="card p-8 space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 mb-3">How was your overall experience?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} className="transition-transform hover:scale-110">
                <Star className={`w-10 h-10 ${(hover || rating) >= i ? 'text-amber-400 fill-current' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
          {rating > 0 && <p className="text-sm text-brand-600 font-semibold mt-2">{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}</p>}
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">How was the ambulance service?</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['On Time', 'Clean & Hygienic', 'Well Equipped', 'Needs Improvement'].map((opt) => (
              <button key={opt} type="button" onClick={() => setForm({ ...form, service: opt })} className={`p-3 rounded-lg border-2 text-xs font-semibold transition-all ${form.service === opt ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-200'}`}>
                <ThumbsUp className="w-4 h-4 mx-auto mb-1" /> {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">How was the driver's behavior?</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['Professional', 'Friendly', 'Helpful', 'Rushed', 'Average'].map((opt) => (
              <button key={opt} type="button" onClick={() => setForm({ ...form, driver: opt })} className={`p-3 rounded-lg border-2 text-xs font-semibold transition-all ${form.driver === opt ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-200'}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Additional Comments</label>
          <textarea rows={4} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} className="input-field resize-none" placeholder="Tell us more about your experience..." />
        </div>

        <button type="submit" disabled={rating === 0} className="btn-primary w-full">
          <Send className="w-4 h-4" /> Submit Feedback
        </button>
      </form>
    </div>
  );
}
