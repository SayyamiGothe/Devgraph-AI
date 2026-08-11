import { Footer } from '../components/Footer/Footer'
import { Navbar } from '../components/Navbar/Navbar'
import { CtaBand } from '../components/landing/CtaBand'
import { Features } from '../components/landing/Features'
import { GraphShowcase } from '../components/landing/GraphShowcase'
import { Hero } from '../components/landing/Hero'
import { Marquee } from '../components/landing/Marquee'
import { Metrics } from '../components/landing/Metrics'
import { Pipeline } from '../components/landing/Pipeline'
import { Pricing } from '../components/landing/Pricing'
import './Landing.scss'

export function Landing() {
  return (
    <div className="landing">
      <Navbar />

      <main>
        <Hero />
        <Marquee />
        <Features />
        <Pipeline />
        <GraphShowcase />
        <Metrics />
        <Pricing />
        <CtaBand />
      </main>

      <Footer />
    </div>
  )
}
