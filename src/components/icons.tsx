import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </BaseIcon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </BaseIcon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m8 13 2-2 4 4 3-3 3 3" />
      <path d="M9 9h.01" />
    </BaseIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 5v14l11-7-11-7Z" />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.9 1.9 0 0 0 .4 2.1l.1.1-1.7 2.9-.2-.1a2 2 0 0 0-2.3.4l-.1.1-3.3-1.3v-.2a2 2 0 0 0-1.3-1.8h-.2L7.5 22l-.1-.2a2 2 0 0 0-2.3-.4l-.2.1-1.7-2.9.1-.1a1.9 1.9 0 0 0 .4-2.1v-.2L2 11.5l.2-.1a2 2 0 0 0 1.3-1.9V9.3L2.2 6l.2-.1a2 2 0 0 0 2.1-.4l.1-.1 2.9 1.7-.1.2a2 2 0 0 0 .4 2.3l.1.1 3.3 1.3h.2a2 2 0 0 0 1.3-1.8v-.2L16.5 2l.1.2a2 2 0 0 0 2.3.4l.2-.1 1.7 2.9-.1.1a1.9 1.9 0 0 0-.4 2.1v.2L22 12.5l-.2.1a2 2 0 0 0-1.3 1.9v.2Z" />
    </BaseIcon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93 6.34 6.34" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </BaseIcon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 13.2A7.5 7.5 0 0 1 10.8 3 6.5 6.5 0 1 0 21 13.2Z" />
    </BaseIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </BaseIcon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </BaseIcon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 21a8 8 0 1 0-16 0" />
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </BaseIcon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </BaseIcon>
  );
}

export function MusicIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M9 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
			<path d="M19 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
			<path d="M11 20V6l10-2v14" />
		</BaseIcon>
	);
}

export function DotsIcon(props: IconProps) {
	return (
		<BaseIcon {...props}>
			<path d="M12 6h.01" />
			<path d="M12 12h.01" />
			<path d="M12 18h.01" />
		</BaseIcon>
	);
}
