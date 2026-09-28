/** Browser apply assistant: copy-ready packet for filling employer forms. */

const CONTACT_FIELDS = [
  { key: "name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "address", label: "Address" },
];

/**
 * Build a browser apply kit from an application row and related records.
 * Does not invent answers — only surfaces profile, tailored resume, and saved drafts.
 * Review-first Assisted Apply is the default path — the kit is the primary submit surface.
 */
export function buildApplyKit({ user, profile, job, application, version, preferences = {} }) {
  const shareContact = preferences.shareContact !== false;
  const questions = Array.isArray(application.questions) ? application.questions : [];
  const contact = CONTACT_FIELDS.map((field) => {
    let value = "";
    if (field.key === "name") value = String(user.name || "");
    else if (field.key === "email") value = shareContact ? String(user.email || "") : "";
    else if (field.key === "phone") value = shareContact ? String(user.phone || "") : "";
    else if (field.key === "city") value = String(user.city || "");
    else if (field.key === "address") value = String(user.address || "");
    return {
      key: field.key,
      label: field.label,
      value,
      ready: Boolean(value.trim()),
      note: !shareContact && (field.key === "email" || field.key === "phone")
        ? "Hidden because contact sharing is off in your profile."
        : "",
    };
  });

  const answers = questions.map((item, index) => ({
    id: String(item.id || `q-${index}`),
    prompt: String(item.prompt || ""),
    answer: String(item.answer || ""),
    kind: item.kind === "draft" || item.kind === "user" ? item.kind : "user",
    blankReason: String(item.blankReason || ""),
    hint: String(item.hint || ""),
    ready: Boolean(String(item.answer || "").trim()),
  }));

  const blankAnswers = answers.filter((item) => !item.ready);
  const listingUrl = String(application.target_url || job?.primary_url || job?.source_url || "").trim();
  const resumeText = String(version?.rendered || "").trim();
  const status = String(application.status || "");
  const eligible = ["Ready", "Review required", "Resume preparing"].includes(status);

  const steps = [
    {
      id: "open",
      title: "Open the employer listing",
      detail: listingUrl
        ? "Use the listing link and keep this kit beside the form."
        : "No listing URL is stored — open the application page yourself.",
      ready: Boolean(listingUrl),
    },
    {
      id: "contact",
      title: "Copy contact details",
      detail: `${contact.filter((item) => item.ready).length} of ${contact.length} fields ready.`,
      ready: contact.some((item) => item.ready),
    },
    {
      id: "resume",
      title: "Paste the tailored resume",
      detail: resumeText ? "A fact-safe tailored version is ready to copy." : "Prepare this application first so a tailored resume exists.",
      ready: Boolean(resumeText),
    },
    {
      id: "answers",
      title: "Fill application questions",
      detail: blankAnswers.length
        ? `${blankAnswers.length} answer${blankAnswers.length === 1 ? "" : "s"} still blank — fill sensitive ones yourself.`
        : answers.length
          ? "All drafted answers have text. Review before pasting."
          : "No question drafts yet.",
      ready: answers.length ? blankAnswers.length === 0 : true,
    },
    {
      id: "mark",
      title: "Mark Applied when the form is submitted",
      detail: "This only updates your tracker. It does not email the employer.",
      ready: eligible,
    },
  ];

  return {
    applicationId: application.id,
    status,
    mode: String(application.mode || "assisted"),
    eligible,
    title: job?.title || "Role",
    company: application.target_company || job?.primary_company || job?.company || "",
    viaCompany: job?.company && application.target_company && job.company.toLowerCase() !== String(application.target_company).toLowerCase()
      ? job.company
      : "",
    listingUrl,
    contact,
    resumeText,
    versionId: version?.id || application.version_id || "",
    versionLabel: version?.label || "",
    versionPinned: Boolean(version?.id || application.version_id),
    answers,
    blankCount: blankAnswers.length,
    steps,
    canComplete: eligible,
  };
}
