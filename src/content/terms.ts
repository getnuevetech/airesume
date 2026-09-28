export type LegalBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };
export type LegalSection = { heading: string; blocks: LegalBlock[] };
export type LegalDoc = { title: string; updated: string; pdfPath: string; draft: boolean; sections: LegalSection[] };

export const termsDoc: LegalDoc = {
  "title": "Terms of Service",
  "updated": "September 28, 2026",
  "pdfPath": "/legal/JobPilot-Terms-of-Service.pdf",
  "draft": true,
  "sections": [
    {
      "heading": "Overview",
      "blocks": [
        {
          "type": "p",
          "text": "Service use, resume- first registration, AI features, Auto-Apply, billing, acceptable use, and third-party job services Effective / Draft Date: September 28, 2026 DRAFT FOR COUNSEL REVIEW. Replace all bracketed fields and con fi rm actual product, billing, data, and vendor practices before publication. Public legal architecture: this document is one of only two public governing documents. JobPilot also uses short, just- in-time notices at resume upload, subscription checkout, and Auto-Apply enablement."
        }
      ]
    },
    {
      "heading": "1. Agreement to These Terms",
      "blocks": [
        {
          "type": "p",
          "text": "These Terms of Service (\"Terms\") govern your access to and use of the JobPilot website, applications, browser tools, AI- assisted features, job-search services, resume tools, application-assistance features, Auto-Apply features, and related services (collectively, the \"Service\"). By activating an account, purchasing a subscription, enabling Auto-Apply, or otherwise using the Service, you agree to these Terms. If you do not agree, do not activate an account or use the Service."
        },
        {
          "type": "p",
          "text": "Certain actions require additional af fi rmative consent at the point of action, including resume data extraction, recurring billing, and Auto-Apply enablement. Those short notices explain the immediate action and are governed by these Terms and the Privacy & Data Use Policy."
        }
      ]
    },
    {
      "heading": "2. Eligibility and Intended Market",
      "blocks": [
        {
          "type": "p",
          "text": "You must be at least 18 years old and legally able to enter into a binding contract. S. employment markets unless JobPilot expressly supports another jurisdiction. You are responsible for complying with laws and third-party rules applicable to you."
        }
      ]
    },
    {
      "heading": "3. Resume-First Registration and Account Activation",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may allow you to begin by uploading a resume instead of completing a traditional registration form. At or before upload, JobPilot will display a concise notice explaining that the resume will be parsed to create a temporary draft profile and account record."
        },
        {
          "type": "ul",
          "items": [
            "Uploading a resume may create a temporary draft account/profile, but it does not by itself activate a permanent account.",
            "You must verify an email address or other approved identifier and accept the then-current Terms and Privacy & Data Use Policy before account activation.",
            "You may upload only your own resume or a resume you are legally authorized to submit.",
            "You are responsible for reviewing and correcting extracted information before it is used in an application.",
            "Uploading a resume does not authorize a paid subscription or Auto-Apply."
          ]
        }
      ]
    },
    {
      "heading": "4. Your Career Profile, Resume Content, and Accuracy",
      "blocks": [
        {
          "type": "p",
          "text": "You are responsible for the truthfulness and accuracy of information in your Career profile, resumes, application answers, preferences, and submissions. JobPilot may help rewrite, organize, summarize, or emphasize verified information, but JobPilot is not authorized to fabricate employers, experience, credentials, education, dates, certifications, skills, achievements, or performance metrics. If the Service asks questions to improve or quantify a resume statement, information you con fi rm may be added to your Career profile or Fact Ledger."
        },
        {
          "type": "p",
          "text": "You should review all material application content before use, and you remain responsible for representations submitted in your name."
        }
      ]
    },
    {
      "heading": "5. AI-Assisted Features and Automated Processing",
      "blocks": [
        {
          "type": "p",
          "text": "The Service may use arti fi cial intelligence, machine learning, rules engines, and other automated systems to extract resume information, build profile summaries, identify job requirements, estimate job fit, tailor resumes, draft application responses, rank opportunities, prepare interview materials, and provide career insights."
        },
        {
          "type": "ul",
          "items": [
            "AI outputs may contain errors, omissions, outdated information, or incorrect inferences.",
            "Match scores and similar indicators are informational estimates, not guarantees of qualification, interview, offer, salary, or hiring outcome.",
            "JobPilot does not make an employer's hiring decision and does not control employer screening systems.",
            "Protected characteristics are not intended to be used as job-match criteria. JobPilot may use lawful eligibility or preference information that you provide, such as location, work authorization, or schedule preferences, for the purposes you request."
          ]
        }
      ]
    },
    {
      "heading": "6. Job Discovery, Listings, and Third-Party Information",
      "blocks": [
        {
          "type": "p",
          "text": "Job listings may come from employer career pages, applicant-tracking-system feeds, licensed or contracted job-data providers, public sources, browser-assisted imports, user-submitted URLs, or other permitted sources. A JobPilot listing may be a structured representation of information originating elsewhere and may not be the employer's official record. Listings can be changed, duplicated, paused, filled, or removed without notice. Compensation, location, sponsorship, duties, seniority, and requirements may be incomplete or inaccurate."
        },
        {
          "type": "p",
          "text": "You should verify material details on the employer's official site or directly with the employer. Displaying a company, recruiter, logo, or job does not mean JobPilot endorses, represents, or is affiliated with that party. JobPilot ordinarily is not the employer or the employer's recruiter or agent. Match scores, salary estimates, skill-gap indicators, and similar information are estimates for job-search assistance and are not promises of eligibility, compensation, interview likelihood, or hiring outcome."
        }
      ]
    },
    {
      "heading": "7. Assisted Apply",
      "blocks": [
        {
          "type": "p",
          "text": "Assisted Apply features may prepare resumes, draft answers, pre fill forms, organize application materials, or otherwise help you prepare an application for your review. Unless Auto-Apply is separately enabled, JobPilot will not treat use of Assisted Apply as permission to submit an application without your review or direction."
        }
      ]
    },
    {
      "heading": "8. Auto-Apply Authorization",
      "blocks": [
        {
          "type": "p",
          "text": "Auto-Apply is optional. Before JobPilot may submit applications automatically, you must separately enable the feature and af fi rmatively accept the then-current Auto-Apply authorization shown in the interface. Acceptance of these Terms alone is not permission to enable Auto-Apply."
        },
        {
          "type": "p",
          "text": "1 Limited Electronic Authorization When you enable Auto-Apply, you authorize JobPilot to prepare and electronically transmit job applications in your name only within the rules, preferences, verified profile information, application limits, and other settings you have selected. This is a limited authorization to perform the specific application actions you enable; it is not a general power of attorney and does not authorize JobPilot to accept employment or other contracts for you."
        },
        {
          "type": "p",
          "text": "2 Your Auto-Apply Rules You are responsible for con fi guring and reviewing Auto-Apply criteria, including job titles, locations, work arrangements, compensation preferences, employment type, match thresholds, excluded employers or job categories, application limits, sponsorship preferences, and any other available controls. JobPilot may apply additional safety, anti-spam, quality, or third- party restrictions even when a job otherwise meets your settings."
        },
        {
          "type": "p",
          "text": "3 Applications That Require User Review JobPilot should pause automation and require your review for fields or steps that are sensitive, legally signi fi cant, contractual, or insufficiently supported by verified information, including:"
        },
        {
          "type": "ul",
          "items": [
            "Legal certifications or attestations that require personal knowledge.",
            "Background-check, consumer-report, credit-check, drug-testing, biometric, or similar authorizations.",
            "Immigration fi lings, tax forms, government forms, or export-control declarations beyond simple user-con fi rmed work- authorization fields.",
            "Arbitration agreements, releases, non-compete or non-solicit agreements, intellectual-property assignments, or other contracts.",
            "Medical, disability, genetic, veteran, race/ethnicity, gender, sexual orientation, religion, or other voluntary demographic or EEO questions.",
            "Relocation, travel, licensing, or similar consents not already expressly authorized by you.",
            "Any field for which JobPilot lacks a sufficiently reliable verified answer. 8.4 Accuracy, Logs, and Submission Status You remain responsible for the accuracy of application information submitted in your name. JobPilot may maintain logs of automated application actions and, where available, show submission receipts or technical status. A status such as \"submitted\" means JobPilot received a technical indication that transmission occurred; it does not guarantee the employer received, opened, accepted, or retained the application. 8.5 Revocation You may disable Auto-Apply through the available account controls. Disabling Auto-Apply revokes authority for future automated submissions, subject to applications already transmitted or technically committed before the revocation took effect."
          ]
        }
      ]
    },
    {
      "heading": "9. Third-Party Sites, ATS Platforms, and Automation Restrictions",
      "blocks": [
        {
          "type": "p",
          "text": "Applications may involve employer sites, ATS platforms, job boards, identity providers, payment processors, and other third parties. Their terms, privacy practices, security controls, accessibility practices, and automation restrictions apply independently. JobPilot may be unable to complete actions that a third party blocks or requires you to complete directly. You must not use JobPilot to evade CAPTCHAs, authentication requirements, anti-bot controls, access restrictions, robots restrictions, rate limits, or other safeguards."
        },
        {
          "type": "p",
          "text": "JobPilot may pause or refuse automation when necessary to comply with third- party restrictions or protect the Service. Users should independently verify employers and recruiters. Do not send money, banking credentials, Social Security numbers, or identity documents to an unverified employer or recruiter merely because a job appeared in JobPilot."
        }
      ]
    },
    {
      "heading": "10. Plans, Subscriptions, Billing, and Automatic Renewal",
      "blocks": [
        {
          "type": "p",
          "text": "1 Plans and Charges JobPilot may offer free and paid plans. The price, billing interval, included features, limits, taxes, and promotional terms will be displayed before purchase. The checkout screen controls the specific commercial terms of your purchase. 2 Automatic Renewal Unless the checkout screen states otherwise, paid monthly and annual subscriptions renew automatically until canceled."
        },
        {
          "type": "p",
          "text": "By selecting the purchase button after the recurring-billing disclosure, you expressly authorize JobPilot and its payment processor to charge the payment method on file at each renewal interval. 3 Checkout Disclosure Immediately before purchase, JobPilot should clearly display the price and currency, billing frequency, timing of the first charge, any trial or promotional conversion, automatic-renewal language, cancellation method, and material feature limits."
        },
        {
          "type": "p",
          "text": "4 Cancellation You should be able to cancel online through Account > Billing or another method that is reasonably easy to access. Cancellation stops future renewal charges. Access generally continues until the end of the paid period unless law or the checkout terms state otherwise. 5 Refunds Except where required by law or expressly promised at purchase, subscription fees are non-refundable and JobPilot does not provide prorated refunds for unused portions of a billing period."
        },
        {
          "type": "p",
          "text": "JobPilot may issue discretionary refunds or credits without creating an ongoing obligation. 6 Trials, Promotions, Price Changes, and Failed Payments If a trial or promotional period converts to a paid subscription, JobPilot will disclose the conversion price, timing, and cancellation method before enrollment and provide reminders where required. Price changes apply prospectively after notice or consent required by law. If payment fails, JobPilot may retry the payment method, request an update, limit paid features, or suspend the subscription."
        },
        {
          "type": "p",
          "text": "7 Payment Processors Payments may be processed by third-party payment providers. Those providers may receive billing and transaction information under their own terms and privacy policies. JobPilot should use tokenized payment processing where reasonably available and avoid storing full payment-card numbers. Subscription fees purchase access to the Service and its features, not an interview, job offer, salary level, or employment outcome."
        }
      ]
    },
    {
      "heading": "11. User Content and Limited License",
      "blocks": [
        {
          "type": "p",
          "text": "You retain ownership of your resume and other content you submit. You grant JobPilot a limited, non-exclusive, worldwide license to host, copy, parse, transform, transmit, and otherwise process your content solely as reasonably necessary to provide, secure, support, maintain, and improve the Service and to perform actions you authorize. This license ends when content is deleted, subject to reasonable backup, security, legal, fraud-prevention, audit, and dispute-retention requirements."
        }
      ]
    },
    {
      "heading": "12. Privacy and Data Use",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot's collection, extraction, use, sharing, retention, security, and deletion of personal information are governed primarily by the Privacy & Data Use Policy. JobPilot may provide concise just-in-time notices at the moment you upload a resume, enable Auto-Apply, or purchase a subscription. Those notices supplement, but do not replace, the Privacy & Data Use Policy or these Terms."
        }
      ]
    },
    {
      "heading": "13. Acceptable Use",
      "blocks": [
        {
          "type": "p",
          "text": "You may not use the Service to engage in fraud, abuse, unauthorized automation, security attacks, or conduct that harms job seekers, employers, third-party platforms, or JobPilot. Without limitation, you may not:"
        },
        {
          "type": "ul",
          "items": [
            "Create an account using another person's resume or identity without authorization.",
            "Knowingly provide fake employers, fake degrees, fake licenses, fabricated skills, altered dates, or misleading achievements.",
            "Impersonate a person, employer, recruiter, government agency, or institution.",
            "Use bots or automation outside JobPilot to overload, scrape, harvest, reverse engineer, or systematically extract the Service or job database.",
            "Bypass CAPTCHAs, authentication, rate limits, anti-bot measures, robots restrictions, access controls, or security safeguards.",
            "Use Auto-Apply for indiscriminate spam or at volumes that violate platform rules or materially burden employer systems.",
            "Upload malware, malicious code, credentials, secrets, or unlawfully obtained personal information.",
            "Use the Service to discriminate unlawfully or target people based on protected characteristics.",
            "Resell access, share credentials, or use a consumer account as a commercial recruiting or data-harvesting account without authorization. JobPilot may apply rate limits, require re-verification, pause automation, investigate suspected abuse, remove data, or suspend or terminate accounts. Where appropriate and lawful, JobPilot may preserve evidence or cooperate with third parties and authorities concerning fraud, security incidents, or unlawful conduct."
          ]
        }
      ]
    },
    {
      "heading": "14. Intellectual Property",
      "blocks": [
        {
          "type": "p",
          "text": "Except for user content and third-party materials, the Service, software, design, trademarks, text, work fl ows, prompts, scoring methods, and related intellectual property are owned by or licensed to JobPilot. No rights are granted except the limited right to use the Service under these Terms."
        }
      ]
    },
    {
      "heading": "15. Electronic Communications",
      "blocks": [
        {
          "type": "p",
          "text": "You consent to receive transactional electronic communications about account verification, applications, security, billing, and legal notices. Marketing communications will be handled in accordance with applicable law and your preferences."
        }
      ]
    },
    {
      "heading": "16. Suspension and Termination",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may suspend or terminate access for material violations, fraud, security risk, unlawful conduct, nonpayment, abuse of third-party systems, or other conduct that threatens users or the Service. You may close your account at any time. Data deletion and retention are governed by the Privacy & Data Use Policy."
        }
      ]
    },
    {
      "heading": "17. No Employment Agency, Employer, Recruiter, or Guarantee",
      "blocks": [
        {
          "type": "p",
          "text": "Unless JobPilot expressly states otherwise in a separate written agreement, JobPilot is a technology service for job seekers. JobPilot is not your employer, a prospective employer, a staf fi ng agency, a recruiter acting for an employer, an immigration advisor, an attorney, or a fi duciary. JobPilot does not guarantee interviews, offers, compensation, employment, or any particular application outcome."
        }
      ]
    },
    {
      "heading": "18. Disclaimer of Warranties",
      "blocks": [
        {
          "type": "p",
          "text": "\" JOBPILOT DISCLAIMS WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, AND RESULTS, EXCEPT TO THE EXTENT A WARRANTY CANNOT LAWFULLY BE DISCLAIMED. JOBPILOT DOES NOT WARRANT THAT EVERY JOB LISTING, AI OUTPUT, MATCH SCORE, APPLICATION TRANSMISSION, OR THIRD-PARTY SERVICE WILL BE ACCURATE, COMPLETE, CURRENT, AVAILABLE, OR ERROR-FREE."
        }
      ]
    },
    {
      "heading": "19. Limitation of Liability",
      "blocks": [
        {
          "type": "p",
          "text": "TO THE MAXIMUM EXTENT PERMITTED BY LAW, JOBPILOT AND ITS affiliatES, offiCERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, LOST OPPORTUNITIES, LOST PROFITS, LOST DATA, OR EMPLOYMENT-RELATED LOSSES ARISING FROM OR RELATED TO THE SERVICE. ANY LIABILITY CAP AND EXCEPTIONS SHOULD BE REVIEWED BY COUNSEL FOR THE COMPANY'S OPERATING JURISDICTIONS BEFORE PUBLICATION."
        }
      ]
    },
    {
      "heading": "20. Indemnification",
      "blocks": [
        {
          "type": "p",
          "text": "To the extent permitted by law, you agree to defend, indemnify, and hold harmless JobPilot and its affiliates, officers, directors, employees, contractors, and service providers from claims, liabilities, damages, losses, and expenses arising from your unlawful or unauthorized use of the Service, your violation of these Terms, your infringement of third-party rights, or materially false information you knowingly provide. This section should be reviewed by counsel for applicable consumer- law limitations."
        }
      ]
    },
    {
      "heading": "21. Dispute Resolution; Arbitration; Class Action Waiver",
      "blocks": [
        {
          "type": "p",
          "text": "If JobPilot elects to use mandatory arbitration or a class-action waiver, the final provision must be drafted for the operating entity, customer jurisdictions, chosen arbitration provider, opt-out process, small-claims carveout, and any legally required disclosures. Do not publish a generic arbitration clause without counsel review. Until finalized, this section is a placeholder for counsel-approved dispute-resolution language."
        }
      ]
    },
    {
      "heading": "22. Governing Law",
      "blocks": [
        {
          "type": "p",
          "text": "These Terms will be governed by the law identified in the final company-specific version, without overriding mandatory consumer protections that apply in a user's jurisdiction. The governing-law and venue provisions must be completed after the operating entity and principal place of business are con fi rmed."
        }
      ]
    },
    {
      "heading": "23. Changes to These Terms",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may update these Terms as the Service changes. Material changes will be communicated in a manner appropriate to the change and applicable law. Where new consent is legally required, JobPilot will seek it before the change applies to the relevant feature or data use."
        }
      ]
    },
    {
      "heading": "24. General Terms",
      "blocks": [
        {
          "type": "p",
          "text": "If any provision is unenforceable, the remaining provisions remain in effect to the extent permitted by law. Failure to enforce a provision is not a waiver. You may not assign these Terms without JobPilot's consent; JobPilot may assign them in connection with a merger, fi nancing, reorganization, or sale of the business, subject to applicable law. Headings are for convenience only."
        }
      ]
    },
    {
      "heading": "Contact",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot is operated by [COMPANY LEGAL NAME]. Mailing address: [COMPANY MAILING ADDRESS] Privacy requests: [PRIVACY EMAIL] Legal / support inquiries: [LEGAL / SUPPORT EMAIL] These placeholders must be completed before publication."
        }
      ]
    }
  ]
} as const;
