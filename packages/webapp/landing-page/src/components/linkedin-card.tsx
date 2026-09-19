import { profilePath, type Teammate } from "@/lib/team";
import { linkedInQrSvg } from "@/lib/qr";

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0Z"
      />
    </svg>
  );
}

export async function LinkedInCard({ person }: { person: Teammate }) {
  const svg = await linkedInQrSvg(person.linkedin);

  return (
    <article className="paper-sheet flex h-full flex-col justify-between gap-6 p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <img
          src={person.photo}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-full object-cover bg-navy"
        />
        <div className="min-w-0 space-y-1">
          <h2 className="text-3xl sm:text-[2rem]">{person.name}</h2>
          <p className="text-[15px] font-semibold leading-snug text-navy">{person.title}</p>
          <p className="text-sm leading-snug text-muted">{person.company}</p>
          <a
            href={person.linkedin}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 font-semibold text-navy underline-offset-4 hover:text-mint hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <LinkedInMark />
            Open LinkedIn
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <div
          className="mx-auto aspect-square w-full max-w-[11.5rem] bg-white p-2.5 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={`QR code for ${person.name} on LinkedIn`}
        />
        <p className="break-all text-center font-mono text-[11px] leading-4 text-muted">
          {profilePath(person.linkedin)}
        </p>
      </div>
    </article>
  );
}
