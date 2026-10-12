export type DiagramId =
  | "fast"
  | "recovery-position"
  | "choking-rescue"
  | "report-path"
  | "brain-areas"
  | "hospital-to-community"
  | "eight-know"
  | "policy-stack";

const frame = "w-full max-w-xl rounded-[var(--denim-r)] border border-line bg-pt0 p-3";

export function TrainingDiagram({ id }: { id: DiagramId }) {
  switch (id) {
    case "fast":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-pri">
            FAST — stroke signs
          </figcaption>
          <svg viewBox="0 0 360 110" className="h-auto w-full" role="img" aria-label="FAST stroke signs">
            <rect x="8" y="12" width="78" height="86" rx="10" fill="var(--denim-pt)" stroke="var(--denim-steel)" />
            <text x="47" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--denim-pri)">F</text>
            <text x="47" y="62" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">Face droop</text>
            <text x="47" y="80" textAnchor="middle" fontSize="10" fill="var(--denim-muted)">Ask to smile</text>
            <rect x="96" y="12" width="78" height="86" rx="10" fill="var(--denim-pt)" stroke="var(--denim-steel)" />
            <text x="135" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--denim-pri)">A</text>
            <text x="135" y="62" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">Arm drift</text>
            <text x="135" y="80" textAnchor="middle" fontSize="10" fill="var(--denim-muted)">Raise both</text>
            <rect x="184" y="12" width="78" height="86" rx="10" fill="var(--denim-pt)" stroke="var(--denim-steel)" />
            <text x="223" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--denim-pri)">S</text>
            <text x="223" y="62" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">Speech</text>
            <text x="223" y="80" textAnchor="middle" fontSize="10" fill="var(--denim-muted)">Slurred?</text>
            <rect x="272" y="12" width="80" height="86" rx="10" fill="var(--denim-danger-bg)" stroke="var(--denim-danger)" />
            <text x="312" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--denim-danger-text)">T</text>
            <text x="312" y="62" textAnchor="middle" fontSize="11" fill="var(--denim-danger-text)">Time</text>
            <text x="312" y="80" textAnchor="middle" fontSize="10" fill="var(--denim-danger-text)">Call 911</text>
          </svg>
        </figure>
      );
    case "recovery-position":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accd">
            Recovery position
          </figcaption>
          <svg viewBox="0 0 360 120" className="h-auto w-full" role="img" aria-label="Person on their side">
            <ellipse cx="180" cy="98" rx="140" ry="10" fill="var(--denim-line)" />
            <path d="M70 78 C90 70 130 62 170 64 C210 66 250 72 290 78" fill="none" stroke="var(--denim-deep)" strokeWidth="10" strokeLinecap="round" />
            <circle cx="78" cy="62" r="14" fill="var(--denim-pt2)" stroke="var(--denim-deep)" strokeWidth="2" />
            <path d="M170 64 L155 88" stroke="var(--denim-deep)" strokeWidth="8" strokeLinecap="round" />
            <path d="M210 66 L230 90" stroke="var(--denim-deep)" strokeWidth="8" strokeLinecap="round" />
            <text x="180" y="28" textAnchor="middle" fontSize="12" fill="var(--denim-accd)">On the side so the airway can drain</text>
          </svg>
        </figure>
      );
    case "choking-rescue":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-danger-700">
            Mild versus severe choking
          </figcaption>
          <svg viewBox="0 0 360 100" className="h-auto w-full" role="img" aria-label="Mild versus severe choking">
            <rect x="10" y="14" width="160" height="72" rx="10" fill="var(--denim-acct)" stroke="var(--denim-acc)" />
            <text x="90" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--denim-accd)">Mild</text>
            <text x="90" y="60" textAnchor="middle" fontSize="11" fill="var(--denim-accd)">Can cough or speak</text>
            <text x="90" y="76" textAnchor="middle" fontSize="11" fill="var(--denim-accd)">Let them cough</text>
            <rect x="190" y="14" width="160" height="72" rx="10" fill="var(--denim-danger-bg)" stroke="var(--denim-danger)" />
            <text x="270" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--denim-danger-text)">Severe</text>
            <text x="270" y="60" textAnchor="middle" fontSize="11" fill="var(--denim-danger-text)">Cannot cough, speak,</text>
            <text x="270" y="76" textAnchor="middle" fontSize="11" fill="var(--denim-danger-text)">or breathe — act now</text>
          </svg>
        </figure>
      );
    case "report-path":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-danger-700">
            Abuse, neglect, and exploitation reporting path
          </figcaption>
          <svg viewBox="0 0 360 88" className="h-auto w-full" role="img" aria-label="Report path">
            <rect x="8" y="22" width="88" height="44" rx="8" fill="var(--denim-danger-bg)" stroke="var(--denim-danger)" />
            <text x="52" y="48" textAnchor="middle" fontSize="11" fill="var(--denim-danger-text)">Suspect</text>
            <path d="M100 44 H124" stroke="var(--denim-muted)" strokeWidth="2" markerEnd="url(#arr)" />
            <rect x="128" y="22" width="100" height="44" rx="8" fill="var(--denim-acct)" stroke="var(--denim-acc)" />
            <text x="178" y="42" textAnchor="middle" fontSize="11" fill="var(--denim-accd)">Agency process</text>
            <text x="178" y="56" textAnchor="middle" fontSize="10" fill="var(--denim-accd)">and supervisor</text>
            <path d="M232 44 H256" stroke="var(--denim-muted)" strokeWidth="2" />
            <rect x="260" y="10" width="92" height="68" rx="8" fill="var(--denim-pt)" stroke="var(--denim-steel)" />
            <text x="306" y="36" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">APS and /</text>
            <text x="306" y="52" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">or police</text>
            <text x="306" y="68" textAnchor="middle" fontSize="10" fill="var(--denim-deep)">911 if danger</text>
          </svg>
        </figure>
      );
    case "brain-areas":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-pri">
            Injury location can change different skills
          </figcaption>
          <svg viewBox="0 0 360 130" className="h-auto w-full" role="img" aria-label="Brain areas and skills">
            <ellipse cx="120" cy="68" rx="70" ry="48" fill="var(--denim-pt)" stroke="var(--denim-steel)" />
            <text x="120" y="64" textAnchor="middle" fontSize="11" fill="var(--denim-pri)">Brain</text>
            <text x="120" y="80" textAnchor="middle" fontSize="10" fill="var(--denim-pri)">injury</text>
            <text x="230" y="28" fontSize="11" fill="var(--denim-text)">Front — planning, impulse</text>
            <text x="230" y="50" fontSize="11" fill="var(--denim-text)">Side — language, memory</text>
            <text x="230" y="72" fontSize="11" fill="var(--denim-text)">Back — vision</text>
            <text x="230" y="94" fontSize="11" fill="var(--denim-text)">Deep — movement, alertness</text>
            <text x="230" y="116" fontSize="11" fill="var(--denim-muted)">Not every injury looks the same</text>
          </svg>
        </figure>
      );
    case "hospital-to-community":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-deep">
            Hospital to community
          </figcaption>
          <svg viewBox="0 0 360 90" className="h-auto w-full" role="img" aria-label="Hospital to community steps">
            <rect x="10" y="20" width="90" height="50" rx="8" fill="var(--denim-pt)" stroke="var(--denim-steel)" />
            <text x="55" y="50" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">Hospital</text>
            <path d="M104 45 H128" stroke="var(--denim-deep)" strokeWidth="2" />
            <rect x="132" y="20" width="96" height="50" rx="8" fill="var(--denim-pt2)" stroke="var(--denim-hi)" />
            <text x="180" y="42" textAnchor="middle" fontSize="11" fill="var(--denim-deep)">Discharge</text>
            <text x="180" y="58" textAnchor="middle" fontSize="10" fill="var(--denim-deep)">plan + who to call</text>
            <path d="M232 45 H256" stroke="var(--denim-deep)" strokeWidth="2" />
            <rect x="260" y="20" width="90" height="50" rx="8" fill="var(--denim-acct)" stroke="var(--denim-acc)" />
            <text x="305" y="42" textAnchor="middle" fontSize="11" fill="var(--denim-accd)">Community</text>
            <text x="305" y="58" textAnchor="middle" fontSize="10" fill="var(--denim-accd)">staff + family</text>
          </svg>
        </figure>
      );
    case "eight-know":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-deep">
            Eight things before working alone
          </figcaption>
          <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-body sm:grid-cols-4">
            {["Disability effects", "Goals", "Medical / safety", "Medications", "Plan / supports", "Restrictions", "Your duties", "DNR / POLST / hospice"].map((label) => (
              <li key={label} className="rounded-lg border border-line bg-paper px-2 py-2 text-center font-medium">
                {label}
              </li>
            ))}
          </ul>
        </figure>
      );
    case "policy-stack":
      return (
        <figure className={frame}>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-wide text-deep">
            This agency’s written documents
          </figcaption>
          <ul className="space-y-2" aria-label="Agency policy documents">
            <li className="rounded-lg border border-pt2 bg-paper px-3 py-2.5">
              <p className="text-[13px] font-semibold text-deep">Personnel policies</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Job duties, timekeeping, conduct, and who you report to.
              </p>
            </li>
            <li className="rounded-lg border border-accl bg-paper px-3 py-2.5">
              <p className="text-[13px] font-semibold text-deep">Operating procedures</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                How this agency handles transportation, grievances, and day-to-day work.
              </p>
            </li>
            <li className="rounded-lg border border-danger-200 bg-paper px-3 py-2.5">
              <p className="text-[13px] font-semibold text-deep">Emergency procedures</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Injury, illness, mental-health decline, death, fire, and missing person — this
                agency’s version.
              </p>
            </li>
          </ul>
        </figure>
      );
    default:
      return null;
  }
}
