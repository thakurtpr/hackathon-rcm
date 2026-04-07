'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useIntentStore } from '@/store/intentStore';

export default function LandingPage() {
  const router = useRouter();
  const setIntent = useIntentStore((state) => state.setIntent);

  const handleIntentSelection = (intent: 'loan' | 'scholarship' | 'both') => {
    setIntent(intent);
    router.push('/register');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500/30">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md shadow-sm border-b border-gray-800">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="text-xl font-bold tracking-tighter text-blue-800">ScholarFlow AI</div>
            <div className="hidden lg:flex items-center gap-1 ml-4 px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <span className="material-symbols-outlined text-[12px]">language</span>
              ENG | हिन्दी | ଓଡ଼ିଆ
            </div>
          </div>
          <div className="hidden md:flex gap-8 items-center text-sm font-medium tracking-tight">
            <a className="text-white font-semibold transition-colors" href="#">Aspirations</a>
            <a className="text-gray-400 hover:text-indigo-400 transition-colors" href="#">Global MS Funding</a>
            <a className="text-gray-400 hover:text-indigo-400 transition-colors" href="#">MBA Loans</a>
            <a className="text-gray-400 hover:text-indigo-400 transition-colors" href="#">Scholarships</a>
          </div>
          <div className="flex items-center gap-4">
            <button className="hidden md:block text-gray-400 font-medium text-sm hover:text-white transition-colors">Login</button>
            <button className="bg-indigo-600 px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:bg-indigo-500 transition-all scale-95 duration-200 hover:scale-100 shadow-md shadow-indigo-500/20">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 z-10">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 mb-8 border border-indigo-500/20 font-sans">
              <span className="material-symbols-outlined text-[16px] mr-2">workspace_premium</span>
              Excellence for IIT, NIT & BITS Scholars
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-[1.1]">
              The Elite Path to Your <span className="text-indigo-400">Global Education</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-xl mb-12 leading-relaxed font-medium">
              Master your future with AI-driven funding. Tailored loans and scholarships for India&apos;s brightest minds pursuing MS abroad or elite domestic post-grad.
            </p>

            {/* Three Distinct CTA Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <button 
                onClick={() => handleIntentSelection('loan')}
                className="cta-card p-6 rounded-2xl text-left flex flex-col gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <span className="material-symbols-outlined font-light">account_balance</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm uppercase tracking-tight">I need a Loan</h4>
                  <p className="text-[11px] text-gray-400 leading-tight mt-1.5 font-medium">Get funds for your education with flexible repayment.</p>
                </div>
              </button>

              <button 
                onClick={() => handleIntentSelection('scholarship')}
                className="cta-card p-6 rounded-2xl text-left flex flex-col gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                  <span className="material-symbols-outlined font-light">auto_awesome</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm uppercase tracking-tight">I need a Scholarship</h4>
                  <p className="text-[11px] text-gray-400 leading-tight mt-1.5 font-medium">Find grants and scholarships you&apos;re eligible for.</p>
                </div>
              </button>

              <button 
                onClick={() => handleIntentSelection('both')}
                className="cta-card p-6 rounded-2xl text-left flex flex-col gap-3 border-indigo-500/20 bg-indigo-500/5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                  <span className="material-symbols-outlined font-light">layers</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm uppercase tracking-tight">I need Both</h4>
                  <p className="text-[11px] text-gray-400 leading-tight mt-1.5 font-medium">Explore a combined package of loans and scholarships.</p>
                </div>
              </button>
            </div>
            <p className="text-sm font-semibold text-on-surface-variant/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-saffron animate-pulse"></span>
              Support available in Hindi and Odia
            </p>
          </div>

          <div className="lg:col-span-5 relative group">
            <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800 transition-transform duration-500 group-hover:scale-[1.02]">
              <div className="w-full aspect-[4/5] bg-gray-950 flex items-center justify-center rounded-2xl border-2 border-white/5">
                <div className="flex flex-col items-center gap-4 text-white opacity-20">
                  <span className="material-symbols-outlined text-[80px]">person</span>
                  <p className="font-black text-xl uppercase tracking-[0.2em]">Student Image</p>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 glass-panel p-6 rounded-2xl shadow-lg border border-white/10">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border-2 border-indigo-400/20">
                    <span className="material-symbols-outlined text-indigo-400 text-[20px] font-bold">person</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Ivy League Match Found</p>
                    <p className="text-xs text-gray-400 font-medium">Full-funding for MS in CS</p>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 w-[98%] shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
                </div>
                <p className="text-[10px] mt-2 text-right font-bold text-indigo-400 uppercase tracking-widest">98% Eligibility Score</p>
              </div>
            </div>
            {/* Abstract decorative elements */}
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] -z-10 delay-75 animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Trust Bar */}
      <section className="bg-gray-950 py-16 border-y border-gray-800 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-gray-500 mb-12 uppercase tracking-[0.3em]">Empowering Scholars From India&apos;s Premier Institutions</p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="text-xl font-black text-white tracking-tighter hover:text-indigo-400 transition-colors cursor-default">IIT BOMBAY</div>
            <div className="text-xl font-black text-white tracking-tighter hover:text-indigo-400 transition-colors cursor-default">IIT DELHI</div>
            <div className="text-xl font-black text-white tracking-tighter hover:text-indigo-400 transition-colors cursor-default">BITS PILANI</div>
            <div className="text-xl font-black text-white tracking-tighter hover:text-indigo-400 transition-colors cursor-default">NIT TRICHY</div>
            <div className="text-xl font-black text-white tracking-tighter hover:text-indigo-400 transition-colors cursor-default">IIM AHMEDABAD</div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-28 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight text-white">Built for Global Aspirations</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-xl font-medium leading-relaxed">
              Your academic excellence deserves a funding experience that matches your intelligence. No bureaucracy, just results.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon="travel_explore"
              title="Global MS Funding"
              description="Specialized low-interest loans for US, UK, and German MS programs with no collateral requirements for premier grads."
              accentColor="bg-indigo-500/10 text-indigo-400"
            />
            <FeatureCard 
              icon="account_balance_wallet"
              title="Domestic Elite Loans"
              description="Instant approval for MBA and M.Tech funding at top-tier Indian institutions based on your entrance scores."
              accentColor="bg-purple-500/10 text-purple-400"
            />
            <FeatureCard 
              icon="auto_awesome"
              title="Scholarship Engine"
              description="Our AI tracks 50,000+ international grants. We match you with niche scholarships specifically for Indian STEM students."
              accentColor="bg-amber-500/10 text-amber-400"
            />
            <FeatureCard 
              icon="monitoring"
              title="Income-Linked Plans"
              description="Repayment that waits until you're placed. AI-optimized plans that adjust based on your starting salary abroad."
              accentColor="bg-sky-500/10 text-sky-400"
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 pt-12">
                  <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                    <div className="text-3xl font-black text-indigo-500/20 mb-4">01</div>
                    <h4 className="font-bold mb-2 text-white">Score Sync</h4>
                    <p className="text-xs text-gray-400 font-medium">Sync your GATE, GRE, or CAT scores to unlock premium rates.</p>
                  </div>
                  <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                    <div className="text-3xl font-black text-indigo-500/20 mb-4">03</div>
                    <h4 className="font-bold mb-2 text-white">Visa-Ready Docs</h4>
                    <p className="text-xs text-gray-400 font-medium">Get instant sanction letters for your visa interview in 24 hours.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-xl shadow-indigo-600/20">
                    <div className="text-3xl font-black text-white/30 mb-4">02</div>
                    <h4 className="font-bold mb-2">AI Match</h4>
                    <p className="text-xs text-white/80 font-medium">Our engine negotiates with lenders to find the lowest possible INR/USD rates.</p>
                  </div>
                  <div className="bg-purple-500/10 p-4 rounded-2xl h-40 flex items-center justify-center border border-purple-500/20">
                    <span className="material-symbols-outlined text-purple-400 text-[40px] opacity-40">finance_mode</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight text-white">Your global future, <br/><span className="text-indigo-400 tracking-tight">engineered for excellence.</span></h2>
              <ul className="space-y-8">
                <li className="flex gap-6">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black">1</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-white">Academic Validation</h4>
                    <p className="text-gray-400 font-medium">We value your pedigree. Students from Tier-1 Indian institutions get access to exclusive interest-rate brackets and higher loan amounts.</p>
                  </div>
                </li>
                <li className="flex gap-6">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black">2</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-white">Comprehensive Coverage</h4>
                    <p className="text-gray-400 font-medium">From tuition to living expenses and flight tickets. Our AI calculates your total cost of attendance across 50+ countries.</p>
                  </div>
                </li>
                <li className="flex gap-6">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black">3</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-white">Digital-First Success</h4>
                    <p className="text-white font-bold px-3 py-1 bg-indigo-600 rounded inline-block text-[10px] mb-2 uppercase tracking-widest shadow-lg shadow-indigo-600/20">New: Paperless Disbursal</p>
                    <p className="text-gray-400 font-medium">Apply once, get matches from 20+ lenders, and receive funds directly in your university&apos;s account. Completely digital.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* AI Interaction Preview */}
      <section className="py-28 bg-gray-900 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-gray-950 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col lg:row md:flex-row border border-white/5 relative">
            <div className="p-12 md:p-16 md:w-1/2 flex flex-col justify-center text-white relative z-10">
              <h2 className="text-4xl font-bold mb-8 leading-tight text-white">Chat with your <br/><span className="text-indigo-400">Personal AI Mentor.</span></h2>
              <p className="text-gray-400 mb-10 text-lg leading-relaxed font-medium">
                Our conversational AI is trained on the nuances of global education funding for Indian students. It&apos;s like having a senior from IIT/NIT as your financial mentor.
              </p>
              <div className="flex flex-col gap-5 text-sm font-semibold tracking-wide text-gray-300">
                <span className="flex items-center gap-3"><span className="material-symbols-outlined text-[20px] text-indigo-400">check_circle</span> Support in English, Hindi, and Odia</span>
                <span className="flex items-center gap-3"><span className="material-symbols-outlined text-[20px] text-indigo-400">check_circle</span> Specialized MS Abroad Guidance</span>
              </div>
            </div>
            
            <div className="md:w-1/2 bg-gray-900/40 p-8 md:p-12 flex flex-col gap-6 border-l border-white/5 backdrop-blur-3xl shadow-inner">
              <div className="bg-gray-800/40 p-6 rounded-2xl rounded-tl-none self-start max-w-[90%] border border-white/10 animate-in slide-in-from-left duration-500">
                <p className="text-sm text-gray-200 italic font-medium leading-relaxed">
                  &quot;Namaste! I see you&apos;re an IIT Madras final year student aiming for a Masters in the US. Shall I show you collateral-free loan options with &lt; 9% interest?&quot;
                </p>
              </div>
              <div className="bg-indigo-600 p-6 rounded-2xl rounded-tr-none self-end max-w-[85%] text-white shadow-xl shadow-indigo-600/20 animate-in slide-in-from-right duration-500 delay-300">
                <p className="text-sm font-bold italic text-white leading-relaxed">
                  &quot;Yes, please. Also, search for any scholarships that specifically favor Indian STEM applicants with high GPA.&quot;
                </p>
              </div>
              <div className="bg-gray-800/40 p-6 rounded-2xl rounded-tl-none self-start max-w-[90%] border border-white/10 animate-in slide-in-from-left duration-500 delay-500">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-indigo-400 font-bold animate-spin-slow">search</span>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic leading-none">Analyzing 1,200+ Global Grants...</span>
                </div>
                <p className="text-sm text-gray-200 font-medium leading-relaxed">
                  &quot;Found 3 elite matches! The &apos;Tata Scholarship for Cornell&apos; is perfect. I&apos;ve also matched you with a lender offering a special 8.5% rate for IIT alumni.&quot;
                </p>
              </div>
              <div className="mt-6 flex gap-3">
                <div className="flex-grow h-14 bg-gray-950/80 rounded-full border border-gray-800 px-8 flex items-center text-gray-500 text-xs font-bold tracking-tight shadow-inner">
                  Type in English or Hindi...
                </div>
                <div className="w-14 h-14 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95 duration-200">
                  <span className="material-symbols-outlined text-xl">send</span>
                </div>
              </div>
            </div>

            {/* Decorative background for the chat box */}
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-600/5 to-transparent -z-0"></div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gray-950 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-xl">
              <h2 className="text-4xl font-black mb-4 italic text-white">
                &quot;ScholarFlow turned my Stanford dream into a reality.&quot;
              </h2>
              <p className="text-gray-400 font-medium">Join thousands of high-achievers who secured their global future through AI precision.</p>
            </div>
            <div className="flex gap-4">
              <button className="w-12 h-12 rounded-full border border-gray-800 flex items-center justify-center text-gray-400 hover:bg-gray-900 hover:text-white hover:border-indigo-500/50 transition-all shadow-sm">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button className="w-12 h-12 rounded-full border border-gray-800 flex items-center justify-center text-gray-400 hover:bg-gray-900 hover:text-white hover:border-indigo-500/50 transition-all shadow-sm">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="The AI Matcher found a $20k fellowship specifically for Indian engineers at Carnegie Mellon. I wouldn't have found it myself."
              name="Aravind K."
              title="IIT Madras → CMU '24"
              image="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=100"
            />
            <TestimonialCard 
              quote="Securing a collateral-free loan for my MBA at ISB was incredibly fast. The sanction letter was ready in just 18 hours."
              name="Sanya M."
              title="NIT Warangal → ISB"
              image="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100"
            />
            <TestimonialCard 
              quote="ScholarFlow handles the complexity of foreign exchange rates perfectly. I saved nearly ₹3 Lakhs on interest alone."
              name="Rohan D."
              title="BITS Pilani → TU Munich"
              image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 bg-gray-900 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-900 rounded-[4rem] p-16 md:p-32 text-center text-white relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(79,70,229,0.5)] border border-white/5">
            <div className="relative z-10">
              <h2 className="text-5xl md:text-7xl font-black mb-10 tracking-tight leading-[1.05]">Architect Your <br/>Global Future Today</h2>
              <p className="text-xl md:text-2xl text-indigo-100 mb-14 max-w-2xl mx-auto font-medium opacity-90 leading-relaxed">
                Join 50,000+ elite Indian scholars already using ScholarFlow AI to architect their financial freedom.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button 
                  onClick={() => router.push('/register')}
                  className="px-12 py-6 bg-white text-indigo-600 font-black text-xl rounded-2xl hover:bg-gray-100 transition-all shadow-2xl active:scale-95 duration-300"
                >
                  Join ScholarFlow India
                </button>
                <button className="px-12 py-6 bg-indigo-500/20 border border-white/30 text-white font-black text-xl rounded-2xl hover:bg-indigo-500/30 transition-all backdrop-blur-sm active:scale-95 duration-300">
                  Talk to a Global Advisor
                </button>
              </div>
            </div>
            {/* Massive decorative globs */}
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-white/10 rounded-full blur-[150px] animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[120px] delay-150 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 w-full py-24 px-6 border-t border-gray-800">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-16 max-w-7xl mx-auto">
          <div className="col-span-2 lg:col-span-1">
            <div className="text-2xl font-black text-white mb-8 tracking-tighter">ScholarFlow AI</div>
            <p className="text-sm font-medium leading-relaxed text-gray-500 mb-10 max-w-xs">
              Empowering India&apos;s brightest to achieve global excellence. Financial freedom through intelligence.
            </p>
            <div className="flex gap-3">
              <span className="px-3 py-1.5 bg-gray-900 border border-gray-800 text-xs rounded-lg font-bold shadow-sm cursor-default hover:bg-gray-800 transition-colors">हिन्दी</span>
              <span className="px-3 py-1.5 bg-gray-900 border border-gray-800 text-xs rounded-lg font-bold shadow-sm cursor-default hover:bg-gray-800 transition-colors">ଓଡ଼ିଆ</span>
            </div>
          </div>
          <div>
            <h5 className="font-black text-white text-sm mb-10 uppercase tracking-widest">Aspirations</h5>
            <ul className="flex flex-col gap-6 text-sm font-semibold text-gray-500">
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">MS in USA</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">STEM Scholarships</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">ISB & IIM Loans</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">IIT-Alumni Perks</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-black text-white text-sm mb-10 uppercase tracking-widest">Support</h5>
            <ul className="flex flex-col gap-6 text-sm font-semibold text-gray-500">
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Student Support</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Visa Documentation</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Forex Services</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-black text-white text-sm mb-10 uppercase tracking-widest">Contact</h5>
            <ul className="flex flex-col gap-6 text-sm font-semibold text-gray-500">
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Bengaluru Office</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Mumbai Hub</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">Email Us</a></li>
              <li><a className="hover:text-indigo-400 transition-colors underline-offset-8 hover:underline" href="#">WhatsApp Support</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-16 mt-20 border-t border-gray-800 text-center">
          <p className="text-xs font-bold text-gray-600 tracking-widest uppercase">© 2024 ScholarFlow AI India. Powering Global Aspirations.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, accentColor }: { icon: string; title: string; description: string; accentColor: string }) {
  return (
    <div className="bg-gray-950 p-10 rounded-[2.5rem] hover:shadow-[0_30px_60px_-15px_rgba(79,70,229,0.15)] transition-all duration-500 group border border-gray-800 hover:border-indigo-500/20 cursor-default">
      <div className={`w-16 h-16 ${accentColor} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm font-black`}>
        <span className="material-symbols-outlined text-[32px]">{icon}</span>
      </div>
      <h3 className="text-2xl font-black mb-5 tracking-tight text-white">{title}</h3>
      <p className="text-gray-400 text-base leading-relaxed font-medium opacity-80">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, name, title, image }: { quote: string; name: string; title: string; image: string }) {
  return (
    <div className="bg-gray-900 p-10 rounded-3xl shadow-sm border border-gray-800 hover:shadow-xl transition-all duration-500 hover:-translate-y-2">
      <div className="flex gap-1 text-amber-400 mb-6">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="material-symbols-outlined text-[18px] fill-current">star</span>
        ))}
      </div>
      <p className="text-gray-200 font-medium leading-relaxed mb-8 italic">&quot;{quote}&quot;</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20">
          <span className="material-symbols-outlined text-indigo-400 text-[24px] opacity-40 font-bold">person</span>
        </div>
        <div>
          <p className="font-bold text-sm text-white">{name}</p>
          <p className="text-xs text-gray-500 font-bold">{title}</p>
        </div>
      </div>
    </div>
  );
}
