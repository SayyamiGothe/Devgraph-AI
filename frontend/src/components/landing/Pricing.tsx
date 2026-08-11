import { useState } from 'react'
import { Reveal } from '../Reveal/Reveal'
import { Button } from '../ui/Button'

interface Tier {
  name: string
  monthly: number | null
  blurb: string
  features: string[]
  featured?: boolean
  cta: string
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    monthly: 0,
    blurb: 'One workspace, enough headroom to prove the idea.',
    features: ['1 workspace · 3 projects', '5,000 pages / month', 'Graph explorer', 'Community support'],
    cta: 'Start free',
  },
  {
    name: 'Team',
    monthly: 79,
    blurb: 'For teams putting document intelligence in front of users.',
    features: [
      'Unlimited workspaces',
      '250,000 pages / month',
      'Custom extraction schemas',
      'Role-based access',
      'API + webhooks',
    ],
    featured: true,
    cta: 'Start 14-day trial',
  },
  {
    name: 'Enterprise',
    monthly: null,
    blurb: 'Your infrastructure, your compliance boundary.',
    features: ['Self-hosted or VPC', 'SSO / SCIM', 'Audit log export', 'Dedicated support', 'Custom SLAs'],
    cta: 'Talk to us',
  },
]

export function Pricing() {
  const [annual, setAnnual] = useState(true)

  return (
    <section className="section pricing" id="pricing">
      <div className="container">
        <div className="section-head">
          <Reveal variant="fade">
            <span className="eyebrow">Pricing</span>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <h2>
              Priced per page, not per <span className="text-gradient">seat</span>
            </h2>
          </Reveal>

          <Reveal variant="up" delay={160}>
            <div className="pricing__toggle" role="group" aria-label="Billing period">
              <button className={annual ? '' : 'is-on'} onClick={() => setAnnual(false)}>
                Monthly
              </button>
              <button className={annual ? 'is-on' : ''} onClick={() => setAnnual(true)}>
                Annual
                <span className="pricing__save">−20%</span>
              </button>
              {/* Sliding pill behind the active option */}
              <span className={`pricing__thumb ${annual ? 'is-right' : ''}`} aria-hidden="true" />
            </div>
          </Reveal>
        </div>

        <div className="pricing__grid">
          {TIERS.map((tier, i) => (
            <Reveal variant="up" delay={i * 120} key={tier.name} className="pricing__cell">
              <article className={`pricing-card ${tier.featured ? 'is-featured' : ''}`}>
                {tier.featured && <span className="pricing-card__flag">Most popular</span>}

                <h3>{tier.name}</h3>

                <div className="pricing-card__price">
                  {tier.monthly === null ? (
                    <span className="pricing-card__custom">Custom</span>
                  ) : (
                    <>
                      <span className="pricing-card__currency">$</span>
                      <span className="pricing-card__amount" key={`${tier.name}-${annual}`}>
                        {annual ? Math.round(tier.monthly * 0.8) : tier.monthly}
                      </span>
                      <span className="pricing-card__period">/mo</span>
                    </>
                  )}
                </div>

                <p className="pricing-card__blurb">{tier.blurb}</p>

                <ul className="pricing-card__features">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <span className="pricing-card__check" aria-hidden="true">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  block
                  variant={tier.featured ? 'primary' : 'outline'}
                  to={tier.monthly === null ? '/login' : '/register'}
                >
                  {tier.cta}
                </Button>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
