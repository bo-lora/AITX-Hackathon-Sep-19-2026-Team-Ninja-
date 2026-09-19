export function DownloadChromeButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <a
      href="/contextninja-extension.zip"
      download
      className={`inline-flex items-center rounded-full bg-[#111] text-white transition-colors hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
        compact ? "h-11 gap-2.5 py-1 pl-1.5 pr-4" : "h-14 gap-3 py-1 pl-1.5 pr-6"
      }`}
    >
      <img
        src="/chrome-icon.png"
        alt=""
        width={compact ? 32 : 40}
        height={compact ? 32 : 40}
        className={compact ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-full"}
      />
      {compact ? (
        <span className="text-sm font-semibold">Get the extension</span>
      ) : (
        <span className="text-left leading-tight">
          <span className="block text-[11px] font-medium text-white/80">Download</span>
          <span className="block text-[15px] font-bold">Chrome Extension</span>
        </span>
      )}
    </a>
  );
}
