interface IconProps {
  className?: string;
}

export function IconWarningTriangle({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconCheckCircle({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconCheck({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconX({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconBox({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
    </svg>
  );
}

export function IconReceipt({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconChartBar({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );
}

export function IconBell({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
      <path d="M10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  );
}

export function IconBanknotes({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M1 4.75A2.75 2.75 0 013.75 2h12.5A2.75 2.75 0 0119 4.75v2.5A2.75 2.75 0 0116.25 10H3.75A2.75 2.75 0 011 7.25v-2.5z" />
      <path d="M19 6.06a.473.473 0 010 .019.868.868 0 01-.424.241 2.25 2.25 0 00-.67.282A2.242 2.242 0 0016.25 8.5H3.75c-.621 0-1.177.253-1.577.658a2.242 2.242 0 00-.673 1.09.868.868 0 01-.424-.24.469.469 0 010-.02V12.25A2.75 2.75 0 003.75 15h12.5a2.75 2.75 0 002.75-2.75V6.06z" />
      <path d="M14.25 7.5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5zM5.75 9a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" />
    </svg>
  );
}

export function IconDocumentText({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconReturn({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconRefresh({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.39A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconEye({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconEyeSlash({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
        clipRule="evenodd"
      />
      <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 015.839 6.02l2.437 2.438a4 4 0 002.472 5.472z" />
    </svg>
  );
}

export function IconLock({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconClipboard({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M13.887 3.182c.396.037.79.08 1.183.128A1.997 1.997 0 0117 5.297V17a2 2 0 01-2 2H5a2 2 0 01-2-2V5.297a1.997 1.997 0 011.93-1.987c.394-.048.788-.091 1.183-.128A1.497 1.497 0 017.5 2h5a1.497 1.497 0 011.387 1.182zM7.5 3a.5.5 0 00-.5.5V4h6v-.5a.5.5 0 00-.5-.5h-5zM7.25 8a.75.75 0 000 1.5h5.5a.75.75 0 000-1.5h-5.5zM7.25 11.5a.75.75 0 000 1.5h5.5a.75.75 0 000-1.5h-5.5zM7.25 15a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconUser({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
    </svg>
  );
}

export function IconTrash({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconPencil({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z" />
      <path d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

export function IconLightBulb({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1z" />
      <path
        fillRule="evenodd"
        d="M8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IconArrowDownRight({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.22 4.22a.75.75 0 011.06 0L14.25 13.19V7.5a.75.75 0 011.5 0V15a.75.75 0 01-.75.75H7.5a.75.75 0 010-1.5h5.69L4.22 5.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}