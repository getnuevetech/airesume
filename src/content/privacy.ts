export type LegalBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };
export type LegalSection = { heading: string; blocks: LegalBlock[] };
export type LegalDoc = { title: string; updated: string; pdfPath: string; draft: boolean; sections: LegalSection[] };

export const privacyDoc: LegalDoc = {
  "title": "Privacy & Data Use Policy",
  "updated": "September 28, 2026",
  "pdfPath": "/legal/JobPilot-Privacy-and-Data-Use-Policy.pdf",
  "draft": true,
  "sections": [
    {
      "heading": "Overview",
      "blocks": [
        {
          "type": "p",
          "text": "Resume extraction, AI processing, account data, cookies, application data, sharing, retention, security, and privacy rights Effective / Draft Date: September 28, 2026 DRAFT FOR COUNSEL REVIEW. Replace all bracketed fields and con fi rm actual product, billing, data, and vendor practices before publication. Public legal architecture: this document is one of only two public governing documents. JobPilot also uses short, just-in- time notices at resume upload, subscription checkout, and Auto-Apply enablement."
        }
      ]
    },
    {
      "heading": "1. Scope",
      "blocks": [
        {
          "type": "p",
          "text": "This Privacy & Data Use Policy explains how JobPilot collects, receives, extracts, creates, uses, discloses, retains, protects, and deletes personal information when you use the Service. It also explains how JobPilot uses resume data and AI-assisted processing to create a draft profile, provide job matching, tailor application materials, and perform actions you authorize. This Policy is the primary public policy for personal information and data use."
        },
        {
          "type": "p",
          "text": "Cookie practices and resume-data extraction are included here rather than published as separate legal policies. Short notices may still appear at the moment a user uploads a resume or takes another data-sensitive action."
        }
      ]
    },
    {
      "heading": "2. Personal Information We Collect",
      "blocks": [
        {
          "type": "p",
          "text": "1 Resume and Career profile Data"
        },
        {
          "type": "ul",
          "items": [
            "identifiers and contact details contained in your resume, such as name, email address, phone number, city, state, country, and professional profile links.",
            "Employment history, employers, job titles, dates, responsibilities, projects, achievements, and professional summaries.",
            "Education, certifications, licenses, skills, tools, technologies, languages, and other professional qualifications.",
            "Corrections, con fi rmations, and additional career information that you provide after extraction. 2.2 Account and verification Data",
            "verified email address, phone number if used, authentication tokens, account settings, consent records, security information, and account status. 2.3 Job-Search and Application Data",
            "Job-search preferences, target roles, locations, work arrangements, salary preferences, employment type, work-authorization preferences, and excluded employers or categories.",
            "Jobs viewed, saved, matched, skipped, prepared, or applied to; application status; submitted resume version; application answers; interview status; and outcome data you provide.",
            "Auto-Apply settings, application limits, authorization records, pause/review events, and submission logs. 2.4 AI-Generated and Inferred Data",
            "Extracted or normalized career facts, candidate profile summaries, job-requirement summaries, match scores, skill-gap indicators, resume strategies, generated application drafts, and career insights.",
            "Con fi dence indicators, provenance/source references, validation results, and model or prompt metadata used to maintain quality and auditability. 2.5 Device, Usage, Cookie, and Security Data",
            "IP address, browser/device information, timestamps, pages and features used, diagnostics, security logs, cookie identifiers, consent preferences, and analytics events. 2.6 Billing and Support Data",
            "Subscription plan, billing status, transaction identifiers, limited payment-related metadata provided by the payment processor, support communications, feedback, and troubleshooting information."
          ]
        }
      ]
    },
    {
      "heading": "3. Information We Ask You Not to Upload",
      "blocks": [
        {
          "type": "p",
          "text": "A resume ordinarily should not contain Social Security numbers, passport numbers, driver-license numbers, bank details, payment- card numbers, account passwords, medical records, or other highly sensitive information that is not needed for a job search. Please remove unnecessary sensitive information before upload. If such information is detected, JobPilot may suppress, quarantine, or delete it where feasible."
        }
      ]
    },
    {
      "heading": "4. How We Collect Information",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Directly from you, including through resume upload, profile questions, settings, application review, and support.",
            "From files, links, or professional information you choose to import or connect.",
            "Automatically from your use of the Service, including device, usage, security, and cookie data.",
            "From employers, job boards, ATS systems, job-data providers, and public career pages for job-listing information.",
            "From service providers that support authentication, billing, analytics, security, hosting, customer support, communications, and AI functionality."
          ]
        }
      ]
    },
    {
      "heading": "5. How We Use Personal Information",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Create a temporary draft account and Career profile after you choose to upload a resume.",
            "Verify and activate your account.",
            "Extract, organize, validate, and allow you to correct professional facts.",
            "Search for, recommend, rank, and analyze jobs according to your profile and preferences.",
            "Tailor resumes and draft application materials.",
            "Pre fill or submit job applications when you expressly authorize those actions.",
            "Track applications, prepare interview materials, provide career analytics, and improve job-search efficiency.",
            "Provide customer support and communicate about the Service.",
            "Process subscriptions, prevent fraud and abuse, and secure the Service.",
            "Debug, maintain, evaluate, and improve product features, including AI quality and reliability.",
            "Comply with law and protect users, employers, third parties, and JobPilot."
          ]
        }
      ]
    },
    {
      "heading": "6. Resume Extraction and Draft Account Creation",
      "blocks": [
        {
          "type": "p",
          "text": "When you choose to upload a resume, JobPilot may parse the document and extract professional and contact information to create a temporary draft account and Career profile. This lets JobPilot provide immediate value without requiring you to manually re- enter information already present in your resume. 1 Information That May Be Extracted"
        },
        {
          "type": "ul",
          "items": [
            "Name, email address, phone number, city or location, and professional profile links.",
            "Employment history, employers, job titles, dates, responsibilities, projects, and achievements.",
            "Education, certifications, licenses, skills, tools, technologies, languages, and professional qualifications.",
            "Professional summary and other career information you chose to include. 6.2 Draft Account vs. Activated Account",
            "Upload creates a temporary draft record so JobPilot can build a profile and show immediate product value.",
            "A permanent account is not activated solely because a resume was uploaded.",
            "You must verify an email address or other approved identifier and accept the then-current Terms and this Policy before activation.",
            "You can review and correct extracted information before it is used for applications.",
            "If a draft account is not activated, JobPilot should delete or de-identify the draft resume/profile data within a documented short period, currently targeted at 30 days, except for limited fraud, security, legal, or audit records as necessary. 6.3 What Resume Upload Does Not Authorize",
            "It does not automatically submit a job application.",
            "It does not enroll you in a paid subscription.",
            "It does not authorize Auto-Apply.",
            "It does not authorize JobPilot to answer voluntary demographic, medical, disability, veteran, or other sensitive questions for you.",
            "It does not authorize JobPilot to accept contracts, offers, background checks, arbitration agreements, or other legal attestations on your behalf."
          ]
        }
      ]
    },
    {
      "heading": "7. AI and Automated Processing",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may use AI and automated systems to extract facts, interpret job requirements, calculate or explain match indicators, tailor resumes, draft application responses, detect inconsistencies, identify duplicates or suspicious listings, prepare interview materials, and generate career analytics. AI outputs may be reviewed by additional models, deterministic validation rules, or human support processes where appropriate. A match score is a recommendation to the job seeker, not an employer hiring decision."
        },
        {
          "type": "p",
          "text": "You may review and correct profile facts that in fl uence recommendations. Where applicable law provides rights concerning certain automated decisions or pro fi ling, JobPilot will provide the required disclosures and controls before using covered processing in that jurisdiction."
        }
      ]
    },
    {
      "heading": "8. AI Providers, Model Training, and Data Minimization",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may use third-party AI providers to perform specific processing tasks. JobPilot should send only the information reasonably necessary for the task and use provider settings and contracts that restrict the provider from using JobPilot customer data to train general-purpose models where such controls are available and consistent with JobPilot's published commitments. JobPilot should maintain provider-specific data-processing terms, retention settings, security controls, and a vendor inventory."
        },
        {
          "type": "p",
          "text": "If JobPilot materially changes how customer data is used for model training or product improvement, this Policy must be updated and any legally required consent or choice mechanism must be implemented before the new use begins."
        }
      ]
    },
    {
      "heading": "9. When We Share Personal Information",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may disclose personal information only for appropriate purposes, including to:"
        },
        {
          "type": "ul",
          "items": [
            "Employers, recruiters, job boards, or ATS platforms when you direct JobPilot to prepare or submit an application.",
            "Cloud hosting, storage, database, security, authentication, customer-support, AI, analytics, communications, and infrastructure providers acting on JobPilot's behalf.",
            "Payment processors for subscription transactions.",
            "Professional advisers, auditors, insurers, and legal or regulatory authorities when necessary or legally required.",
            "A successor or transaction counterparty in a merger, acquisition, fi nancing, reorganization, or sale, subject to appropriate protections and applicable law. JobPilot should not disclose a complete resume or profile to an employer merely because a job was displayed or matched. Application data should be transmitted to an employer or application platform only when the user directs or authorizes the relevant application action."
          ]
        }
      ]
    },
    {
      "heading": "10. Sale, Targeted Advertising, and Cross-Context Behavioral Advertising",
      "blocks": [
        {
          "type": "p",
          "text": "Launch assumption: JobPilot does not sell personal information and does not use customer resume or application data for cross- context behavioral advertising. If JobPilot introduces practices that constitute a sale, sharing, targeted advertising, or similar regulated activity, JobPilot must update this Policy and implement required notices, opt-outs, consent controls, and browser-based preference-signal support before activating those practices."
        }
      ]
    },
    {
      "heading": "11. Sensitive and Protected Information",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot is designed to minimize the collection and use of highly sensitive information. Protected characteristics such as race, ethnicity, religion, disability, medical information, sexual orientation, gender identity, genetic information, or veteran status are not intended to be used as job-match criteria. When an employer application requests voluntary demographic or EEO information, JobPilot should require the user to answer or intentionally skip the question rather than infer an answer."
        }
      ]
    },
    {
      "heading": "12. Cookies and Similar Technologies",
      "blocks": [
        {
          "type": "p",
          "text": "1 Strictly Necessary JobPilot may use cookies or similar technologies for authentication, session management, fraud prevention, load balancing, consent preferences, and security. These technologies are generally required for the Service to function. 2 Preferences Preference technologies may remember settings such as language, job-search preferences, and interface choices. 3 Analytics Analytics technologies may measure pages and features used, errors, performance, and conversion funnels."
        },
        {
          "type": "p",
          "text": "JobPilot should use privacy-conscious con fi gurations and minimize collection to what is reasonably needed for product analytics. 4 Advertising and Cross-Site Tracking Launch assumption: advertising or cross-site tracking cookies are not enabled. If introduced later, JobPilot must update this Policy and implement legally required consent and opt-out controls before activation. 5 Cookie Controls and Retention Where required, JobPilot will present a cookie preference control before non-essential cookies are placed."
        },
        {
          "type": "p",
          "text": "Users should be able to revisit preferences through a persistent Cookie Settings or privacy link. Cookie lifetimes should be limited to what is reasonably necessary for the stated purpose, and JobPilot should honor legally required browser-based opt-out preference signals."
        }
      ]
    },
    {
      "heading": "13. Data Retention",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot retains personal information only for as long as reasonably necessary for the purposes described in this Policy, including providing the Service, maintaining security and auditability, complying with law, resolving disputes, and enforcing agreements. Retention periods should be documented internally by data category and periodically reviewed."
        },
        {
          "type": "ul",
          "items": [
            "Active-account profile and application data: generally retained while the account is active and as reasonably needed to provide the Service.",
            "Unactivated draft resume/profile data: targeted for deletion or de-identification within 30 days unless a shorter period is technically feasible or limited retention is necessary for fraud, security, legal, or audit reasons.",
            "Billing and transaction records: retained as required for accounting, tax, dispute, fraud, and legal obligations.",
            "Security and audit logs: retained for documented periods reasonably necessary to detect, investigate, and prevent abuse and security incidents.",
            "Backups: may persist for a limited period after deletion until rotated out under normal backup schedules."
          ]
        }
      ]
    },
    {
      "heading": "14. Security",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot uses administrative, technical, and organizational safeguards designed to protect personal information, including access controls, authentication, encryption where appropriate, logging, vendor controls, and security monitoring. No system is completely secure, and JobPilot cannot guarantee absolute security."
        }
      ]
    },
    {
      "heading": "15. Your Privacy Choices and Rights",
      "blocks": [
        {
          "type": "p",
          "text": "Depending on your location and applicable law, you may have rights to access, correct, delete, or obtain a portable copy of certain personal information; opt out of certain sales, sharing, targeted advertising, or covered pro fi ling; limit or withdraw certain consents; or appeal a privacy-rights decision. JobPilot may need to verify your identity before completing a request."
        },
        {
          "type": "p",
          "text": "Regardless of jurisdiction, JobPilot should provide practical account controls for correcting Career profile facts, replacing or deleting resumes, disabling Auto-Apply, canceling subscriptions, and closing an account. Requests may be submitted to [PRIVACY EMAIL] or through available account controls."
        }
      ]
    },
    {
      "heading": "16. California Privacy Notice",
      "blocks": [
        {
          "type": "p",
          "text": "If the California Consumer Privacy Act, as amended, applies to JobPilot, California residents may have rights regarding access, correction, deletion, portability, and certain sales or sharing of personal information, subject to statutory exceptions. JobPilot should maintain a California-specific data inventory and update this section if its practices trigger additional notice, opt-out, sensitive-information, or automated-decision requirements."
        }
      ]
    },
    {
      "heading": "17. Texas and Other U.S. State Privacy Rights",
      "blocks": [
        {
          "type": "p",
          "text": "S. states with applicable comprehensive privacy laws may have rights concerning access, correction, deletion, portability, certain targeted advertising or sales, and certain forms of pro fi ling, subject to law-specific thresholds, exceptions, and appeal rights. JobPilot will provide applicable rights and appeal mechanisms when legally required."
        }
      ]
    },
    {
      "heading": "18. International Users",
      "blocks": [
        {
          "type": "p",
          "text": "If JobPilot supports users outside the United States, additional privacy notices, legal bases, transfer mechanisms, cookie-consent requirements, and data-subject rights may apply. JobPilot should not market the Service as globally compliant until country- specific requirements have been reviewed and implemented."
        }
      ]
    },
    {
      "heading": "19. Children",
      "blocks": [
        {
          "type": "p",
          "text": "The Service is intended for adults and is not directed to children under 18. JobPilot does not knowingly create accounts for children. If JobPilot learns that a child has submitted personal information, JobPilot should take appropriate steps to delete it, subject to legal and security requirements."
        }
      ]
    },
    {
      "heading": "20. Changes to This Policy",
      "blocks": [
        {
          "type": "p",
          "text": "JobPilot may update this Policy as the Service, vendors, or laws change. Material changes will be communicated as required by law. If a new data use requires consent, JobPilot will obtain that consent before applying the new use to data where legally required."
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
