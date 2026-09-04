import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ProblemSection from '../components/ProblemSection';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import PricingTiers from '../components/PricingTiers';
import LiveDemo from '../components/LiveDemo';
import Testimonials from '../components/Testimonials';
import FAQ from '../components/FAQ';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <Navbar />
      <Hero />
      <ProblemSection />
      <Features />
      <HowItWorks />
      <PricingTiers />
      <LiveDemo />
      <Testimonials />
      <FAQ />
      <CTASection />
      <Footer />
    </div>
  );
}
